/* =========================================================
   3T Dial — SMS: conversation list + thread
   ========================================================= */

Object.assign(window.App, {

  /* -------- state -------- */
  convos: [],
  activeConvo: null,
  smsDraft: '',
  smsQuery: '',

  /* -------- computed -------- */
  get filteredConvos() {
    const q = this.smsQuery.trim().toLowerCase()
    if (!q) return this.convos
    return this.convos.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.number || '').includes(q)
    )
  },

  /* -------- load (called after login) -------- */
  async loadConvos() {
    try {
      // Backend route to be added: GET /api/sms/conversations
      // Mock data for now:
      this.convos = [
        {
          id: 1, name: 'John Smith', number: '+44 20 7946 0102', unread: 2,
          messages: [
            { id: 1, dir: 'in',  text: 'Hi, is this the support line?', time: '09:12' },
            { id: 2, dir: 'out', text: 'Yes! How can we help?',         time: '09:13' },
            { id: 3, dir: 'in',  text: 'I need to update my number.',   time: '09:14' },
            { id: 4, dir: 'in',  text: 'Can you help?',                 time: '09:14' },
          ],
        },
        {
          id: 2, name: 'Unknown', number: '+1 (415) 555-0132', unread: 0,
          messages: [
            { id: 1, dir: 'in',  text: 'Your verification code is 448192', time: 'Yesterday' },
            { id: 2, dir: 'out', text: 'Thanks', time: 'Yesterday' },
          ],
        },
        {
          id: 3, name: 'Sarah Lee', number: '+61 2 8000 0123', unread: 0,
          messages: [
            { id: 1, dir: 'out', text: 'Hi Sarah, following up on our call.', time: 'Mon' },
            { id: 2, dir: 'in',  text: 'Got it, thanks!', time: 'Mon' },
          ],
        },
      ]
    } catch {
      this.convos = []
    }
  },

  /* -------- actions -------- */
  openConvo(id) {
    const c = this.convos.find(x => x.id === id)
    if (!c) return
    c.unread = 0
    this.activeConvo = c
    this.$nextTick(() => {
      const body = document.querySelector('.thread-body')
      if (body) body.scrollTop = body.scrollHeight
      this.refreshIcons()
    })
  },

  closeConvo() {
    this.activeConvo = null
  },

  async sendSms() {
    const text = this.smsDraft.trim()
    if (!text || !this.activeConvo) return

    // Optimistic append
    this.activeConvo.messages.push({
      id: Date.now(),
      dir: 'out',
      text,
      time: 'now',
    })
    this.smsDraft = ''

    this.$nextTick(() => {
      const body = document.querySelector('.thread-body')
      if (body) body.scrollTop = body.scrollHeight
    })

    try {
      // Backend route to be added: POST /api/sms/send
      // await this.api('/sms/send', {
      //   method: 'POST',
      //   body: JSON.stringify({ to: this.activeConvo.number, text }),
      // })
    } catch (e) {
      this.toast(e.message, 'error')
    }
  },
})
