/* =========================================================
   3T Dial — Auth flow (signup, verify, login)
   ========================================================= */

Object.assign(window.App, {

  async doSignup() {
    this.busy = true
    try {
      const f = this.signupForm
      await this.api('/signup', { method: 'POST', body: JSON.stringify(f) })
      this.pendingEmail = f.email
      this.pendingPhone = f.phone
      this.signupForm = { name: '', email: '', phone: '', password: '', confirm_password: '' }
      this.toast('Account created. Check email and SMS.', 'success')
      this.go('verify')
    } catch (e) {
      this.toast(e.message, 'error')
    } finally {
      this.busy = false
    }
  },

  async doLogin() {
    this.busy = true
    try {
      const { user } = await this.api('/login', {
        method: 'POST',
        body: JSON.stringify(this.loginForm),
      })
      this.user = user
      this.loginForm = { identifier: '', password: '' }
      this.toast('Welcome back to 3T Dial', 'success')
      this.go('calls')
    } catch (e) {
      this.toast(e.message, 'error')
    } finally {
      this.busy = false
    }
  },

  async verifyEmail() {
    if (!this.otpEmail) return
    this.busy = true
    try {
      await this.api('/verify/email', {
        method: 'POST',
        body: JSON.stringify({ email: this.pendingEmail, otp: this.otpEmail }),
      })
      this.emailVerified = true
      this.toast('Email verified', 'success')
    } catch (e) {
      this.toast(e.message, 'error')
    } finally {
      this.busy = false
    }
  },

  async verifyPhone() {
    if (!this.otpPhone) return
    this.busy = true
    try {
      await this.api('/verify/phone', {
        method: 'POST',
        body: JSON.stringify({ phone: this.pendingPhone, otp: this.otpPhone }),
      })
      this.phoneVerified = true
      this.toast('Phone verified', 'success')
    } catch (e) {
      this.toast(e.message, 'error')
    } finally {
      this.busy = false
    }
  },

  async resendEmail() {
    try {
      await this.api('/resend/email-otp', {
        method: 'POST',
        body: JSON.stringify({ identifier: this.pendingEmail }),
      })
      this.toast('Email code sent', 'success')
    } catch (e) { this.toast(e.message, 'error') }
  },

  async resendPhone() {
    try {
      await this.api('/resend/phone-otp', {
        method: 'POST',
        body: JSON.stringify({ identifier: this.pendingPhone }),
      })
      this.toast('SMS code sent', 'success')
    } catch (e) { this.toast(e.message, 'error') }
  },
})
