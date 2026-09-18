/* =========================================================
   3T Dial — core app object
   Alpine binds to window.App. Feature files extend it.
   A Product of Tech Talk Titans
   ========================================================= */

const API_BASE = '/api'

window.App = {
  /* ---------------- state ---------------- */
  user: null,
  loading: true,
  busy: false,
  route: 'calls',

  toasts: [],
  _toastId: 0,

  loginForm: { identifier: '', password: '' },
  signupForm: { name: '', email: '', phone: '', password: '', confirm_password: '' },

  pendingEmail: '',
  pendingPhone: '',
  otpEmail: '',
  otpPhone: '',
  emailVerified: false,
  phoneVerified: false,

  callTab: 'dialer',

  /* ---------------- init ---------------- */
  async init() {
    this.readHash()
    window.addEventListener('hashchange', () => this.readHash())

    try {
      this.user = await this.api('/me')
    } catch {
      this.user = null
    }
    this.loading = false
    this.enforceAuth()
    this.refreshIcons()
  },

  readHash() {
    const raw = location.hash.replace(/^#\/?/, '').split('?')[0]
    this.route = raw || 'calls'
    this.enforceAuth()
    this.$nextTick?.(() => this.refreshIcons())
  },

  enforceAuth() {
    const PROTECTED = ['calls', 'sms', 'wallet', 'profile']
    const AUTH = ['login', 'signup', 'verify']
    if (this.loading) return
    if (PROTECTED.includes(this.route) && !this.user) {
      location.hash = '#/login'
    } else if (AUTH.includes(this.route) && this.user) {
      location.hash = '#/calls'
    }
  },

  go(route) { location.hash = '#/' + route },

  /* ---------------- API ---------------- */
  async api(path, opts = {}) {
    const res = await fetch(API_BASE + path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`)
    return data
  },

  /* ---------------- helpers ---------------- */
  money(n) { return '$' + Number(n || 0).toFixed(2) },

  toast(msg, type = 'info') {
    const id = ++this._toastId
    this.toasts.push({ id, msg, type })
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id)
    }, 3000)
  },

  refreshIcons() {
    if (window.lucide) window.lucide.createIcons()
  },

  async doLogout() {
    try { await this.api('/logout', { method: 'POST' }) } catch {}
    this.user = null
    this.go('login')
  },
}

/* Auto re-render Lucide icons whenever DOM changes */
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons()
  const obs = new MutationObserver(() => {
    if (window.lucide) window.lucide.createIcons()
  })
  obs.observe(document.body, { childList: true, subtree: true })
})
