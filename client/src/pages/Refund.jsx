import { Link } from 'react-router-dom';
import LegalLayout, { Section, MARKETPLACE_EFFECTIVE } from '../components/common/LegalLayout';

// /refund — Refund & Cancellation Policy.
//
// MARKETPLACE MODEL v4: the host is the seller, and Meeticulous FACILITATES refunds and
// grievance redressal under the Consumer Protection (E-Commerce) Rules, 2020 — the guest
// can still claim from us. Consumer rights are preserved.
//
// RECONCILED TO PRODUCT (main, Aug 2026): there is NO automated guest-refund code — refunds
// are assessed and issued MANUALLY by our team (Razorpay dashboard). The tiers below are the
// POLICY we apply on review, not an automatic engine. FLAG for founder+lawyer: checkout
// currently shows "Free to cancel" and does NOT mark the booking/processing charge
// non-refundable — the non-refundable position needs the checkout disclosure fixed (product)
// or the claim softened (lawyer call). Wording below no longer claims a checkout "non-refundable" notice.

const Mail = () => <a href="mailto:team@timewheel.co.in" className="text-primary hover:underline">team@timewheel.co.in</a>;

const Th = ({ children }) => (
  <th className="text-left p-2.5 font-semibold text-ink border-b-2 border-gray-200">{children}</th>
);
const Td = ({ children, className = '' }) => (
  <td className={`p-2.5 border-b border-gray-100 ${className}`}>{children}</td>
);

