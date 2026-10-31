import { Link } from 'react-router-dom';
import LegalLayout, { Section } from '../components/common/LegalLayout';
import { FREE_PLAN, PREMIUM_PLAN } from '../data/plans';

// /host-fees — Host Fee & Payment Schedule. Annexure A to the Host Services
// Agreement (/host-agreement), kept as a separate page so charges can be amended
// on 30 days' notice under clause 5.6 without re-executing the Agreement.
//
// MARKETPLACE MODEL v4: the host is the seller; Meeticulous charges a Platform Fee
// (booking fee + commission) and invoices only that. GST positions are stated firmly
// per the v4 model.
//
// The worked examples are the source of truth hosts quote back at us, so they must
// stay numerically identical to docs/payment-model.md v4 and to what pricingEngine
// computes (₹1000 → guest ₹1,011.80; host ₹959.76 paid / ₹909.76 free). If one
// changes, change all three.

const Mail = () => <a href="mailto:hello@meeticulous.com" className="text-primary hover:underline">hello@meeticulous.com</a>;

const Th = ({ children, className = '' }) => (
  <th className={`text-left p-2.5 font-semibold text-ink border-b-2 border-gray-200 ${className}`}>{children}</th>
);
const Td = ({ children, className = '' }) => (
  <td className={`p-2.5 border-b border-gray-100 ${className}`}>{children}</td>
);

