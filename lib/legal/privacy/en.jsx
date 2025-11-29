export default function PrivacyContentEN() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <p className="text-xs text-white/60 mb-4 drop-shadow">
        Last updated: {new Date().toLocaleDateString('en-US')}
      </p>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          1. Introduction
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          This privacy policy describes how FitMyCv.ai collects, uses, stores, and protects your personal data in accordance with the General Data Protection Regulation (GDPR) and applicable French legislation.
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          We are committed to protecting your privacy and processing your personal data in a transparent, secure, and compliant manner.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          2. Data Controller
        </h2>
        <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
          <p className="text-sm text-white/90 drop-shadow">
            <strong>Data Controller:</strong> FitMyCv.ai<br />
            <strong>Contact:</strong> [To be completed with your email address]
          </p>
        </div>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          3. Data Collected
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          We collect the following data:
        </p>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          3.1. Identification Data
        </h3>
        <ul className="list-disc list-inside mb-3 text-sm text-white/90 space-y-1 drop-shadow">
          <li>Full name</li>
          <li>Email address</li>
          <li>Password (encrypted)</li>
          <li>Profile picture (if provided via OAuth)</li>
        </ul>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          3.2. CV Data
        </h3>
        <ul className="list-disc list-inside mb-3 text-sm text-white/90 space-y-1 drop-shadow">
          <li>Professional information (experience, education, skills)</li>
          <li>Contact details (phone, address, professional links)</li>
          <li>Uploaded documents (PDF CVs, job offers)</li>
        </ul>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          3.3. Connection Data
        </h3>
        <ul className="list-disc list-inside mb-3 text-sm text-white/90 space-y-1 drop-shadow">
          <li>IP address</li>
          <li>Browser type</li>
          <li>Pages visited and time spent</li>
          <li>Session data</li>
        </ul>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          3.4. Cookies
        </h3>
        <p className="text-sm text-white/90 drop-shadow">
          See our <a href="/cookies" className="text-emerald-300 underline hover:text-emerald-200 transition-colors">cookie management page</a> for more details.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          4. Processing Purposes
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Your data is used for the following purposes:
        </p>
        <ul className="list-disc list-inside text-sm text-white/90 space-y-1 drop-shadow">
          <li><strong>User account management</strong>: creation, authentication, profile management</li>
          <li><strong>Service provision</strong>: creation, storage, and generation of personalized CVs</li>
          <li><strong>Service improvement</strong>: usage analysis, bug fixes, new feature development</li>
          <li><strong>Communication</strong>: service notifications, user support, feedback responses</li>
          <li><strong>Security</strong>: fraud prevention, abuse detection, data protection</li>
        </ul>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          5. Legal Basis for Processing
        </h2>
        <ul className="list-disc list-inside text-sm text-white/90 space-y-1 drop-shadow">
          <li><strong>Contract execution</strong>: provision of CV creation service</li>
          <li><strong>Consent</strong>: non-essential cookies, newsletters (if applicable)</li>
          <li><strong>Legitimate interest</strong>: service improvement, security</li>
          <li><strong>Legal obligation</strong>: data retention for tax obligations</li>
        </ul>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          6. Retention Period
        </h2>
        <ul className="list-disc list-inside text-sm text-white/90 space-y-1 drop-shadow">
          <li><strong>Active account</strong>: as long as the account exists</li>
          <li><strong>Deleted account</strong>: 30 days after deletion (cooling-off period)</li>
          <li><strong>Consent cookies</strong>: 6 months</li>
          <li><strong>Session cookies</strong>: 30 days</li>
          <li><strong>Connection logs</strong>: 12 months maximum</li>
        </ul>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          7. Data Sharing
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Your personal data is <strong>never sold</strong>. It may only be shared with:
        </p>
        <ul className="list-disc list-inside text-sm text-white/90 space-y-1 drop-shadow">
          <li><strong>Service providers</strong>: hosting (cloud infrastructure), authentication (NextAuth, OAuth providers), AI (OpenAI for CV generation)</li>
          <li><strong>Legal authorities</strong>: if required by law or to protect our rights</li>
        </ul>

        <div className="mt-3 p-3 bg-sky-500/20 backdrop-blur-sm rounded">
          <p className="text-sm text-white drop-shadow">
            <strong>Important:</strong> Your CV data is sent to OpenAI (GPT model) for generation and adaptation. OpenAI states that it does not use API data to train its models. For more information: <a href="https://openai.com/enterprise-privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200 transition-colors">OpenAI Privacy Policy</a>
          </p>
        </div>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          8. Data Security
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          We implement the following security measures:
        </p>
        <ul className="list-disc list-inside text-sm text-white/90 space-y-1 drop-shadow">
          <li><strong>Encryption</strong>: AES-256-GCM for all stored CVs</li>
          <li><strong>HTTPS</strong>: secure communication (SSL/TLS)</li>
          <li><strong>Password hashing</strong>: bcrypt with salt</li>
          <li><strong>CSRF protection</strong>: anti-forgery tokens</li>
          <li><strong>Secure cookies</strong>: HttpOnly, Secure, SameSite</li>
          <li><strong>Secure authentication</strong>: JWT, session tokens</li>
          <li><strong>Anti-spam protection</strong>: Google reCAPTCHA v3 to prevent abuse</li>
        </ul>

        <div className="mt-3 p-3 bg-sky-500/20 backdrop-blur-sm rounded">
          <p className="text-sm text-white drop-shadow">
            <strong>reCAPTCHA Protection:</strong> This site is protected by reCAPTCHA and Google's <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200 transition-colors">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200 transition-colors">Terms of Service</a> apply.
          </p>
        </div>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          9. Your Rights (GDPR)
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Under the GDPR, you have the following rights:
        </p>
        <ul className="list-disc list-inside text-sm text-white/90 space-y-1 drop-shadow">
          <li><strong>Right of access</strong>: view your personal data</li>
          <li><strong>Right to rectification</strong>: correct inaccurate data</li>
          <li><strong>Right to erasure</strong>: delete your data ("right to be forgotten")</li>
          <li><strong>Right to restriction</strong>: restrict processing of your data</li>
          <li><strong>Right to data portability</strong>: receive your data in a structured format</li>
          <li><strong>Right to object</strong>: object to processing on legitimate grounds</li>
          <li><strong>Right to withdraw consent</strong>: at any time</li>
        </ul>

        <div className="mt-3 p-3 bg-emerald-500/20 backdrop-blur-sm rounded">
          <p className="text-sm text-white drop-shadow">
            To exercise your rights, contact us at: <strong>[email to be completed]</strong>
          </p>
        </div>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          10. International Transfers
        </h2>
        <p className="text-sm text-white/90 drop-shadow">
          Your data may be transferred and stored outside the European Union (particularly via OpenAI based in the United States). These transfers are governed by appropriate safeguards (standard contractual clauses, certifications).
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          11. Policy Modifications
        </h2>
        <p className="text-sm text-white/90 drop-shadow">
          We reserve the right to modify this privacy policy at any time. Modifications will be posted on this page with the update date. We encourage you to review this page regularly.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          12. Complaints
        </h2>
        <p className="text-sm text-white/90 drop-shadow">
          If you believe your rights are not being respected, you can file a complaint with the CNIL (French Data Protection Authority):
        </p>
        <div className="mt-3 p-3 bg-white/10 backdrop-blur-sm rounded">
          <p className="text-sm text-white/90 drop-shadow">
            <strong>CNIL</strong><br />
            3 Place de Fontenoy - TSA 80715<br />
            75334 PARIS CEDEX 07<br />
            Phone: 01 53 73 22 22<br />
            Website: <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200 transition-colors">www.cnil.fr</a>
          </p>
        </div>
      </section>

      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          13. Contact
        </h2>
        <p className="text-sm text-white/90 drop-shadow">
          For any questions regarding this privacy policy or your personal data, contact us at:
        </p>
        <div className="mt-3 p-3 bg-sky-500/20 backdrop-blur-sm rounded">
          <p className="text-white drop-shadow">
            <strong>Email:</strong> [To be completed]<br />
            <strong>Address:</strong> [To be completed]
          </p>
        </div>
      </section>
    </div>
  );
}