const Refund = () => (
  <LegalLayout
    title="Refund & Cancellation Policy"
    updated="12 August 2026"
    effective={MARKETPLACE_EFFECTIVE}
    current="/refund"
    description="Meeticulous refund and cancellation policy — cancellation windows, what is refundable, host cancellations, timelines, and how to claim."
    intro={
      <>
        <p>
          This Refund &amp; Cancellation Policy applies to every payment made on the Meeticulous platform (the
          &ldquo;<strong>Platform</strong>&rdquo;), operated by <strong>Timewheel Internet Private Limited</strong>{' '}
          (CIN: U62012OD2026PTC052654, GSTIN: 21AAMCT8270C1ZF) (&ldquo;<strong>Meeticulous</strong>&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;). It forms part of our{' '}
          <Link to="/guest-terms" className="text-primary hover:underline">Guest Booking Terms</Link> and our{' '}
          <Link to="/terms" className="text-primary hover:underline">Terms of Use</Link>.
        </p>
        <p className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
          <strong>You claim from us.</strong> Even though the host is the seller of the service, Meeticulous
          facilitates refunds and grievance redressal as the marketplace. You never need to chase a host for your money
          &mdash; you claim from us, and we take it up with the host.
        </p>
        <p>
          Payments are processed through <strong>Razorpay</strong>. All amounts are in Indian Rupees.
        </p>
      </>
    }
  >
    <Section title="1. Cancellation windows for bookings">
      <p>
        Unless the listing states a different window, the default cancellation policy we apply is:
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-2 border-gray-200 rounded-xl overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <Th>You cancel</Th>
              <Th>Service amount</Th>
              <Th>Booking &amp; processing charge</Th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            <tr><Td>More than <strong>24 hours</strong> before the start time</Td><Td><strong>Refunded in full</strong></Td><Td>Not refunded</Td></tr>
            <tr><Td>Between <strong>6 and 24 hours</strong> before</Td><Td><strong>50% refunded</strong></Td><Td>Not refunded</Td></tr>
            <tr><Td>Less than <strong>6 hours</strong> before</Td><Td>Not refunded</Td><Td>Not refunded</Td></tr>
            <tr><Td className="border-b-0">You do not attend</Td><Td className="border-b-0">Not refunded</Td><Td className="border-b-0">Not refunded</Td></tr>
          </tbody>
        </table>
      </div>
      <p className="pt-1">
        The reason for the shorter windows is simple: the time was held for you and could not be sold to anyone else.
      </p>
      <p>
        <strong>Free bookings</strong> (₹0) can be cancelled at any time at no cost.
      </p>
    </Section>

    <Section title="2. Why the booking and processing charge is not refunded">
      <p>
        The small booking charge and payment processing charge shown at checkout cover costs we incur the moment your
        payment is taken. Our payment provider does not return its processing fee to us when a payment is refunded, so
        that cost is real and already spent.
      </p>
      <p>
        These charges are itemised at checkout as part of your total <strong>before</strong> you pay. Because our
        payment provider does not return its fee to us on a refund, they are not returned on a cancellation you
        initiate, as set out in this Policy.
      </p>
      <p>
        <strong>This does not apply where the fault is ours.</strong> If we or the host cancel, or the service is not
        delivered, you get <strong>everything</strong> back, including these charges. See Section 3.
      </p>
    </Section>

    <Section title="3. When you get a full refund, including all charges">
      <p>We refund the entire amount you paid in each of these cases:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>The host does not attend</strong>, cancels, or does not deliver the service that was paid for.</li>
        <li><strong>We cancel</strong> the booking for any reason.</li>
        <li><strong>The service was not delivered</strong> because of a technical failure on the Platform after your payment succeeded.</li>
        <li><strong>You were charged more than once</strong> for the same booking, or a technical error charged an incorrect amount.</li>
        <li><strong>Money was debited but the transaction failed.</strong> In most cases your bank reverses this automatically within its own timelines.</li>
        <li><strong>We substituted the person performing the service</strong> and you told us before the scheduled time that this was not acceptable to you.</li>
        <li><strong>The service was materially different</strong> from its description, or fell materially below reasonable standards. We will investigate and may refund in full or in part depending on what we find.</li>
      </ul>
    </Section>

    <Section title="4. Rescheduling">
      <p>
        Where the listing allows it, you may reschedule free of charge up to the cut-off shown at checkout, subject to
        availability. Rescheduling keeps your original payment &mdash; no refund is issued and no new payment is taken.
      </p>
      <p>
        A reschedule requested after the cut-off is treated as a cancellation under Section 1. A rescheduled booking may
        be rescheduled once; after that, the cancellation windows apply from the original booking time.
      </p>
    </Section>

    <Section title="5. What is not refundable">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Change of mind</strong> after the applicable cancellation window has closed.</li>
        <li><strong>Non-attendance or late arrival</strong> by you, including where you arrive so late that the service cannot reasonably be delivered.</li>
        <li><strong>Services already delivered</strong> as described.</li>
        <li><strong>Sessions ended early</strong> because of abusive, threatening, discriminatory, or unsafe behaviour.</li>
        <li><strong>Booking and payment processing charges</strong> on a cancellation you initiate (Section 2).</li>
        <li><strong>Subscription and plan fees</strong> paid by hosts (Host+, Studio, Enterprise), including GST, once the plan is activated. These give immediate access to plan features. If you cancel a subscription, it stops renewing at the end of the paid period; the remainder of that period is not refunded.</li>
        <li><strong>Digital products</strong> once delivered or once a download link has been issued.</li>
        <li><strong>Your own costs</strong> &mdash; travel, data, equipment, time, or any other expense connected with a booking.</li>
        <li><strong>Bank or card conversion charges</strong> on international payments.</li>
      </ul>
      <p className="pt-1">
        Nothing in this Section removes your right to a remedy where a service was not delivered or was deficient. That
        right is protected by law and is dealt with in Section 3.
      </p>
    </Section>

    <Section title="6. How to claim a refund">
      <ol className="list-decimal pl-5 space-y-1.5">
        <li>Cancel through the Platform where the option is available, then email <Mail /> so we can process any refund due under Section 1.</li>
        <li>For anything in Section 3, email <Mail /> within <strong>7 days</strong> of the scheduled time.</li>
        <li>Include your name, the phone number or email used for the booking, the booking reference (and the Razorpay payment ID if you have it), the date and time of the appointment, and what went wrong.</li>
      </ol>
      <p>
        Refunds are <strong>reviewed and issued by our team</strong> &mdash; they are not automatic. We aim to
        acknowledge within <strong>48 hours</strong> and decide within <strong>7 working days</strong>. We may contact
        the host to verify what happened, and we may ask you for further information. If we do, please reply within 5
        working days so we can close the matter.
      </p>
    </Section>

    <Section title="7. How refunds are paid">
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Approved refunds go back to your <strong>original payment method</strong> through Razorpay. We cannot refund to a different account, card, or person.</li>
        <li>We initiate approved refunds within <strong>5&ndash;7 working days</strong> of approval.</li>
        <li>After we initiate it, the amount usually reaches you in <strong>5&ndash;10 working days</strong>, depending on your bank or card issuer. Those timelines are outside our control.</li>
        <li>Refunds are made in INR. Currency conversion differences and third-party charges are not our responsibility.</li>
        {/* Credit-note / GST-adjustment is made against whichever invoice is reversed (our fee
            invoice, or the host's own service invoice); stated in general terms in the copy. */}
        <li>Where a refund is issued, any credit note and tax adjustment are made against the applicable invoice in accordance with law.</li>
        <li>Where only part of a booking is refunded, the adjustment reflects the refunded portion.</li>
      </ul>
    </Section>

    <Section title="8. Our arrangement with hosts">
      <p>
        The host is the seller of the service; Meeticulous is the marketplace that facilitates your booking, payment,
        and refund. Where we facilitate a refund to you for something the host caused, we recover that amount from the
        host under our agreement with them. That is a matter between us and the host and it never delays or reduces your
        refund.
      </p>
    </Section>

    <Section title="9. Chargebacks">
      <p>
        If you have a concern about a payment, please contact us first at <Mail />. We can usually resolve it faster
        than a bank dispute.
      </p>
      <p>
        Raising a chargeback without contacting us generally slows resolution down. We reserve the right to contest
        chargebacks we consider unwarranted and to provide the relevant transaction records &mdash; booking
        confirmation, attendance record, and correspondence &mdash; to the payment provider.
      </p>
    </Section>

    <Section title="10. Fraud and misuse">
      <p>
        We may decline a refund, and may restrict or close an account, where we have reasonable grounds to believe a
        claim is fraudulent, where cancellations are used repeatedly to hold time without intending to attend, or where
        the Platform is used to obtain services without paying for them.
      </p>
    </Section>

    <Section title="11. Changes to this Policy">
      <p>
        We may update this Policy. <strong>The version in force at the time of your purchase governs that
        purchase</strong> &mdash; a later change never applies retrospectively to a booking you have already made. We
        publish revised versions with a new &ldquo;Last updated&rdquo; date.
      </p>
    </Section>

    <Section title="12. Your rights and how to escalate">
      <p>
        Nothing in this Policy limits any right you have under the <strong>Consumer Protection Act, 2019</strong> or
        any other law that cannot be excluded by agreement.
      </p>
      <p>
        If you are not satisfied with our decision, escalate to our Grievance Officer,{' '}
        <strong>Shubham Narendra Datarkar</strong>, at <Mail />.
      </p>
      <p><strong>Email:</strong> <Mail /> &middot; <strong>Phone:</strong> +91 8637758344</p>
      <p className="pt-1"><strong>Timewheel Internet Private Limited</strong> (CIN: U62012OD2026PTC052654 | GSTIN: 21AAMCT8270C1ZF)</p>
      <p>Registered office: Ground Floor, Holding No-55, Ward No-19, Natapada, Jajpur Road, Byasanagar, District Jajpur, Odisha &ndash; 755019, India</p>
      <p>Operations office: #6, 2nd Floor, Eureka Coworking, Mate Square, Nagpur, Maharashtra</p>
    </Section>
  </LegalLayout>
);

export default Refund;
