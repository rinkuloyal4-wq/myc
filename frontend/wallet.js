/* =========================================================
   3T Dial — Wallet: balance, top-up via parent gateway, transactions
   ========================================================= */

Object.assign(window.App, {

  /* -------- state -------- */
  walletTxs: [],
  topupOpen: false,
  topupAmount: '',
  walletLoading: false,

  /* -------- load -------- */
  async loadWallet() {
    this.walletLoading = true
    try {
      const data = await this.api('/wallet')
      this.user.balance_usd = data.balance_usd
      this.walletTxs = data.transactions || []
    } catch (e) {
      this.toast(e.message, 'error')
    } finally {
      this.walletLoading = false
    }
  },

  /* -------- top-up -------- */
  async startTopup() {
    const amt = parseFloat(this.topupAmount)
    if (!amt || amt < 1 || amt > 1000) {
      this.toast('Enter an amount between $1 and $1000', 'error')
      return
    }

    this.busy = true
    try {
      const { redirect_url } = await this.api('/topup/create', {
        method: 'POST',
        body: JSON.stringify({ amount_usd: amt }),
      })

      // On native (APK/AAB), open in system browser — Razorpay refuses WebView.
      // On web, redirect in same tab.
      if (this.isNative && window.Capacitor?.Plugins?.Browser) {
        await window.Capacitor.Plugins.Browser.open({ url: redirect_url })
      } else {
        window.location.href = redirect_url
      }
    } catch (e) {
      this.toast(e.message, 'error')
    } finally {
      this.busy = false
    }
  },

  /* -------- after returning from gateway -------- */
  // Reads ?topup=REF in the hash and polls /api/topup/status until paid or failed
  async checkTopupReturn() {
    const hash = location.hash || ''
    const m = hash.match(/topup=([A-Za-z0-9_\-]+)/)
    if (!m) return
    const ref = m[1]

    // Clean the URL so refresh doesn't re-trigger
    history.replaceState(null, '', location.pathname + '#/wallet')

    this.toast('Checking payment…', 'info')

    const started = Date.now()
    while (Date.now() - started < 60000) {
      try {
        const { status } = await this.api(`/topup/status/${ref}`)
        if (status === 'paid') {
          this.toast('Payment successful — wallet updated', 'success')
          await Promise.all([this.loadWallet(), this.refreshUser()])
          return
        }
        if (status === 'failed') {
          this.toast('Payment failed', 'error')
          return
        }
      } catch {}
      await new Promise(r => setTimeout(r, 3000))
    }
    this.toast('Payment still pending — check wallet in a moment', 'info')
  },

  /* -------- helpers -------- */
  formatTime(iso) {
    try {
      const d = new Date(iso)
      const now = new Date()
      const sameDay = d.toDateString() === now.toDateString()
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      if (sameDay) return `Today ${hh}:${mm}`
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` ${hh}:${mm}`
    } catch { return '' }
  },
})