const HostFees = () => (
  <LegalLayout
    title="Host Fee & Payment Schedule"
    updated="7 October 2026"
    effective="on your acceptance during host onboarding"
    current="/host-fees"
    description="What Meeticulous charges hosts — booking fee, platform commission, payment processing, TDS/TCS, how and when you are paid, and worked examples."
    intro={
      <>
        <p>
          This Schedule forms part of, and must be read with, the{' '}
          <Link to="/host-agreement" className="text-primary hover:underline">Host Services Agreement</Link>. Terms
          defined there have the same meaning here. It may be amended on <strong>30 days&rsquo; notice</strong> under
          clause 5.6 of that Agreement.
        </p>
        <p className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
          <strong>The short version.</strong> You set your price. Your Guest pays that price plus our small booking fee
          and GST on the fee. You receive your price, minus our commission (if your Plan has one), the payment-gateway
          charge, and the tax we are required to deduct at source (TDS and TCS). Your Guest pays the same amount
          whichever Plan you are on and however they choose to pay.
        </p>
      </>
    }
  >
    <Section title="1. Charges by Plan">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-2 border-gray-200 rounded-xl overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <Th>Plan</Th>
              <Th>Booking Fee</Th>
              <Th>Platform Commission</Th>
              <Th>Payment Processing</Th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            <tr>
              <Td><strong>{FREE_PLAN.name}</strong> (free)</Td>
              <Td>₹10 + GST</Td>
              <Td><strong>5%</strong> of your price</Td>
              <Td>actual gateway charge</Td>
            </tr>
            <tr>
              <Td><strong>{PREMIUM_PLAN.name}</strong></Td>
              <Td>₹10 + GST</Td>
              <Td>nil</Td>
              <Td>actual gateway charge</Td>
            </tr>
            <tr>
              <Td className="border-b-0"><strong>Enterprise</strong></Td>
              <Td className="border-b-0" colSpan={3}>as agreed in your Enterprise order form</Td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="pt-1">
        The <strong>booking fee</strong> is charged to your Guest on top of your price; the <strong>commission</strong>{' '}
        ({FREE_PLAN.name} only) is charged to you. Subscription prices for {PREMIUM_PLAN.name} and Enterprise are shown
        on the <Link to="/pricing" className="text-primary hover:underline">Pricing page</Link> and are charged
        separately with GST.
      </p>
      <p>
        <strong>Free bookings.</strong> A Service priced at ₹0 attracts no booking fee, no commission, no payment
        processing charge, and no TDS or TCS.
      </p>
      <p>
        <strong>Minimum price.</strong> A paid Service must be priced at <strong>₹100 or more</strong> on the{' '}
        {FREE_PLAN.name} and {PREMIUM_PLAN.name} Plans. Below that, the flat ₹10 booking fee would be too large a share of the price to be fair
        to your Guest. Free (₹0) Services remain available on every Plan, and the <strong>Supreme</strong> Plan has no
        minimum price.
      </p>
    </Section>

    <Section title="2. Payment processing charge">
      <p>
        Payments are collected through our payment gateway. The <strong>actual gateway charge on the transaction is
        borne by you</strong> and is deducted from your payout. The charge varies by the method your Guest uses (UPI,
        card, net banking, wallet); we pass through what the gateway actually charges, not a marked-up rate.
      </p>
    </Section>

    <Section title="3. Tax deducted / collected at source">
      <p>
        As an e-commerce operator, we are required by law to deduct and deposit two amounts from the sale value of your
        Service, against your PAN:
      </p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>TDS — 1%</strong> under <strong>section 194-O</strong> of the Income-tax Act, 1961.</li>
        <li><strong>TCS — 1%</strong> under <strong>section 52</strong> of the CGST Act, 2017.</li>
      </ul>
      <p>
        Neither is a charge by Meeticulous and neither is retained by us. Both are deposited to your credit against
        your PAN and are claimable in your income-tax and GST returns respectively. A <strong>valid PAN is mandatory
        before you can accept paid bookings</strong> (194-O requires it).
      </p>
    </Section>

    <Section title="4. How your payout is computed">
      <div className="rounded-xl border-2 border-gray-200 bg-white p-4 font-mono text-xs leading-relaxed">
        Guest pays&nbsp;&nbsp;=&nbsp;your price + ₹10 booking fee + GST on the fee<br />
        You receive&nbsp;=&nbsp;your price &minus; commission &minus; gateway charge &minus; TDS (1%) &minus; TCS (1%)
      </div>
      <p>
        Your Guest pays your listed price plus a flat ₹10 booking fee and 18% GST on that ₹10 (₹1.80). The booking fee
        is the same regardless of your Plan, so <strong>your Guest pays the same amount whichever Plan you are on</strong>.
        Commission, where it applies, is taken from your side, not added to the Guest&rsquo;s price.
      </p>
      <p>
        The commission is <strong>inclusive of GST</strong> — the 5% already contains the 18% GST on our commission
        service. We issue you a <strong>commission tax invoice</strong> for it so you can claim input credit if you are
        GST-registered.
      </p>
      <p>
        GST on your own service (your price) is your responsibility, not ours — we do not charge GST on your price. The
        examples below use a payment-gateway charge of ~2% for illustration; your actual charge depends on the payment
        method.
      </p>
    </Section>

    <Section title="5. Worked examples — you list ₹1,000">
      <p className="font-semibold text-ink">5.1 {PREMIUM_PLAN.name} (no commission)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-2 border-gray-200 rounded-xl overflow-hidden">
          <tbody className="text-gray-600">
            <tr><Td>Your price</Td><Td className="text-right">₹1,000.00</Td></tr>
            <tr><Td>Booking fee (₹10) + GST (₹1.80) — paid by your Guest</Td><Td className="text-right">₹11.80</Td></tr>
            <tr><Td><strong>Your Guest pays</strong></Td><Td className="text-right"><strong>₹1,011.80</strong></Td></tr>
            <tr><Td>&minus; Payment gateway (~2%)</Td><Td className="text-right">₹20.24</Td></tr>
            <tr><Td>&minus; TDS (194-O, 1%)</Td><Td className="text-right">₹10.00</Td></tr>
            <tr><Td>&minus; TCS (§52, 1%)</Td><Td className="text-right">₹10.00</Td></tr>
            <tr><Td className="border-b-0"><strong>You receive</strong></Td><Td className="border-b-0 text-right"><strong>₹959.76</strong></Td></tr>
          </tbody>
        </table>
      </div>

      <p className="font-semibold text-ink pt-3">5.2 {FREE_PLAN.name} (5% commission)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-2 border-gray-200 rounded-xl overflow-hidden">
          <tbody className="text-gray-600">
            <tr><Td>Your price</Td><Td className="text-right">₹1,000.00</Td></tr>
            <tr><Td>Booking fee (₹10) + GST (₹1.80) — paid by your Guest</Td><Td className="text-right">₹11.80</Td></tr>
            <tr><Td><strong>Your Guest pays</strong></Td><Td className="text-right"><strong>₹1,011.80</strong></Td></tr>
            <tr><Td>&minus; Commission 5% (incl. GST ₹7.63)</Td><Td className="text-right">₹50.00</Td></tr>
            <tr><Td>&minus; Payment gateway (~2%)</Td><Td className="text-right">₹20.24</Td></tr>
            <tr><Td>&minus; TDS (194-O, 1%)</Td><Td className="text-right">₹10.00</Td></tr>
            <tr><Td>&minus; TCS (§52, 1%)</Td><Td className="text-right">₹10.00</Td></tr>
            <tr><Td className="border-b-0"><strong>You receive</strong></Td><Td className="border-b-0 text-right"><strong>₹909.76</strong></Td></tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs pt-1">
        The Guest Price is identical in both examples — moving to a paid Plan does not make you more expensive to your
        Guest, it increases what you keep. TDS and TCS are not charges by us; they are deposited to your PAN and
        claimable in your returns.
      </p>
    </Section>

    <Section title="6. Your documents and GST">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Payout statement.</strong> For each paid Booking, your dashboard records your price and the amounts deducted (commission, gateway charge, TDS, TCS). It is <strong>not</strong> a tax invoice and carries no GST — it is your record of what you earned and what was deducted.</li>
        <li><strong>Commission tax invoice.</strong> Where commission applies, we issue you a tax invoice from Meeticulous for the commission (with GST), so you may claim input credit if registered.</li>
        <li><strong>Your own invoice.</strong> The sale of your Service is your sale to your Guest. If you are GST-registered, you are responsible for issuing your own tax invoice for your price and for accounting for GST on it. If you are not registered, no GST arises on your price.</li>
        <li><strong>PAN.</strong> A valid PAN is required before you can accept paid bookings. TDS and TCS are deposited to the government against your PAN; your TDS/TCS totals for any period are shown on your dashboard, and the credit reflects in your Form 26AS and on the GST portal.</li>
      </ul>
    </Section>

    <Section title="7. How and when you are paid">
      <p>
        Your payout is transferred to your <strong>Razorpay Linked Account</strong> through <strong>Razorpay Route</strong>.
        The transfer is created when your Guest pays and is <strong>held</strong> until after the Service (currently the
        scheduled end plus about <strong>24 hours</strong>), then released &mdash; when the Booking is marked complete or
        automatically at the end of the hold. If the Booking is cancelled, undelivered, or disputed, the held transfer
        may be reversed. See clause 7 of the <Link to="/host-agreement" className="text-primary hover:underline">Host
        Services Agreement</Link>.
      </p>
      <ul className="list-disc pl-5 space-y-1.5 pt-2">
        <li><strong>Complete KYC first.</strong> Payouts require an <strong>activated Razorpay Linked Account</strong> (set up from your KYC). Until it is active, amounts due are held to your credit and paid once it is activated &mdash; nothing is lost.</li>
        <li><strong>Minimum ₹100</strong> for a payout you request; amounts below ₹1 accrue to your credit.</li>
        <li>We may defer payment while a complaint, refund, chargeback, or verification is open, or while your KYC, PAN, or bank details are incomplete. See clause 7.4 of the Agreement.</li>
        <li>A valid PAN is required before you can accept paid bookings.</li>
        <li>Raise any query on a statement within <strong>30 days</strong>. After that it is treated as accepted.</li>
      </ul>
    </Section>

    <Section title="8. What we may deduct">
      <p>Under clause 9 of the Agreement we may deduct from amounts payable to you:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>refunds and credits given to a Guest for a Booking you supplied or failed to supply;</li>
        <li>chargebacks and payment reversals, and the fees a bank or the payment gateway charges us for them;</li>
        <li>the payment-processing and transfer-reversal cost we incur on a cancellation, refund, or dispute attributable to you;</li>
        <li>input tax credit denied or reversed because of your GST filing, with interest and penalty;</li>
        <li>tax, interest, or penalty demanded from us in respect of payments to you;</li>
        <li>subscription and Plan fees, and any other sum you owe us;</li>
        <li>overpayments and amounts paid in error;</li>
        <li>liquidated damages for off-platform dealing under clause 15.3.</li>
      </ul>
    </Section>

    <Section title="9. Cancellations and refunds">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>You cancel or do not attend.</strong> The Guest is refunded in full, including the booking fee. No payout is payable to you, and clause 12.3 applies.</li>
        <li><strong>Guest cancels in the refundable window.</strong> The Guest is refunded your price. The booking fee and payment processing charge are not refunded. No payout is payable to you.</li>
        <li><strong>Guest cancels late or does not attend.</strong> Handled under the <Link to="/refund" className="text-primary hover:underline">Refund &amp; Cancellation Policy</Link>. Where the Booking is treated as non-refundable, your payout remains payable.</li>
      </ul>
    </Section>

    <Section title="10. Changes to this Schedule">
      <p>
        We may amend this Schedule on <strong>30 days&rsquo; notice</strong> by email or in-Platform notification.
        Amended charges apply only to Bookings confirmed after the notice period ends. The charges applicable to a
        Booking are fixed and recorded when that Booking is confirmed. If you do not accept an amendment you may
        terminate under clause 19.1 of the Agreement before it takes effect.
      </p>
    </Section>

    <Section title="11. Questions">
      <p>
        Email <Mail /> or call +91 8637758344. For anything tax-related that affects your own returns, please take your
        own professional advice &mdash; we can explain what we charge and what we deduct, but we cannot advise you on
        your tax position.
      </p>
      <p className="pt-1"><strong>Rajmudra Media LLP</strong></p>
    </Section>
  </LegalLayout>
);

export default HostFees;
