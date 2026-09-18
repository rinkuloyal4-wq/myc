/* =========================================================
   3T Dial — Calls: dialer, history, voicemail, numbers, buy flow, in-call
   ========================================================= */

Object.assign(window.App, {

  /* -------- state -------- */
  callView: 'main',           // main | buy-country | buy-browse | buy-confirm
  callTab: 'dialer',          // dialer | history | voicemail | numbers
  dialed: '',
  activeCall: null,
  _callTimer: null,

  dialKeys: [
    { k: '1', s: '' }, { k: '2', s: 'ABC' }, { k: '3', s: 'DEF' },
    { k: '4', s: 'GHI' }, { k: '5', s: 'JKL' }, { k: '6', s: 'MNO' },
    { k: '7', s: 'PQRS' }, { k: '8', s: 'TUV' }, { k: '9', s: 'WXYZ' },
    { k: '*', s: '' }, { k: '0', s: '+' }, { k: '#', s: '' },
  ],

  // Mock data — replace with API calls when backend endpoints are ready
  callHistory: [
    { id: 1, direction: 'in',     name: 'Unknown',    number: '+1 (415) 555-0132', time: 'Today 10:42' },
    { id: 2, direction: 'out',    name: 'John Smith', number: '+44 20 7946 0102',  time: 'Today 09:15' },
    { id: 3, direction: 'missed', name: 'Unknown',    number: '+61 2 8000 0123',   time: 'Yesterday' },
  ],
  voicemails: [
    { id: 1, name: 'Unknown',    from: '+1 (415) 555-0132', duration: '0:24', time: 'Today 10:41', playing: false },
    { id: 2, name: 'John Smith', from: '+44 20 7946 0102',  duration: '0:58', time: 'Yesterday',   playing: false },
  ],
  myNumbers: [],

  // Buy flow
  countries: [
    { code: 'US', name: 'United States', flag: '🇺🇸', from_price: 1.50 },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', from_price: 2.00 },
    { code: 'CA', name: 'Canada',         flag: '🇨🇦', from_price: 1.80 },
    { code: 'AU', name: 'Australia',      flag: '🇦🇺', from_price: 2.20 },
  ],
  selectedCountry: null,
  selectedNumber: null,
  numbers: [],
  numbersLoading: false,
  filters: { starts: '', contains: '', ends: '', type: 'any', sms: false, voice: false },

  isNative: typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.(),

  /* -------- loaded after login -------- */
  async loadNumbers() {
    try {
      // Backend route to be added: GET /api/numbers/my
      // For now, empty list
      this.myNumbers = []
    } catch { this.myNumbers = [] }
  },

  /* -------- dialer -------- */
  dialPress(k) { this.dialed += k },
  dialBackspace() { this.dialed = this.dialed.slice(0, -1) },

  startCall(number, name = 'Unknown') {
    if (!number) return
    this.activeCall = {
      number, name,
      mute: false, hold: false, add: false, merge: false,
      record: false, speaker: false,
      timer: '00:00',
    }
    this.dialed = ''
    this._startTimer()
    this.refreshIcons()
  },

  _startTimer() {
    let s = 0
    clearInterval(this._callTimer)
    this._callTimer = setInterval(() => {
      s++
      const mm = String(Math.floor(s / 60)).padStart(2, '0')
      const ss = String(s % 60).padStart(2, '0')
      if (this.activeCall) this.activeCall.timer = `${mm}:${ss}`
    }, 1000)
  },

  endCall() {
    clearInterval(this._callTimer)
    this.activeCall = null
    this.toast('Call ended', 'info')
  },

  playVoicemail(v) {
    this.voicemails = this.voicemails.map(x => ({ ...x, playing: x.id === v.id ? !x.playing : false }))
  },

  /* -------- buy number flow -------- */
  selectCountry(code) {
    this.selectedCountry = this.countries.find(c => c.code === code)
    this.filters = { starts: '', contains: '', ends: '', type: 'any', sms: false, voice: false }
    this.numbers = []
    this.callView = 'buy-browse'
    this.searchNumbers()
  },

  async searchNumbers() {
    this.numbersLoading = true
    try {
      // Backend route to be added: GET /api/numbers/search?country=..&...
      // Mock results for now
      await new Promise(r => setTimeout(r, 300))
      this.numbers = this._mockNumbers()
    } finally {
      this.numbersLoading = false
      this.refreshIcons()
    }
  },

  _mockNumbers() {
    const c = this.selectedCountry
    const prefix = c?.code === 'US' ? '+1' : c?.code === 'GB' ? '+44' : c?.code === 'CA' ? '+1' : '+61'
    return [
      { phone_number: `${prefix} (415) 555-0132`, locality: 'San Francisco', country_code: c.code, number_type: 'local',     sms: true, voice: true, price_usd: 1.50 },
      { phone_number: `${prefix} (212) 555-0177`, locality: 'New York',      country_code: c.code, number_type: 'local',     sms: true, voice: true, price_usd: 1.50 },
      { phone_number: `${prefix} 800 555-0100`,   locality: 'Toll-free',     country_code: c.code, number_type: 'toll_free', sms: true, voice: true, price_usd: 2.50 },
      { phone_number: `${prefix} (650) 555-0199`, locality: 'Palo Alto',     country_code: c.code, number_type: 'local',     sms: true, voice: false, price_usd: 1.50 },
    ]
  },

  confirmBuy(n) {
    this.selectedNumber = n
    this.callView = 'buy-confirm'
  },

  async buyNumber() {
    this.busy = true
    try {
      // Backend route to be added: POST /api/numbers/buy
      await new Promise(r => setTimeout(r, 500))
      this.myNumbers.push({
        id: Date.now(),
        phone_number: this.selectedNumber.phone_number,
        country_code: this.selectedNumber.country_code,
        number_type: this.selectedNumber.number_type,
      })
      this.user.balance_usd -= this.selectedNumber.price_usd
      this.toast('Number purchased! 🎉', 'success')
      this.callView = 'main'
      this.callTab = 'numbers'
      this.selectedNumber = null
    } catch (e) {
      this.toast(e.message, 'error')
    } finally {
      this.busy = false
    }
  },

  /* -------- helpers -------- */
  async copyText(text) {
    try {
      await navigator.clipboard.writeText(text)
      this.toast('Copied', 'success')
    } catch { this.toast('Copy failed', 'error') }
  },
})
