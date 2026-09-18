/* =========================================================
   3T Dial — Profile: About / Pricing / Terms / Privacy views
   ========================================================= */

const DOCS = {
  about: `
    <p><b>3T Dial</b> gives you global virtual phone numbers with real two-way calling, SMS, and voicemail — all accessible from your browser or the Android app.</p>
    <p>Our network runs on carrier-grade infrastructure, delivering reliable connectivity across 100+ countries.</p>
    <h3>Why 3T Dial</h3>
    <ul>
      <li>Real two-way calls & SMS on every number</li>
      <li>Instant activation — no contracts</li>
      <li>Voicemail with playback</li>
      <li>Wallet-based pay-as-you-go pricing</li>
      <li>Works on web and Android from one account</li>
    </ul>
    <h3>About Tech Talk Titans</h3>
    <p>3T Dial is a product of <b>Tech Talk Titans</b>, building modern communication tools for a connected world.</p>
    <p class="muted small" style="margin-top:24px">Stay Connected Globally.</p>
  `,

  pricing: `
    <h3>Pay-as-you-go</h3>
    <p class="muted">All prices in USD. Billed per second / per message. No monthly minimum.</p>
    <table class="pricing-table">
      <tbody>
        <tr><td>Number rental (US local)</td><td>$1.50 / month</td></tr>
        <tr><td>Number rental (UK local)</td><td>$2.00 / month</td></tr>
        <tr><td>Number rental (Toll-free)</td><td>$2.50 / month</td></tr>
        <tr><td>Inbound call</td><td>$0.010 / min</td></tr>
        <tr><td>Outbound call (US)</td><td>$0.015 / min</td></tr>
        <tr><td>Outbound call (Intl)</td><td>$0.045 / min</td></tr>
        <tr><td>Inbound SMS</td><td>$0.005 / SMS</td></tr>
        <tr><td>Outbound SMS (US)</td><td>$0.010 / SMS</td></tr>
        <tr><td>Outbound SMS (Intl)</td><td>$0.045 / SMS</td></tr>
        <tr><td>Voicemail</td><td>$0.008 / min</td></tr>
      </tbody>
    </table>
    <p class="muted small">Prices shown are indicative and may vary by country. Final prices are shown at checkout before purchase.</p>
  `,

  terms: `
    <h3>1. Acceptance</h3>
    <p>By creating a 3T Dial account you agree to these Terms of Service and our Privacy Policy.</p>
    <h3>2. Acceptable use</h3>
    <p>You may not use our numbers for spam, harassment, fraud, robocalls, or any activity that violates local law or carrier policy. We reserve the right to suspend numbers on abuse reports.</p>
    <h3>3. Payments</h3>
    <p>All balances are prepaid in USD and non-refundable once spent. Charges are deducted in real time from your wallet.</p>
    <h3>4. Number rental</h3>
    <p>Number rentals renew monthly from your wallet balance. If your wallet has insufficient funds, the number may be released after a grace period.</p>
    <h3>5. Service availability</h3>
    <p>We aim for high uptime but do not guarantee uninterrupted service. Third-party carriers may occasionally affect delivery.</p>
    <h3>6. Termination</h3>
    <p>You may close your account at any time. We may suspend accounts that violate these terms.</p>
    <h3>7. Contact</h3>
    <p>For questions about these terms, contact support.</p>
  `,

  privacy: `
    <h3>What we collect</h3>
    <p>Name, email, phone number, password hash, and usage metadata (calls, SMS, wallet transactions).</p>
    <h3>How we use it</h3>
    <p>Solely to operate the service, verify your identity, prevent fraud, and process payments.</p>
    <h3>Third parties</h3>
    <p>We share the minimum required with our telecom carrier (Telnyx), payment processor, and SMTP provider. We never sell your data.</p>
    <h3>Data retention</h3>
    <p>Call recordings and voicemails are retained while a number is active, plus 30 days after release.</p>
    <h3>Your rights</h3>
    <p>You may request export or deletion of your data at any time by contacting support.</p>
    <h3>Contact</h3>
    <p class="muted small">3T Dial — A Product of Tech Talk Titans.</p>
  `,
}

const DOC_TITLES = {
  about:   'About Us',
  pricing: 'Pricing',
  terms:   'Terms of Service',
  privacy: 'Privacy Policy',
}

Object.assign(window.App, {
  profileView: 'main',   // main | about | pricing | terms | privacy

  docTitle()   { return DOC_TITLES[this.profileView] || '' },
  docContent() { return DOCS[this.profileView] || '' },
})
