import { Link } from 'react-router-dom';
import LegalLayout, { Section } from '../components/common/LegalLayout';

// /privacy — Privacy Policy (India DPDP Act 2023 + DPDP Rules 2025, and GDPR).
const Mail = () => <a href="mailto:team@timewheel.co.in" className="text-primary hover:underline">team@timewheel.co.in</a>;

const USE_ROWS = [
  ['Provide the Platform', 'Create accounts, publish services, process bookings, generate meeting links', 'Performance of a contract; consent (DPDP)'],
  ['Payments', 'Process guest payments via Razorpay, remit host payments, maintain financial records', 'Contract; legal obligation'],
  ['Verification & security', 'Send OTPs, prevent fraud, secure accounts', 'Legitimate interests; consent'],
  ['Host verification & payouts', 'Verify host identity (PAN, bank, address, KYC), set up the Razorpay payout account, deduct and deposit TDS/TCS', 'Legal obligation; contract'],
  ['Communications', 'Booking confirmations, reminders, reschedule notices, password resets', 'Contract; consent'],
  ['Marketing', 'Email/WhatsApp campaigns and offers (only if you opt in)', 'Consent'],
  ['Reviews & ratings', 'Display feedback on host profiles', 'Contract; legitimate interests'],
  ['Legal & accounting', 'Tax, GST, double-entry financial records, dispute handling', 'Legal obligation'],
  ['Analytics & advertising', 'Product & session analytics (including session replay), troubleshooting, feature development, and — with your consent — measuring ad campaigns', 'Consent; legitimate interests'],
];

