import { Link } from 'react-router-dom';
import LegalLayout, { Section } from '../components/common/LegalLayout';

// /host-agreement — Host Services Agreement.
//
// MARKETPLACE MODEL v4 (reconciled to production main, Aug 2026): the Host SELLS TO THE
// GUEST; Meeticulous lists/books/collects and pays the Host via Razorpay Route (held
// transfer to the host's linked account, released after the service or reversed on
// cancel/dispute) net of Platform Fee/commission, gateway charge, and TDS/TCS. No twice-
// monthly cycle / 10% holdback / Payment Advice doc / Form 16A exist in the product —
// wording matches routeAutoPayoutService.js + payoutAdminController.js.

const Mail = () => <a href="mailto:team@timewheel.co.in" className="text-primary hover:underline">team@timewheel.co.in</a>;

const HostAgreement = () => (
  <LegalLayout
    title="Host Services Agreement"
    updated="12 August 2026"
    effective="on your acceptance during host onboarding"
    current="/host-agreement"
    description="The agreement between Meeticulous and its Hosts — how you sell your services to Guests through the Platform, and how you are priced, invoiced, and paid. Read before you list a service."
    intro={
      <>
        <p>
          This Host Services Agreement (the &ldquo;<strong>Agreement</strong>&rdquo;) is entered into between{' '}
          <strong>Timewheel Internet Private Limited</strong> (CIN: U62012OD2026PTC052654,
          GSTIN: 21AAMCT8270C1ZF), a company incorporated in India under the Companies Act, 2013, operating the
          Meeticulous platform (&ldquo;<strong>Meeticulous</strong>&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;,
          &ldquo;our&rdquo;), and you, the person or entity offering services through the Platform (the
          &ldquo;<strong>Host</strong>&rdquo;, &ldquo;you&rdquo;, &ldquo;your&rdquo;).
        </p>
        <p className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
          <strong>Read this first.</strong> You are the seller of your Service to the Guest. Meeticulous is the
          marketplace that lists your Service, takes the booking, collects payment, and pays you Your Price net of its
          Platform Fee, the payment-gateway charge, and tax deducted or collected at source. See the{' '}
          <Link to="/host-fees" className="text-primary hover:underline">Host Fee &amp; Payment Schedule</Link> for the
          figures. Clauses <strong>2</strong>, <strong>5</strong>, <strong>6</strong>, <strong>7</strong>, <strong>8</strong>{' '}
          and <strong>9</strong> are the ones that affect your money &mdash; read them properly.
        </p>
        <p>
          This Agreement incorporates the <Link to="/host-fees" className="text-primary hover:underline">Host Fee &amp;
          Payment Schedule</Link> (the &ldquo;<strong>Fee Schedule</strong>&rdquo;), our{' '}
          <Link to="/terms" className="text-primary hover:underline">Terms of Use</Link>, and our{' '}
          <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. By clicking to accept,
          creating a Host account, or listing a service, you agree to be bound by all of them.
        </p>
      </>
    }
  >
    <Section title="1. Definitions">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>&ldquo;Platform&rdquo;</strong> — the Meeticulous website, applications, and related systems.</li>
        <li><strong>&ldquo;Guest&rdquo;</strong> — an end customer who purchases a Service from you, the Host, through the Platform.</li>
        <li><strong>&ldquo;Service&rdquo;</strong> — an appointment, consultation, session, class, or other service you sell and supply to Guests through the Platform.</li>
        <li><strong>&ldquo;Booking&rdquo;</strong> — a confirmed order by a Guest for your Service.</li>
        <li><strong>&ldquo;Your Price&rdquo;</strong> or <strong>&ldquo;E&rdquo;</strong> — the price you set on the Platform for a Service.</li>
        <li><strong>&ldquo;Platform Fee&rdquo;</strong> — the booking fee and, on some Plans, the commission that Meeticulous charges for the platform services, as set out in the Fee Schedule.</li>
        <li><strong>&ldquo;Your Payout&rdquo;</strong> or <strong>&ldquo;H&rdquo;</strong> — the amount payable to you for a Booking, being Your Price less the Platform Fee, the payment-gateway charge, and tax deducted/collected at source, computed under clause 5.</li>
        <li><strong>&ldquo;Guest Price&rdquo;</strong> — the total amount payable by the Guest for a Booking (Your Price plus the booking fee and applicable tax).</li>
        <li><strong>&ldquo;Linked Account&rdquo;</strong> — your Razorpay Route account, activated from your KYC, to which Your Payout is transferred under clause 7.</li>
        <li><strong>&ldquo;Plan&rdquo;</strong> — the subscription tier applicable to your Host account (Starter, Host+, Studio, or Enterprise).</li>
      </ul>
    </Section>

    <Section title="2. Nature of the relationship">
      <p>
        <strong>2.1 You are the seller.</strong> You sell and supply your Services to Guests <strong>in your own name and
        on your own account</strong>. Meeticulous is a <strong>technology platform</strong> that lists your Services and
        provides discovery, scheduling, payments, reminders, communication tools, and support. Meeticulous does not buy,
        resell, or supply your Services and is not the seller of record for them.
      </p>
      <p>
        <strong>2.2 Contract with the Guest.</strong> The contract for the Service is between you and the Guest. Book A
        Sloth is not a party to it. You are responsible to the Guest for supplying the Service.
      </p>
      <p>
        <strong>2.3 Independent provider.</strong> You are an independent service provider. Nothing in this Agreement
        creates an agency, partnership, joint venture, franchise, or employment relationship between you and Book A
        Sloth. You are not entitled to any employment benefit, and you are responsible for your own establishment,
        staff, equipment, insurance, and statutory obligations.
      </p>
      <p>
        {/* Payment flow (marketplace v4, as built on main): guest pays into BAS's Razorpay
            account; a HELD Razorpay Route transfer of Your Payout goes to the host's linked
            account, released after the service (+~24h) or reversed on cancel/dispute.
            routeAutoPayoutService.js. Requires an activated linked account. */}
        <strong>2.4 Payments.</strong> Meeticulous collects the Guest Price through <strong>Razorpay</strong>, an
        authorised payment aggregator regulated by the Reserve Bank of India, and pays Your Payout to your{' '}
        <strong>Razorpay Linked Account</strong> using <strong>Razorpay Route</strong> &mdash; Your Price less the
        Platform Fee, the payment-gateway charge, and any tax deducted or collected at source. The transfer is created
        when the Guest pays and released to you after the Service, or reversed if the Booking is cancelled or disputed
        (clause 7). Paying you requires an activated Linked Account (clause 7.2). Meeticulous&rsquo;s own revenue is the{' '}
        <strong>Platform Fee</strong>; it does not own or retain Your Price. See also clause 16.
      </p>
      <p>
        <strong>2.5 Non-exclusive.</strong> This Agreement is non-exclusive. You may supply the same or similar
        services elsewhere, subject to clause 15.
      </p>
    </Section>

    <Section title="3. Your appointment and how orders are placed">
      <p>
        <strong>3.1</strong> Each confirmed Booking is an order placed by a Guest with you for the specified Service, at
        the specified date and time, facilitated by the Platform, for which Your Payout is computed under clause 5.
      </p>
      <p>
        <strong>3.2</strong> You accept a Booking by publishing the availability against which it was booked. A
        Booking becomes binding on you when the Platform confirms it.
      </p>
      <p>
        <strong>3.3</strong> Meeticulous is not obliged to place any minimum volume of orders, to promote your
        listings, or to achieve any level of visibility, bookings, or income for you. Any projection, estimate, or
        calculator output shown on the Platform is an illustration only and is not a representation, warranty, or
        guarantee.
      </p>
      <p>
        <strong>3.4 Substitution.</strong> Where you are unable to perform a confirmed Booking, Meeticulous may (but
        is not obliged to) help the Guest find an equivalently qualified Host. Where the Booking is performed by another
        Host, no Payout is payable to you for that Booking and clause 12.3 applies.
      </p>
    </Section>

    <Section title="4. Your warranties and obligations">
      <p>You represent, warrant, and undertake on a continuing basis that:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>You are at least 18 years old and legally competent to contract under Indian law.</li>
        <li>You hold, and will maintain, <strong>every licence, registration, certification, and qualification</strong> required by law or by professional regulation to supply your Services, and will produce evidence within 7 days of request.</li>
        <li>Your listings, descriptions, credentials, images, and pricing are accurate and not misleading, and you will keep them current.</li>
        <li>You will supply the Services with reasonable skill and care, lawfully, professionally, safely, and in accordance with the description published on the Platform.</li>
        <li>You will attend confirmed Bookings punctually and will not cancel other than in accordance with clause 12.</li>
        <li>You will not supply any service that is unlawful, unsafe, deceptive, obscene, discriminatory, or that infringes the rights of any person.</li>
        <li>You will not offer any service requiring a licence you do not hold, including any medical, psychological, legal, financial-advisory, or other regulated service outside the scope of your qualifications.</li>
        <li>You will comply with all applicable law, including the Consumer Protection Act, 2019, the Consumer Protection (E-Commerce) Rules, 2020, the Digital Personal Data Protection Act, 2023, and applicable tax law.</li>
        <li>You will keep the KYC, bank, PAN, and (where applicable) GST information you provide accurate, and will notify us of any change within <strong>7 days</strong>.</li>
        <li>You will not do anything that brings, or is reasonably likely to bring, Meeticulous into disrepute.</li>
      </ul>
      <p>
        Each warranty in this clause 4 is a material term of this Agreement. Breach entitles Meeticulous to exercise
        any remedy in clauses 9, 12, or 19.
      </p>
    </Section>

    <Section title="5. Price and how your consideration is computed">
      <p>
        <strong>5.1 You set your price.</strong> You specify, for each Service, Your Price (&ldquo;E&rdquo;). The
        Platform displays, before you confirm, the resulting Guest Price and Your Payout. You are deemed to have seen
        and accepted that computation for every Service you publish.
      </p>
      <p>
        <strong>5.2 Amounts.</strong> Amounts stated on the Platform are stated inclusive of applicable taxes as
        indicated at checkout. No amount is payable by Meeticulous over and above Your Payout computed under this
        clause.
      </p>
      <p>
        <strong>5.3 The computation.</strong> For each Booking:
      </p>
      <div className="rounded-xl border-2 border-gray-200 bg-white p-4 font-mono text-xs leading-relaxed">
        Guest Price&nbsp;&nbsp;=&nbsp;Your Price + booking fee + tax on the fee<br />
        Your Payout&nbsp;&nbsp;=&nbsp;Your Price &minus; Platform Fee &minus; payment-gateway charge &minus; tax deducted/collected at source
      </div>
      <p>
        The booking fee, Platform Commission (where applicable), payment-gateway charge, and the tax deducted/collected
        at source are set out in the <Link to="/host-fees" className="text-primary hover:underline">Fee Schedule</Link>,
        which forms part of this Agreement and contains worked examples.
      </p>
      <p>
        <strong>5.4 Tax.</strong> Meeticulous charges GST on its own Platform Fee. Meeticulous does not charge GST on
        Your Price &mdash; GST on your Service is a matter between you and the tax authorities, dealt with under clause 6.
      </p>
      <p>
        <strong>5.5 Your GST status.</strong> The effect of your own GST-registration status on how you invoice the
        Guest and how your payment is documented is dealt with under clause 6. You confirm you have had the opportunity
        to take your own tax advice.
      </p>
      <p>
        <strong>5.6 Changes to the Fee Schedule.</strong> Meeticulous may amend the Fee Schedule on{' '}
        <strong>30 days&rsquo; notice</strong> by email or in-Platform notification. Amended charges apply to Bookings
        confirmed after the notice period expires. Charges applicable to a Booking are fixed at the moment that Booking
        is confirmed and are recorded as a snapshot. If you do not accept an amendment, your remedy is to terminate
        under clause 19.1 before it takes effect; continuing to list Services after that date constitutes acceptance.
      </p>
      <p>
        <strong>5.7 Plan limits.</strong> Your Plan may limit the maximum price of a Service, the number of Services,
        or other features. Current limits are published on the Platform and in the Fee Schedule.
      </p>
      <p>
        <strong>5.8 Minimum price.</strong> A paid Service must be priced at <strong>₹100 or more</strong> on the
        Starter, Host+, and Studio Plans. Free (₹0) Services are permitted on every Plan, and the Supreme Plan is not
        subject to this minimum. Meeticulous may decline to publish, or may unpublish, a paid Service priced below the
        applicable minimum.
      </p>
    </Section>

    <Section title="6. Invoicing and GST">
      <p className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-amber-900 text-xs">
        <strong>In short:</strong> you sell the Service to the Guest and account for GST on your own Service where you
        are registered. Meeticulous charges you a Platform Fee for the platform services and issues you a tax invoice
        for it. You remain responsible for your own tax position and should take your own advice on it.
      </p>
      <p>
        <strong>6.1 Your invoice to the Guest.</strong> The Service is your sale to the Guest. If you are
        GST-registered, you are responsible for issuing your own tax invoice to the Guest for Your Price and for
        accounting for the GST on it. Meeticulous may generate a draft or assist with issuance, but adopting it does
        not transfer responsibility for its accuracy to Meeticulous. If you are not registered, no GST arises on Your
        Price.
      </p>
      <p>
        <strong>6.1A Our invoice to you.</strong> Meeticulous issues you a tax invoice for its Platform Fee (the
        booking fee and any commission), so that you may claim input tax credit where you are entitled to it.
      </p>
      <p>
        <strong>6.2 Your filing obligation.</strong> You will report each such invoice in your GSTR-1 within the
        statutory period, and will discharge the corresponding output tax, so that input tax credit is available to
        Meeticulous in the ordinary course.
      </p>
      <p>
        <strong>6.3 Recovery of denied credit.</strong> If input tax credit is denied to, reversed against, or delayed
        for Meeticulous because you failed to file, failed to pay, filed late, or issued a defective or non-compliant
        invoice, the full amount of that credit, together with any interest and penalty imposed on Meeticulous, is a
        debt due from you and is recoverable under clause 9. We may withhold payment of the GST component of any
        invoice until it appears in our GSTR-2B.
      </p>
      <p>
        <strong>6.4 Your payout statement.</strong> Your Host dashboard records, for each Booking, Your Price and the
        amounts deducted (Platform Fee, payment-gateway charge, TDS, and TCS) to arrive at Your Payout. This statement
        is <strong>not</strong> a tax invoice, carries no GST component, and gives rise to no input tax credit. It is
        your record of what you earned and what was deducted; it is not a substitute for your own invoice to the Guest
        under clause 6.1.
      </p>
      <p>
        <strong>6.5 Change of status.</strong> You will notify us within <strong>7 days</strong> of becoming registered
        or deregistered under GST. A change applies <strong>prospectively only</strong>, from the date we record it. It
        is never applied retrospectively to Bookings already confirmed, and no adjustment is payable in respect of
        them.
      </p>
      <p>
        <strong>6.6 Name matching.</strong> The legal name against your GSTIN must match the name on your Host account
        and bank records. We may withhold payment until any mismatch is resolved, and you are responsible for any
        credit denied as a result.
      </p>
      <p>
        <strong>6.7 Your own taxes.</strong> You are solely responsible for your own income tax, GST, professional tax,
        and any other tax on the amounts you receive, and for your own returns, records, and registrations.
      </p>
    </Section>

    <Section title="7. Payment terms">
      <p>
        <strong>7.1 How and when you are paid.</strong> Your Payout for a Booking is transferred to your Linked Account
        through <strong>Razorpay Route</strong>. The transfer is created when the Guest&rsquo;s payment is captured and
        is <strong>held</strong> until the Service is over plus a short buffer (currently the scheduled end of the
        Service plus approximately <strong>24 hours</strong>). It is <strong>released</strong> to you when the Booking is
        marked complete or automatically by our payment partner at the end of the hold. If the Booking is cancelled, not
        delivered, or the subject of a dispute, the held transfer may be <strong>reversed</strong> under clause 12 and
        the <Link to="/refund" className="text-primary hover:underline">Refund &amp; Cancellation Policy</Link>.
      </p>
      <p>
        <strong>7.2 Activated Linked Account required.</strong> Before Your Payout can be transferred to you, you must
        complete KYC and hold an <strong>activated Razorpay Linked Account</strong>. Until then, the amounts due are
        recorded and held to your credit, and are paid once your Linked Account is activated. Nothing is forfeited by
        the delay.
      </p>
      <p>
        <strong>7.3 Minimum amount.</strong> A payout you request from your available balance is subject to a minimum of{' '}
        <strong>₹100</strong>. An amount below <strong>₹1</strong> cannot be transferred and accrues to your credit
        until the balance clears these minima.
      </p>
      <p>
        <strong>7.4 Right to defer.</strong> Meeticulous may withhold or defer payment of any amount, in whole or in
        part, where: a Guest complaint, refund request, chargeback, or investigation relating to you is open; we
        reasonably suspect fraud, misrepresentation, or breach of clause 4; your KYC, PAN, bank, or GST details are
        incomplete, unverified, or inconsistent; or we are required to do so by law or by a payment provider, bank, or
        authority. We will notify you and release any amount not properly applied under clause 9 once the matter is
        resolved.
      </p>
      <p>
        <strong>7.5 Method.</strong> Payouts are made through Razorpay Route to your Linked Account, which settles to
        the bank account you provide in KYC, net of the deductions in clauses 8 and 9. Transfer to your Linked Account
        discharges our obligation in full. You are responsible for the accuracy of those details, and for any loss
        caused by details you supplied incorrectly.
      </p>
      <p>
        <strong>7.6 No interest.</strong> No interest is payable on any amount held, deferred, carried forward, or paid
        late, save where a court or arbitrator directs otherwise.
      </p>
      <p>
        <strong>7.7 Statements and queries.</strong> Statements are available on your Host dashboard. You must raise any
        query on a statement within <strong>30 days</strong> of it becoming available. After that period the statement
        is treated as accepted, save in the case of manifest error or fraud.
      </p>
    </Section>

    <Section title="8. Tax deducted at source">
      <p>
        <strong>8.1</strong> Meeticulous deducts income tax at source (TDS under section 194-O) and collects tax at
        source (TCS under section 52 of the CGST Act) from amounts due to you where required, deposits them to the
        government against your PAN, and files the prescribed returns. The credit is available to you &mdash; reflected
        in your Form 26AS and on the GST portal &mdash; to claim in your income-tax and GST returns.
      </p>
      <p>
        <strong>8.2</strong> TDS is <strong>not a charge by Meeticulous</strong> and is not retained by us. It is tax
        deposited to your credit against your PAN, and you may claim it in your income tax return.
      </p>
      <p>
        <strong>8.3 PAN is mandatory.</strong> A valid PAN must be on file <strong>before you can accept a paid
        Booking</strong> &mdash; the Platform will not let you take a paid Booking without one. You are responsible for
        keeping it accurate, and Meeticulous has no liability for any consequence of an incorrect or missing PAN.
      </p>
      <p>
        <strong>8.4</strong> If any tax, interest, or penalty is later demanded from Meeticulous in respect of
        payments made to you, including as a result of an incorrect PAN, an incorrect declaration, or your failure to
        report income, that amount is recoverable from you under clause 9.
      </p>
    </Section>

    <Section title="9. Set-off and recovery">
      <p>
        <strong>9.1</strong> Meeticulous may deduct, set off, or recover from any amount payable to you (whether under
        this Agreement or otherwise, and whether or not then due) any of the following:
      </p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>refunds, price reductions, or credits given to a Guest in respect of a Booking you supplied or failed to supply;</li>
        <li>chargebacks, payment reversals, and the associated fees levied by any bank or payment provider;</li>
        <li>the payment-processing cost and any bank or gateway fee we incur on a refund, reversal, or chargeback relating to a Booking you supplied or failed to supply;</li>
        <li>input tax credit denied, reversed, or delayed under clause 6.3, with interest and penalty;</li>
        <li>tax, interest, or penalty demanded under clause 8.4;</li>
        <li>subscription fees, Plan charges, and any other sum you owe us;</li>
        <li>amounts payable under the indemnity in clause 17;</li>
        <li>any overpayment, duplicate payment, or amount paid in error;</li>
        <li>liquidated damages under clause 15.3.</li>
      </ul>
      <p>
        <strong>9.2</strong> If the amounts recoverable exceed the amounts payable to you, the balance is a debt due
        and payable on demand within 15 days, and Meeticulous may defer payment under clause 7.4, suspend your
        account, and pursue recovery.
      </p>
      <p>
        <strong>9.3</strong> This clause is in addition to, and not in substitution for, any other right or remedy
        available to Meeticulous.
      </p>
    </Section>

    <Section title="10. Guest-facing responsibility and complaints">
      <p>
        <strong>10.1</strong> As the marketplace, Meeticulous provides Guest-facing grievance redressal and
        facilitates refunds and cancellations under the Consumer Protection (E-Commerce) Rules, 2020. The Service itself
        is your responsibility as its seller. Meeticulous&rsquo;s decision on whether to facilitate a refund to a Guest
        is final as between Meeticulous and the Guest, without prejudice to recovery from you under clause 9.
      </p>
      <p>
        <strong>10.2</strong> As between Meeticulous and you, you remain responsible for any complaint, refund,
        liability, cost, or claim arising from your act, omission, delay, conduct, or the standard of your performance,
        and the resulting amounts are recoverable under clause 9.
      </p>
      <p>
        <strong>10.3</strong> You will cooperate fully and promptly with any investigation, provide the information and
        records we reasonably request within <strong>3 working days</strong>, and will not contact a Guest about a
        dispute except through the Platform or as we direct.
      </p>
      <p>
        <strong>10.4</strong> You will not settle, admit, compromise, or make any payment in respect of any Guest claim
        without our prior written consent.
      </p>
    </Section>

    <Section title="11. Standards, availability, and quality">
      <ul className="list-disc pl-5 space-y-1.5">
        <li>You will keep your published availability accurate and will not accept Bookings you cannot honour.</li>
        <li>You will join or attend at the scheduled start time and will deliver the full advertised duration.</li>
        <li>You will maintain the equipment, connectivity, premises, and hygiene and safety standards appropriate to the Service.</li>
        <li>Where the Service is delivered in person, you will comply with all applicable safety, accessibility, and licensing requirements at the location.</li>
        <li>Meeticulous may set and publish reasonable minimum quality, response-time, and reliability standards, and may reflect performance against them in Platform ranking and visibility.</li>
      </ul>
    </Section>

    <Section title="12. Cancellation and non-performance by you">
      <p>
        <strong>12.1</strong> You may cancel a confirmed Booking only for a genuine and unavoidable reason, and must do
        so through the Platform at the earliest opportunity.
      </p>
      <p>
        <strong>12.2</strong> Where you cancel or fail to attend, the Guest receives a full refund of the Guest Price,
        including the booking fee and payment-gateway charge, and no Payout is payable to you for
        that Booking.
      </p>
      <p>
        <strong>12.3</strong> In addition, Meeticulous may recover under clause 9 the payment-processing cost and any
        gateway or transfer-reversal fee it incurs on the resulting refund or reversal.
      </p>
      <p>
        <strong>12.4</strong> Repeated cancellation or non-attendance is a material breach. Meeticulous may restrict
        your visibility, limit your listings, suspend your account, or terminate under clause 19.2.
      </p>
      <p>
        <strong>12.5</strong> Cancellation by the Guest is governed by the{' '}
        <Link to="/refund" className="text-primary hover:underline">Refund &amp; Cancellation Policy</Link>. Where a
        Guest cancels within a window in which the Service is treated as non-refundable, Your Payout remains
        payable to you in accordance with that Policy.
      </p>
    </Section>

    <Section title="13. Data protection">
      <p>
        <strong>13.1</strong> Guest personal data made available to you through the Platform is disclosed solely so you
        can perform the Booking. Meeticulous is the Data Fiduciary in respect of that data and you process it on our
        instructions and on our behalf.
      </p>
      <p>
        <strong>13.2</strong> You will: use that data only to perform the Booking; not use it for marketing,
        solicitation, resale, profiling, or any other purpose; keep it confidential and secure with appropriate
        technical and organisational measures; not retain it longer than necessary; not transfer it outside India
        except as permitted by law; and delete it on request or on termination.
      </p>
      <p>
        <strong>13.3</strong> You will notify us at <Mail /> <strong>within 24 hours</strong> of becoming aware of any
        personal data breach affecting Guest data, and will cooperate with any notification we are required to make
        under the Digital Personal Data Protection Act, 2023 and the rules under it.
      </p>
      <p>
        <strong>13.4</strong> Breach of this clause 13 is a material breach permitting immediate suspension and
        termination, and any penalty imposed on Meeticulous as a result is recoverable under clauses 9 and 17.
      </p>
    </Section>

    <Section title="14. Confidentiality and intellectual property">
      <p>
        <strong>14.1</strong> You will keep confidential all non-public information about the Platform, its pricing,
        its systems, its users, and its business that you obtain under this Agreement, and will not disclose or use it
        except to perform this Agreement. This obligation survives termination for 3 years.
      </p>
      <p>
        <strong>14.2</strong> You retain ownership of the content you upload. You grant Meeticulous a non-exclusive,
        worldwide, royalty-free, sub-licensable licence to host, reproduce, adapt for formatting, display, and
        distribute that content, and to use your name, business name, likeness, and listing content, to operate,
        market, and promote the Platform and the Services. This licence survives termination in respect of content
        already published or included in archived, cached, or promotional material.
      </p>
      <p>
        <strong>14.3</strong> You warrant that you own or are licensed to use everything you upload and that it
        infringes no third-party right.
      </p>
      <p>
        <strong>14.4</strong> Meeticulous retains all rights in the Platform, its software, design, data, and brand.
        Nothing in this Agreement grants you any right in them beyond the limited right to use the Platform under the{' '}
        <Link to="/terms" className="text-primary hover:underline">Terms of Use</Link>.
      </p>
    </Section>

    <Section title="15. Off-platform dealing">
      <p>
        <strong>15.1</strong> You will not accept, request, or encourage payment directly from a Guest for a Booking
        made or initiated through the Platform, and will not direct a Guest to pay by any means outside the Platform.
      </p>
      <p>
        <strong>15.2</strong> For <strong>12 months</strong> after a Guest first books you through the Platform, you
        will not solicit or knowingly accept a booking from that Guest outside the Platform for a service of the same
        or a similar kind. This does not apply to a Guest with whom you had a pre-existing, documented client
        relationship before their first Platform Booking.
      </p>
      <p>
        <strong>15.3 Liquidated damages.</strong> Breach of clause 15.1 or 15.2 causes loss that is difficult to
        quantify. You agree to pay, as a genuine pre-estimate of that loss and not as a penalty, an amount equal to{' '}
        <strong>three times the Platform Fee</strong> that would have applied had the booking
        been made through the Platform, subject to a maximum of <strong>₹10,000</strong> per breach. This is
        recoverable under clause 9 and is without prejudice to termination under clause 19.2.
      </p>
      <p>
        <strong>15.4</strong> Clause 15.1 also protects the integrity of the arrangement described in clause 2. Taking
        payment directly for a Platform Booking would misrepresent who supplied the Service and is treated as a
        material breach.
      </p>
    </Section>

    <Section title="16. Payment collection and remittance">
      <p>
        {/* Payment flow (marketplace v4, as built on main): collection via Razorpay; payout via
            Razorpay Route held transfer to the host's linked account, released after the service
            or reversed on cancel/dispute. routeAutoPayoutService.js / routeTransferService.js. */}
        Meeticulous collects the Guest Price through <strong>Razorpay</strong>, an authorised payment aggregator
        regulated by the Reserve Bank of India, and transfers Your Payout to your Razorpay <strong>Linked Account</strong>{' '}
        using <strong>Razorpay Route</strong> &mdash; Your Price less the Platform Fee, the payment-gateway charge, and
        any tax deducted or collected at source. The transfer is held until after the Service and released or reversed
        under clause 7. Meeticulous&rsquo;s own revenue is the <strong>Platform Fee</strong>; it does not own or retain
        Your Price. You authorise Meeticulous and Razorpay to collect the Guest Price and to make the deductions in
        clauses 8 and 9 before transferring Your Payout, and to reverse a held transfer where a Booking is cancelled,
        undelivered, or disputed.
      </p>
    </Section>

    <Section title="17. Indemnity">
      <p>
        You will indemnify, defend, and hold harmless Meeticulous, Timewheel Internet Private Limited, and their
        directors, officers, employees, and agents from and against all claims, demands, proceedings, losses, damages,
        liabilities, fines, penalties, taxes, and costs (including reasonable legal fees) arising out of or in
        connection with:
      </p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>your supply, non-supply, or defective supply of any Service;</li>
        <li>any injury, loss, or damage caused to any person or property in the course of a Service;</li>
        <li>your breach of this Agreement or of any applicable law, licence, or professional obligation;</li>
        <li>any claim that your content infringes a third-party right;</li>
        <li>any claim by a Guest, regulator, or authority arising from your act or omission;</li>
        <li>any tax, interest, or penalty referred to in clauses 6.3 or 8.4.</li>
      </ul>
      <p>This clause survives termination.</p>
    </Section>

    <Section title="18. Our liability to you">
      <p>
        <strong>18.1</strong> The Platform is provided on an <strong>&ldquo;as is&rdquo; and &ldquo;as
        available&rdquo;</strong> basis. We do not warrant that it will be uninterrupted, error-free, or secure, or
        that it will generate any level of bookings or income for you.
      </p>
      <p>
        <strong>18.2</strong> We are not liable to you for indirect, incidental, special, consequential, or punitive
        loss, or for loss of profit, revenue, business, goodwill, opportunity, or data.
      </p>
      <p>
        <strong>18.3</strong> Our total aggregate liability to you for all claims arising out of or relating to this
        Agreement is limited to the total Platform Fee actually retained by us from you in
        the <strong>three months</strong> preceding the event giving rise to the claim, or <strong>₹10,000</strong>,
        whichever is lower.
      </p>
      <p>
        <strong>18.4</strong> Nothing in this clause excludes or limits liability that cannot be excluded or limited
        under applicable law, including liability for fraud.
      </p>
    </Section>

    <Section title="19. Term, suspension, and termination">
      <p>
        <strong>19.1</strong> This Agreement begins on your acceptance and continues until terminated. You may
        terminate on <strong>30 days&rsquo;</strong> written notice to <Mail />, provided you first honour or properly
        cancel all confirmed Bookings.
      </p>
      <p>
        <strong>19.2</strong> Meeticulous may terminate on 30 days&rsquo; notice for convenience, or{' '}
        <strong>immediately and without notice</strong> where you breach clause 4, 13, 15, or 16, where we reasonably
        suspect fraud, illegality, or risk to Guests, or where required by law or by a payment provider, bank, or
        authority.
      </p>
      <p>
        <strong>19.3 Suspension.</strong> We may suspend your listings, your account, or payment to you at any time,
        with or without notice, where we reasonably consider it necessary to protect Guests, the Platform, or
        ourselves. Suspension is not a termination and does not limit any other remedy.
      </p>
      <p>
        <strong>19.4 On termination:</strong> confirmed Bookings must still be honoured or will be refunded to the
        Guest at your cost under clause 12; amounts properly due to you are transferred once all cancellation, dispute,
        and chargeback windows have closed, which may be up to <strong>120 days</strong> after the last Booking; and
        amounts recoverable under clause 9 remain recoverable.
      </p>
      <p>
        <strong>19.5</strong> Clauses 2, 6.3, 8.4, 9, 10.2, 13, 14, 15, 16, 17, 18, 20, and 21 survive termination.
      </p>
    </Section>

    <Section title="20. Dispute resolution and governing law">
      <p>
        <strong>20.1</strong> This Agreement is governed by the laws of India.
      </p>
      <p>
        <strong>20.2 Escalation.</strong> Before commencing any proceeding, the parties will attempt in good faith to
        resolve the dispute by written notice to <Mail /> and a discussion within 15 days of that notice.
      </p>
      <p>
        <strong>20.3 Arbitration.</strong> Any dispute not resolved under clause 20.2 will be referred to and finally
        resolved by arbitration under the Arbitration and Conciliation Act, 1996, by a <strong>sole arbitrator</strong>{' '}
        appointed by Meeticulous, with the <strong>seat and venue at Nagpur, Maharashtra</strong>, conducted in
        English. Each party bears its own costs unless the arbitrator directs otherwise. The award is final and binding.
      </p>
      <p>
        <strong>20.4</strong> Subject to clause 20.3, the courts at <strong>Nagpur, Maharashtra</strong> have exclusive
        jurisdiction.
      </p>
      <p>
        <strong>20.5</strong> This clause applies to disputes between Meeticulous and a Host in a business capacity.
        It does not affect any right a consumer has under the Consumer Protection Act, 2019.
      </p>
    </Section>

    <Section title="21. General">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Entire agreement.</strong> This Agreement, the Fee Schedule, the Terms of Use, and the Privacy Policy are the entire agreement between the parties on this subject and supersede all prior understandings and representations.</li>
        <li><strong>Amendment.</strong> We may amend this Agreement on 30 days&rsquo; notice. Continuing to list Services after the notice period constitutes acceptance. Fee changes follow clause 5.6.</li>
        <li><strong>Assignment.</strong> You may not assign or subcontract this Agreement without our written consent. We may assign it to any group company or in connection with a merger, reorganisation, or sale of business.</li>
        <li><strong>Severability.</strong> If any provision is held invalid or unenforceable, it is severed to the minimum extent necessary and the remainder continues in full force.</li>
        <li><strong>No waiver.</strong> A failure or delay in exercising a right is not a waiver of it.</li>
        <li><strong>Force majeure.</strong> Neither party is liable for failure to perform caused by an event beyond its reasonable control, but this does not excuse an obligation to pay money.</li>
        <li><strong>Notices.</strong> Notices to you are validly given by email to the address on your Host account or by in-Platform notification. Notices to us must go to <Mail />.</li>
        <li><strong>Language.</strong> The English version of this Agreement governs.</li>
      </ul>
    </Section>

    <Section title="22. Contact and grievance">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Grievance Officer:</strong> Shubham Narendra Datarkar</li>
        <li><strong>Email:</strong> <Mail /></li>
        <li><strong>Phone:</strong> +91 8637758344</li>
        <li><strong>Registered office:</strong> Ground Floor, Holding No-55, Ward No-19, Natapada, Jajpur Road, Byasanagar, District Jajpur, Odisha &ndash; 755019, India</li>
        <li><strong>Operations office:</strong> #6, 2nd Floor, Eureka Coworking, Mate Square, Nagpur, Maharashtra</li>
      </ul>
      <p className="pt-1"><strong>Timewheel Internet Private Limited</strong> (CIN: U62012OD2026PTC052654 | GSTIN: 21AAMCT8270C1ZF)</p>
    </Section>
  </LegalLayout>
);

export default HostAgreement;
