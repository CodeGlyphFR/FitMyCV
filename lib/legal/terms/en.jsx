export default function TermsContentEN() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <p className="text-xs text-white/60 mb-4 drop-shadow">
        Last updated: {new Date().toLocaleDateString('en-US')}
      </p>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          1. Acceptance of Terms
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          By using FitMyCv.ai and making a credit purchase or subscribing to a plan, you unconditionally accept these Terms of Service.
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          If you do not accept these terms, please do not use our paid services.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          2. Service Description
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          FitMyCv.ai offers two types of paid services:
        </p>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          2.1. Credits (one-time payments)
        </h3>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Credits allow you to use premium features on a pay-per-use basis. One credit = one use of a premium feature. Credits do not expire and remain valid as long as your account is active.
        </p>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          2.2. Subscriptions (recurring payments)
        </h3>
        <p className="text-sm text-white/90 drop-shadow">
          Subscriptions provide access to a defined number of monthly uses depending on the chosen plan (Free, Pro, Premium). Usage limits are reset at each billing period.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          3. Pricing and Payments
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          All prices are displayed in euros (<strong>including VAT</strong>) and include all applicable taxes.
        </p>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Payments are secured by <strong>Stripe</strong> and accept credit cards, Apple Pay, Google Pay, and other payment methods depending on your location.
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          Subscriptions are automatically renewed at the end of each period (monthly or annual) unless cancelled by you.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          4. Right of Withdrawal (14 days)
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          In accordance with French consumer protection legislation, you have a <strong>14-day withdrawal period</strong> from your purchase or subscription, <strong>provided you have not used the service</strong>.
        </p>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          If you have used credits or generated CVs during this period, the right of withdrawal is <strong>void</strong> and no refund will be issued.
        </p>
        <div className="mt-3 p-3 bg-orange-500/20 backdrop-blur-sm rounded">
          <p className="text-sm text-white drop-shadow">
            <strong>Important:</strong> To exercise your right of withdrawal, contact us at the email address below <strong>before any use of the service</strong>.
          </p>
        </div>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          5. Refund Policy
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          <strong>No refunds</strong> are issued once the service has been used (CV generation, credit usage, etc.).
        </p>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          In case of technical issues preventing service use, contact our support. We will review your case individually.
        </p>
        <div className="mt-3 p-3 bg-red-500/20 backdrop-blur-sm rounded">
          <p className="text-sm text-white drop-shadow">
            <strong>No refunds:</strong> All purchases are final after service use. By making a purchase, you acknowledge having read and accepted this clause.
          </p>
        </div>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          6. Chargebacks and Banking Disputes
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          In case of a <strong>chargeback</strong> (payment dispute with your bank) after using the service:
        </p>
        <ul className="list-disc list-inside text-sm text-white/90 space-y-1 drop-shadow">
          <li><strong>For credits:</strong> The disputed credit amount will be deducted from your balance, which may become negative. You will need to top up your account to continue using the service.</li>
          <li><strong>For subscriptions:</strong> Your subscription will be immediately cancelled and you will be downgraded to the Free plan.</li>
        </ul>
        <div className="mt-3 p-3 bg-orange-500/20 backdrop-blur-sm rounded">
          <p className="text-sm text-white drop-shadow">
            <strong>Warning:</strong> Abusive chargebacks may result in permanent account suspension.
          </p>
        </div>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          7. Subscription Modification and Cancellation
        </h2>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          7.1. Subscription Upgrade
        </h3>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          You can upgrade your subscription at any time (e.g., Free → Pro, Monthly → Annual). The amount will be calculated pro-rata based on the remaining time on your current period. The new billing cycle starts immediately.
        </p>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          7.2. Subscription Downgrade
        </h3>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          You can downgrade your subscription (e.g., Premium → Pro). The change will take effect at the <strong>next billing date</strong> without pro-rata refund for the current period.
        </p>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          <strong>Restriction:</strong> Downgrading from an annual to a monthly subscription is not permitted. You must cancel your annual subscription and subscribe to a new monthly plan after expiration.
        </p>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          7.3. Subscription Cancellation
        </h3>
        <p className="text-sm text-white/90 drop-shadow">
          You can cancel your subscription at any time from your account. The cancellation takes effect at the <strong>end of the current billing period</strong>. You retain access to premium features until that date.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          8. Intellectual Property
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          The CVs you create via FitMyCv.ai belong to you. You retain all rights to the content you provide.
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          The interface, source code, algorithms, and all elements of FitMyCv.ai are the exclusive property of the publisher and are protected by copyright.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          9. Limitation of Liability
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          FitMyCv.ai strives to provide a quality service but does not guarantee:
        </p>
        <ul className="list-disc list-inside text-sm text-white/90 space-y-1 drop-shadow">
          <li>The absence of interruptions or technical errors</li>
          <li>Compatibility of generated CVs with all ATS (Applicant Tracking Systems)</li>
          <li>Obtaining an interview or employment following use of the service</li>
        </ul>
        <p className="text-sm text-white/90 mt-2 drop-shadow">
          Our liability is limited to the amount you have paid for the service in the last 12 months.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          10. Modification of Terms
        </h2>
        <p className="text-sm text-white/90 drop-shadow">
          We reserve the right to modify these Terms at any time. Modifications will be posted on this page with the update date. Continued use of the service after modification constitutes acceptance of the new terms.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          11. Applicable Law and Jurisdiction
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          These Terms are governed by <strong>French law</strong>.
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          In case of dispute, and after an attempt at amicable resolution, the courts of <strong>Paris</strong> shall have exclusive jurisdiction.
        </p>
      </section>

      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          12. Legal Information
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Publisher of FitMyCv.ai service:
        </p>
        <div className="mt-3 p-3 bg-sky-500/20 backdrop-blur-sm rounded">
          <p className="text-white drop-shadow space-y-1">
            <strong>Name:</strong> [To be completed]<br />
            <strong>Status:</strong> Micro-enterprise<br />
            <strong>SIRET:</strong> [To be completed]<br />
            <strong>Address:</strong> [To be completed]<br />
            <strong>Email:</strong> [To be completed]
          </p>
        </div>
        <div className="mt-3 p-3 bg-emerald-500/20 backdrop-blur-sm rounded">
          <p className="text-sm text-white drop-shadow">
            For any questions regarding these Terms, contact us at the email address above.
          </p>
        </div>
      </section>
    </div>
  );
}