const Privacy = () => (
  <LegalLayout
    title="Privacy Policy"
    updated="12 August 2026"
    current="/privacy"
    description="How Meeticulous collects, uses, and protects your data under India's DPDP Act 2023 and GDPR. Read our full privacy policy."
    intro={
      <>
        <p>
          This Privacy Policy explains how <strong>Timewheel Internet Private Limited</strong> (CIN:
          U62012OD2026PTC052654, GSTIN: 21AAMCT8270C1ZF) ("Meeticulous", "we", "us", or "our"), a company incorporated
          in India under the Companies Act, 2013 with its registered office at <strong>Ground Floor, Holding No-55,
          Ward No-19, Natapada, Jajpur Road, Byasanagar, District Jajpur, Odisha – 755019, India</strong>, collects,
          uses, shares, and protects your personal data when you use the Meeticulous platform, website, and related
          services (the "Platform").
        </p>
        <p>
          We are committed to processing your personal data in accordance with India's <strong>Digital Personal Data
          Protection Act, 2023 (DPDP Act)</strong> and the <strong>Digital Personal Data Protection Rules, 2025 (DPDP
          Rules)</strong>, and, where it applies, the EU <strong>General Data Protection Regulation (GDPR)</strong>.
          Under the DPDP Act we act as the <strong>Data Fiduciary</strong> that decides how and why your personal data
          is processed, and you are the <strong>Data Principal</strong> the data relates to.
        </p>
        <p>
          We provide this Policy in English. If you would like it in any other language listed in the Eighth Schedule to
          the Constitution of India, please contact our Grievance Officer (Section 11).
        </p>
        <p>
          By using the Platform you acknowledge that you have read and understood this Policy. If you do not agree with
          it, please do not use the Platform.
        </p>
      </>
    }
  >
    <Section title="1. Who this Policy applies to">
      <p>The Platform serves two main types of users, and we collect data from both:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Hosts (creators)</strong> — individuals or businesses who publish services, accept bookings, sell digital products, and receive payments for them.</li>
        <li><strong>Guests</strong> — individuals who discover hosts, book appointments, buy products, and make payments. Guests may book either by creating an account or by verifying their email through a one-time password (OTP) without an account.</li>
      </ul>
      <p>This Policy also applies to visitors who browse public host profiles without booking.</p>
    </Section>

    <Section title="2. The personal data we collect">
      <p className="font-medium text-ink">2.1 Data you provide directly</p>
      <p><strong>Account &amp; profile data (Hosts and registered Guests):</strong> name, email address, role (host/guest), username, bio, tagline, profession, profile and cover images, and social media links.</p>
      <p><strong>Booking data (Guests):</strong> name, email address, phone number, the service booked, the scheduled date and time, and any notes you add to a booking. Guests booking without an account provide name, email, and phone at checkout. For a paid booking we also collect the billing details you enter for your GST invoice.</p>
      <p><strong>Host verification data (Hosts):</strong> to pay you and to meet our legal obligations, we collect your <strong>PAN</strong>, <strong>bank account details</strong>, and <strong>registered address</strong>, and optionally your <strong>Aadhaar</strong> and identity documents. These are stored <strong>encrypted</strong>, in a private store, and are used for KYC, for tax deducted/collected at source (TDS/TCS), and to set up your <strong>Razorpay payout (linked) account</strong>.</p>
      <p><strong>Verification data:</strong> one-time passwords (OTPs) sent to your email for booking confirmation, login, or password reset. OTPs are short-lived and stored only until they expire.</p>
      <p><strong>Reviews:</strong> the rating, comment, and display name you submit after a completed booking.</p>
      <p><strong>Communications:</strong> messages, support requests, and feedback you send us.</p>
      <p className="font-medium text-ink pt-1">2.2 Data we collect automatically</p>
      <p><strong>Usage and device data:</strong> when you use the Platform we may collect log data such as IP address, browser type, device information, pages visited, and timestamps.</p>
      <p><strong>Cookies and similar technologies:</strong> see Section 8.</p>
      <p className="font-medium text-ink pt-1">2.3 Data from third parties</p>
      <p><strong>Payment data:</strong> when you pay, our payment processor <strong>Razorpay</strong> collects and processes your card, UPI, netbanking, or wallet details. We do <strong>not</strong> receive or store your full payment instrument details. We only receive a transaction reference (e.g. a Razorpay payment ID), the amount, and the payment status. See Section 6.</p>
      <p><strong>Google Calendar (Hosts only):</strong> if a host connects Google Calendar, we receive OAuth access and refresh tokens to read availability and create calendar events / meeting links on the host's behalf. We use these tokens only to provide the calendar and meeting-scheduling features.</p>
      <p>Meeticulous's use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements. We do not use Google Calendar data for advertising, do not sell it, and do not transfer it to third parties except as necessary to provide the booking and scheduling features, to comply with applicable law, or as part of a merger or acquisition.</p>
      <p><strong>Image storage:</strong> images you upload (profile, cover, product, and service images) are stored and served through <strong>Supabase Storage</strong>.</p>
      <p className="font-medium text-ink pt-1">2.4 Marketing &amp; contact data</p>
      <p>If you opt in, we maintain contact records (email, phone, name, contact type) to send campaigns and notifications. We track your email and WhatsApp opt-in/opt-out status and honour suppression requests.</p>
      <p>We do not knowingly collect special-category data and ask that you do not submit it through the Platform.</p>
    </Section>

    <Section title="3. How we use your data and our legal basis">
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-ink border-b border-gray-200">
              <th className="py-2 pr-3 font-semibold">Purpose</th>
              <th className="py-2 pr-3 font-semibold">Examples</th>
              <th className="py-2 font-semibold">Legal basis (DPDP / GDPR)</th>
            </tr>
          </thead>
          <tbody>
            {USE_ROWS.map(([p, e, b]) => (
              <tr key={p} className="border-b border-gray-100 align-top">
                <td className="py-2 pr-3 font-medium text-gray-700">{p}</td>
                <td className="py-2 pr-3">{e}</td>
                <td className="py-2">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pt-1">We will not use your personal data for a materially different purpose without informing you and, where required, obtaining your consent.</p>
    </Section>

    <Section title="4. How we share your data">
      <p>We share personal data only as needed to run the Platform:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Between hosts and guests.</strong> When you book a service, the host receives your name, email, phone, scheduled time, and booking notes so they can deliver the service. Hosts must use this data only to fulfil the booking. Hosts on our <strong>Studio</strong> plan have a client-management tool that lets them see and <strong>export as a CSV the contact details of guests who have booked them</strong> — name, phone, email, and booking history — to manage their own client relationships.</li>
        <li><strong>Service providers (processors)</strong> who act on our instructions:
          <ul className="list-disc pl-5 pt-1 space-y-1">
            <li><strong>Razorpay</strong> — payment collection and, via Razorpay Route, host payouts (including host KYC / linked-account onboarding).</li>
            <li><strong>Supabase</strong> — database, authentication, and file/image storage.</li>
            <li><strong>Google</strong> — calendar and meeting links (for Hosts who connect Google).</li>
            <li><strong>Email (SMTP provider)</strong> — transactional and campaign email.</li>
            <li><strong>AiSensy</strong> — WhatsApp notifications and campaigns.</li>
            <li><strong>Analytics &amp; usability</strong> — PostHog (product analytics), Google Analytics 4 and Google Tag Manager, and Microsoft Clarity, which records anonymised session activity (a &ldquo;session replay&rdquo; of clicks, scrolls, and pages). These load per your consent choices (Section 8), except essential product analytics.</li>
            <li><strong>Advertising measurement</strong> — the Meta (Facebook) Pixel and Conversions API and Google Ads. To measure ad campaigns we may send <strong>hashed (irreversible) identifiers</strong>, such as a SHA-256 hash of your email or phone number, to Meta and Google.</li>
            <li><strong>Error monitoring</strong> — Sentry, to detect and diagnose faults.</li>
            <li><strong>AI features</strong> — Anthropic (Claude) powers the &ldquo;Bolt&rdquo; support assistant and AI writing help, and Voyage AI generates search embeddings; text you enter into those features (including support-chat messages and listing content) is processed by them.</li>
          </ul>
        </li>
        <li><strong>Legal and regulatory authorities</strong> when required by law, court order, or to protect our rights, users, or the public.</li>
        <li><strong>Business transfers</strong> — in connection with a merger, acquisition, or sale of assets, subject to this Policy.</li>
      </ul>
      <p>We do <strong>not</strong> sell your personal data.</p>
      <p>Some of our processors may store or process data outside India. Where personal data is transferred outside India, we do so subject to any requirements or restrictions the Central Government may specify under the DPDP Act and DPDP Rules, and, for EU data, using GDPR-compliant transfer mechanisms.</p>
    </Section>

    <Section title="5. Data retention">
      <p>We keep personal data only for as long as necessary for the purposes described in this Policy:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Account and profile data</strong> — while your account is active and for a reasonable period afterwards.</li>
        <li><strong>Booking, payment, and financial records</strong> — retained as long as required to meet tax, accounting, and legal obligations under Indian law.</li>
        <li><strong>OTPs</strong> — deleted shortly after they expire.</li>
        <li><strong>Marketing contact data</strong> — until you withdraw consent or opt out.</li>
        <li><strong>Processing and security logs</strong> — retained for at least one year, as required by the DPDP Rules and to detect, investigate, and prevent unauthorised access.</li>
      </ul>
      <p>When data is no longer needed and our legal retention periods have passed, we delete or anonymise it. You can also ask us to erase your data (Section 7); we action erasure requests manually after verifying your identity, subject to records we are required by law to keep.</p>
    </Section>

    <Section title="6. Payments and PCI-DSS">
      <p>
        All payments on the Platform are processed by <strong>Razorpay</strong>, a PCI-DSS compliant payment gateway.
        Your card, UPI, netbanking, and wallet details are entered directly with Razorpay and are governed by{' '}
        <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Razorpay's privacy policy</a>.
        Meeticulous does not collect, see, or store your full payment credentials. We retain only transaction metadata
        (payment ID, amount, status) needed to confirm bookings, remit host payments, and keep accurate financial records.
      </p>
    </Section>

    <Section title="7. Your rights">
      <p className="font-medium text-ink">7.1 Under the DPDP Act (all users in India)</p>
      <p>As a Data Principal you have the right to: access a summary of the personal data we process about you and the processing activities; request correction, completion, or updating of inaccurate or incomplete data; request erasure of data that is no longer needed for the purpose it was collected; nominate another person to exercise your rights in the event of death or incapacity; and readily available means of grievance redressal (Section 11).</p>
      <p>You may withdraw your consent at any time, and withdrawing it will be as easy as giving it; this does not affect processing carried out before withdrawal. Where a registered Consent Manager is available, you may also give, manage, review, and withdraw your consent through it.</p>
      <p>If you are not satisfied with how we handle your request or grievance, you may make a complaint to the <strong>Data Protection Board of India</strong>.</p>
      <p className="font-medium text-ink pt-1">7.2 Under the GDPR (users in the EU/EEA)</p>
      <p>If you are in the EU/EEA, you also have the right to data portability, the right to object to or restrict processing, the right not to be subject to solely automated decisions with legal effects, and the right to lodge a complaint with your local supervisory authority.</p>
      <p className="font-medium text-ink pt-1">7.3 How to exercise your rights</p>
      <p>Contact us at <Mail /> (or the Grievance Officer in Section 11). We will respond within the timeframes required by applicable law and, for grievances, within <strong>90 days</strong> as required by the DPDP Rules. We may ask you to verify your identity before acting on a request.</p>
    </Section>

    <Section title="8. Cookies and tracking">
      <p>We use cookies and similar technologies to:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Keep you signed in</strong> — authentication tokens and session cookies are essential for the Platform to work.</li>
        <li><strong>Remember preferences</strong> — such as theme and settings.</li>
        <li><strong>Understand usage</strong> — product analytics (PostHog) and, subject to your consent, Google Analytics 4 and Google Tag Manager.</li>
        <li><strong>Improve usability</strong> — Microsoft Clarity, subject to your consent, records anonymised session activity (a &ldquo;session replay&rdquo; of clicks, scrolls, and page views) to help us find and fix problems.</li>
        <li><strong>Measure advertising</strong> — subject to your consent, the Meta Pixel and Google Ads tags; and, on our servers, we may send hashed identifiers to Meta and Google to measure conversions.</li>
      </ul>
      <p>Essential cookies cannot be switched off. Non-essential analytics, session-replay, and advertising technologies load <strong>only after you accept them</strong> in our consent banner; you can change your choice at any time, and you can also control cookies through your browser. Blocking some cookies may affect how the Platform works.</p>
    </Section>

    <Section title="9. Data security">
      <p>
        We use technical and organisational measures to protect your data, including encrypted connections (HTTPS),
        encryption or obfuscation of stored data where appropriate, access controls, row-level security on our database,
        restricted administrative access, monitoring and logging to detect unauthorised access, backups, contractual
        security obligations on our processors, and storing payment data only with our PCI-DSS compliant processor. No
        method of transmission or storage is completely secure, so we cannot guarantee absolute security. If a personal
        data breach occurs, we will intimate each affected Data Principal without delay, and notify the Data Protection
        Board of India without delay and provide a detailed report within <strong>72 hours</strong> of becoming aware of
        the breach, as required by the DPDP Act and DPDP Rules.
      </p>
    </Section>

    <Section title="10. Children">
      <p>
        The Platform is not intended for children under the age of 18. We do not knowingly process a child's personal
        data without verifiable consent from a parent or lawful guardian as required by the DPDP Act. We do not carry
        out tracking, behavioural monitoring, profiling, or targeted advertising directed at children. If you believe a
        child has provided us data, contact us and we will delete it.
      </p>
    </Section>

    <Section title="11. Grievance Officer and contact">
      <p>In accordance with the DPDP Act and applicable Indian law, you may contact our Grievance Officer for any concern about your personal data:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Grievance Officer:</strong> Shubham Narendra Datarkar</li>
        <li><strong>Email:</strong> <Mail /></li>
        <li><strong>Phone:</strong> +91 8637758344</li>
        <li><strong>Registered office:</strong> Ground Floor, Holding No-55, Ward No-19, Natapada, Jajpur Road, Byasanagar, District Jajpur, Odisha – 755019, India</li>
        <li><strong>Operations office:</strong> #6, 2nd Floor, Eureka Coworking, Mate Square, Nagpur, Maharashtra</li>
      </ul>
      <p>We will acknowledge and address grievances within the time required by the DPDP Rules (currently <strong>90 days</strong>). For GDPR matters, you may also contact us at the same email. If you are unsatisfied with our response, you may escalate to the Data Protection Board of India or your local data protection authority.</p>
    </Section>

    <Section title="12. Changes to this Policy">
      <p>
        We may update this Policy from time to time. We will post the revised version with a new "Last updated" date
        and, for material changes, provide additional notice. Your continued use of the Platform after changes take
        effect means you accept the updated Policy.
      </p>
    </Section>
  </LegalLayout>
);

export default Privacy;
