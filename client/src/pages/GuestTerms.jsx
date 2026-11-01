import { Link } from 'react-router-dom';
import LegalLayout, { Section, MARKETPLACE_EFFECTIVE } from '../components/common/LegalLayout';

// /guest-terms — Guest Booking Terms.
//
// MARKETPLACE MODEL v4: the HOST is the seller/supplier; the sale contract is host↔guest;
// Meeticulous is the marketplace that facilitates the booking, collects payment, and
// provides grievance redressal + refund facilitation under the Consumer Protection
// (E-Commerce) Rules, 2020. Consumer rights under the CPA 2019 are NOT excluded.

const Mail = () => <a href="mailto:team@meeticulous.com" className="text-primary hover:underline">team@meeticulous.com</a>;

const GuestTerms = () => (
  <LegalLayout
    title="Guest Booking Terms"
    updated="12 August 2026"
    effective={MARKETPLACE_EFFECTIVE}
    current="/guest-terms"
    description="The terms on which you buy a service from a host through Meeticulous — who you are buying from, what is included, cancellations, rescheduling, and your rights if something goes wrong."
    intro={
      <>
        <p>
          These Guest Booking Terms (&ldquo;<strong>Booking Terms</strong>&rdquo;) apply every time you book or buy a
          service on Meeticulous. Meeticulous is operated by <strong>Rajmudra Media LLP</strong>{' '}
          (&ldquo;<strong>Meeticulous</strong>&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;).
        </p>
        <p className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
          <strong>Who you are buying from.</strong> You are buying the service <strong>from the host</strong> shown on
          the listing, who is the seller and performs the service. <strong>Meeticulous is the marketplace</strong> that
          lists the service, takes your booking, collects your payment, and supports you. If something goes wrong you can
          still come to us first &mdash; we provide grievance redressal and facilitate refunds &mdash; and your rights
          as a consumer are fully preserved.
        </p>
        <p>
          Read these together with our{' '}
          <Link to="/terms" className="text-primary hover:underline">Terms of Use</Link>, our{' '}
          <Link to="/refund" className="text-primary hover:underline">Refund &amp; Cancellation Policy</Link>, and our{' '}
          <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. If there is any conflict
          about a purchase, these Booking Terms prevail.
        </p>
      </>
    }
  >
    <Section title="1. Who is selling to you">
      <p>
        <strong>1.1</strong> The <strong>host</strong> shown on the listing is the seller and supplier of the service.
        Your contract for the service is with the host.
      </p>
      <p>
        <strong>1.2</strong> <strong>Meeticulous is the marketplace.</strong> We list the service, take your booking,
        collect your payment, issue you a tax invoice for our booking fee, and provide support and grievance redressal.
        We do not ourselves perform the service.
      </p>
      <p>
        <strong>1.3</strong> Even though the host is the seller, you have <strong>one place to raise a problem</strong>{' '}
        &mdash; you can come to us and we will help, provide grievance redressal, and facilitate a refund where due,
        under the Consumer Protection (E-Commerce) Rules, 2020.
      </p>
      <p>
        <strong>1.4</strong> The GST invoice you receive from Meeticulous is for our booking fee. Where the host is
        GST-registered, the host is responsible for invoicing their own service price.
      </p>
      <p>
        <strong>1.5 Who your host is.</strong> The identity of the host who will supply your service &mdash; their name,
        and the details you need to identify and contact them about the booking &mdash; is shown on the listing and in
        your booking confirmation. We will provide further details of the host on request, in accordance with the{' '}
        <strong>Consumer Protection (E-Commerce) Rules, 2020</strong>.
      </p>
    </Section>

    <Section title="2. Price, tax, and your invoice">
      <p>
        <strong>2.1</strong> The price shown at checkout is the total amount payable. It is{' '}
        <strong>inclusive of GST</strong> and of all charges. There are no charges added after checkout.
      </p>
      <p>
        <strong>2.2</strong> Before you pay, the checkout itemises what makes up the price, including the applicable
        tax. Please review it before confirming.
      </p>
      <p>
        <strong>2.3</strong> We issue you a <strong>tax invoice from Meeticulous</strong> for our booking fee. Where
        the host is GST-registered, the host is responsible for invoicing their own service price. Keep your booking
        confirmation and invoice &mdash; they are your record of purchase.
      </p>
      <p>
        <strong>2.4</strong> All prices are in Indian Rupees. If you pay using a card issued outside India, your bank
        may apply its own conversion rate and charges, which are not ours and are not refundable by us.
      </p>
      <p>
        <strong>2.5</strong> We ask for your state at checkout because tax law requires it to determine the correct GST
        treatment.
      </p>
    </Section>

    <Section title="3. When your booking becomes a contract">
      <p>
        <strong>3.1</strong> Displaying a service is an invitation to book, not an offer. Your booking is an offer to
        buy.
      </p>
      <p>
        <strong>3.2</strong> A contract is formed when we confirm the booking &mdash; normally immediately after
        successful payment, by on-screen confirmation and email. Free bookings are confirmed on submission.
      </p>
      <p>
        <strong>3.3</strong> We may decline or cancel a booking before the service is delivered if the service is
        unavailable, if the listing contained a manifest pricing or description error, if we cannot verify your details,
        or if we reasonably suspect fraud or misuse. If we do, we refund you in full. That is the limit of our liability
        for declining a booking.
      </p>
      <p>
        <strong>3.4</strong> You must be at least 18 and able to contract under Indian law. Some services may carry
        their own age, health, or eligibility requirements shown on the listing; you are responsible for meeting them.
      </p>
    </Section>

    <Section title="4. What you are buying">
      <p>
        <strong>4.1</strong> You are buying the service described on the listing, for the stated duration, at the
        stated date and time, delivered in the stated mode (online or in person).
      </p>
      <p>
        <strong>4.2 Online services.</strong> You are responsible for your own device, software, and internet
        connection. Where a meeting link is issued, it is sent to the contact details you provided.
      </p>
      <p>
        <strong>4.3 In-person services.</strong> You are responsible for travelling to the stated location and for your
        own travel costs. Any access, safety, or house rules notified for the location apply.
      </p>
      <p>
        <strong>4.4 Outcomes are not guaranteed.</strong> Services are supplied with reasonable skill and care. Unless a
        listing says so explicitly and in terms, no particular result, outcome, or benefit is promised.
      </p>
      <p>
        <strong>4.5 Not professional advice unless stated.</strong> Nothing bought through Meeticulous is medical,
        psychological, legal, financial, or investment advice unless the listing expressly says so and the person
        performing it holds the necessary qualifications. In an emergency, contact the appropriate emergency or
        professional service.
      </p>
    </Section>

    <Section title="5. Changing or cancelling your booking">
      <p>
        <strong>5.1</strong> Cancellation and refund entitlements are set out in the{' '}
        <Link to="/refund" className="text-primary hover:underline">Refund &amp; Cancellation Policy</Link>, which forms
        part of these Booking Terms. Please read it before you book.
      </p>
      <p>
        <strong>5.2 Booking and processing charges are not refundable.</strong> Where you cancel, the small booking
        charge and payment processing charge shown at checkout are retained, because they are costs we have already
        incurred on your booking, as set out in this policy and the Refund &amp; Cancellation Policy. Where{' '}
        <strong>we or the host</strong> cancel or fail to deliver, you are refunded in full, including those charges.
      </p>
      <p>
        <strong>5.3 Rescheduling.</strong> Where the listing allows it, you may reschedule free of charge up to the
        stated cut-off, subject to availability. A reschedule requested after the cut-off is treated as a cancellation.
      </p>
      <p>
        <strong>5.4 If you do not attend.</strong> If you do not attend at the scheduled time, or arrive so late that
        the service cannot reasonably be delivered, the booking is treated as delivered and is not refundable. The
        service may still end at the scheduled finish time.
      </p>
      <p>
        <strong>5.5 If we substitute the person performing the service.</strong> Where the person originally shown is
        unavailable, we may arrange an equivalently qualified person to perform it. We will tell you in advance. If the
        substitution is not acceptable to you, tell us before the scheduled time and we will refund you in full.
      </p>
      <p>
        <strong>5.6 If we cancel.</strong> If we cancel or cannot deliver, we will offer you a reschedule or a full
        refund, at your choice. Our liability for a cancelled or undelivered booking is dealt with in clause 8.
      </p>
    </Section>

    <Section title="6. Your responsibilities">
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Give accurate contact and booking details. We are not responsible for a booking you miss because the details you gave us were wrong.</li>
        <li>Attend punctually, or cancel in time.</li>
        <li>Treat the person performing the service with respect. Abusive, threatening, discriminatory, or unsafe behaviour ends the service immediately, with no refund, and may end your access to the Platform.</li>
        <li>Disclose anything genuinely relevant to safe delivery, where the listing asks for it.</li>
        <li>Do not record, stream, or republish a session without the express consent of everyone involved.</li>
        <li>Do not arrange to pay outside the Platform for a booking started on it. If you do, these Booking Terms, our Refund Policy, and our support do not apply to that transaction, and we cannot help you if it goes wrong.</li>
      </ul>
    </Section>

    <Section title="7. If something goes wrong">
      <p>
        <strong>7.1</strong> If the service was not delivered, was materially different from its description, or fell
        below reasonable standards, tell us at <Mail /> within <strong>7 days</strong> of the scheduled time. Include
        your booking reference and what happened.
      </p>
      <p>
        <strong>7.2</strong> We will investigate, contact the host where relevant, and respond. Depending on what we
        find, we may offer a reschedule, a partial refund, or a full refund.
      </p>
      <p>
        <strong>7.3</strong> You can raise any problem with us first. As the marketplace we provide grievance redressal,
        take the matter up with the host, and facilitate a refund where one is due &mdash; you do not have to chase the
        host yourself.
      </p>
      <p>
        <strong>7.4</strong> Please come to us before raising a chargeback with your bank. A chargeback raised without
        contacting us usually takes longer to resolve than a direct request. We may contest chargebacks we consider
        unwarranted and provide the relevant transaction records to the payment provider.
      </p>
    </Section>

    <Section title="8. Responsibility for the service">
      {/* Marketplace liability position (asserted, marketplace model v4): the host is the
          seller and is responsible for performing the service; Meeticulous is the marketplace
          and provides grievance redressal + refund facilitation under the CP E-Commerce Rules
          2020, and does not exclude any right the guest has under the CPA 2019. */}
      <p>
        <strong>8.1</strong> The host is the seller and is responsible for supplying the service with reasonable skill
        and care and as described. Meeticulous operates the marketplace; it does not itself perform the service.
      </p>
      <p>
        <strong>8.2</strong> As the marketplace, we provide grievance redressal and facilitate refunds and
        cancellations. Where a booking was not delivered or was materially deficient, we will help resolve it and
        facilitate a refund of what you paid where one is due under the{' '}
        <Link to="/refund" className="text-primary hover:underline">Refund &amp; Cancellation Policy</Link>.
      </p>
      <p>
        <strong>8.3</strong> Our own liability for operating the Platform is not for indirect or consequential loss, or
        for loss caused by something outside our reasonable control.
      </p>
      <p>
        <strong>8.4</strong> Nothing in these Terms excludes or limits any right you have under the{' '}
        <strong>Consumer Protection Act, 2019</strong>, the Consumer Protection (E-Commerce) Rules, 2020, or any other
        law that cannot be excluded. Where anything here conflicts with such a right, that right prevails.
      </p>
    </Section>

    <Section title="9. Complaints, grievances, and disputes">
      <p>
        <strong>9.1</strong> Contact us first at <Mail /> or +91 8637758344. We aim to acknowledge within 48 hours and
        resolve within 15 working days.
      </p>
      <p>
        <strong>9.2 Grievance Officer.</strong> If you are not satisfied, escalate to our Grievance Officer,{' '}
        <strong>Shubham Narendra Datarkar</strong>, at <Mail />. Grievances are addressed within the timeframes
        required by applicable law.
      </p>
      <p>
        <strong>9.3</strong> These Booking Terms are governed by the laws of India.
      </p>
      <p>
        <strong>9.4</strong> Nothing here restricts your right as a consumer to bring proceedings in the consumer forum
        having jurisdiction where you reside or work, as provided by the Consumer Protection Act, 2019.
      </p>
    </Section>

    <Section title="10. Changes">
      <p>
        We may update these Booking Terms. <strong>The version in force at the time of your booking governs that
        booking</strong>, so a later change never affects a purchase you have already made. We publish revised versions
        with a new &ldquo;Last updated&rdquo; date.
      </p>
    </Section>

    <Section title="11. Marketplace operator details">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Marketplace operator:</strong> Rajmudra Media LLP, operating Meeticulous</li>
        <li><strong>Email:</strong> <Mail /> &middot; <strong>Phone:</strong> +91 8637758344</li>
        <li><strong>Grievance Officer:</strong> Shubham Narendra Datarkar</li>
        <li><strong>Registered &amp; operations office:</strong> Eureka CoWorking, 2nd &amp; 4th floor, 11, Friends Colony, Mate Square, Pratap Nagar Rd, P &amp; T Colony, Kotwal Nagar, Pratap Nagar, Nagpur, Maharashtra 440022, India</li>
      </ul>
    </Section>
  </LegalLayout>
);

export default GuestTerms;
