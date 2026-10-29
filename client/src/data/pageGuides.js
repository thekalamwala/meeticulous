// pageGuides.js: blog guides shown above the footer on product, tool, profession
// and glossary pages (PageGuides). Gives every guide crawlable links from the
// pages that carry the most intent. Titles are copied here so these pages do
// not import the full blogPosts bundle. Only link posts that are already live.
export const PAGE_GUIDES = {
  '/features/payments': [
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
    { slug: 'advance-payment-for-appointments', title: 'Advance Payment for Appointments: How to Take It in India' },
    { slug: 'payment-reminder-message', title: 'Payment Reminder Message: 20 WhatsApp & Email Templates' },
    { slug: 'calendly-upi-payments', title: 'Calendly UPI Payment: Not Native, and 3 Workarounds (2026)' },
    { slug: 'how-to-ask-client-for-payment-politely', title: 'How to Ask a Client for Payment Politely (+ Call Script)' },
  ],
  '/features/notifications': [
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'appointment-confirmation-message', title: 'Appointment Confirmation Message: 15 Templates for India' },
    { slug: 'manage-appointments-on-whatsapp', title: 'How to Manage Appointments on WhatsApp: 3 Setups Compared' },
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
    { slug: 'whatsapp-business-away-message', title: 'Away Message for Business: 40 WhatsApp Templates + Setup' },
  ],
  '/features/booking-pages': [
    { slug: 'booking-link-instagram-bio', title: 'Booking Link for Instagram Bio: Setup, WhatsApp & UPI' },
    { slug: 'book-button-google-business-profile', title: 'Booking Button on Google Business Profile: How to Add It' },
    { slug: 'how-to-book-an-appointment-online', title: 'How to Book an Appointment Online (+ Add a Button)' },
    { slug: 'what-a-booking-page-needs-in-india', title: 'What a booking page needs in India' },
    { slug: 'client-intake-form-questions', title: 'Client Intake Form Questions: Templates by Profession' },
  ],
  '/features/online-scheduling': [
    { slug: 'how-to-book-an-appointment-online', title: 'How to Book an Appointment Online (+ Add a Button)' },
    { slug: '30-minute-call-setup', title: '30 Minute Call: How to Set One Up and Run It Well' },
    { slug: 'scheduling-poll-group-meeting', title: 'Scheduling Poll: Find a Time a Group Can Meet' },
    { slug: 'appointment-cancellation-reschedule-message', title: 'Appointment Cancellation Message & Reschedule Templates' },
    { slug: 'best-appointment-booking-apps-india', title: 'Appointment Scheduling Apps in India: 8 Compared in ₹ (2026)' },
  ],
  '/features/availability': [
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
    { slug: '30-minute-call-setup', title: '30 Minute Call: How to Set One Up and Run It Well' },
    { slug: 'appointment-cancellation-reschedule-message', title: 'Appointment Cancellation Message & Reschedule Templates' },
  ],
  '/features/google-calendar': [
    { slug: 'two-bookings-one-slot', title: 'Two bookings, one slot, fifty people trying' },
    { slug: 'meeting-invitation-templates', title: 'Meeting Invitation: Email, WhatsApp, Hindi & RWA Templates' },
    { slug: 'scheduling-poll-group-meeting', title: 'Scheduling Poll: Find a Time a Group Can Meet' },
    { slug: 'book-button-google-business-profile', title: 'Booking Button on Google Business Profile: How to Add It' },
  ],
  '/features/client-management': [
    { slug: 'client-intake-form-questions', title: 'Client Intake Form Questions: Templates by Profession' },
    { slug: 'appointment-confirmation-message', title: 'Appointment Confirmation Message: 15 Templates for India' },
    { slug: 'start-online-consultation-practice-india', title: 'How to Start an Online Consultation Business in India' },
  ],
  '/features/digital-products': [
    { slug: 'how-to-sell-digital-products-online', title: 'How to Sell Digital Products Online: A Complete Guide' },
    { slug: 'how-to-become-paid-mentor', title: 'How to Become a Paid Mentor (Online, 1:1) in India' },
    { slug: 'how-to-make-money-from-home-india', title: 'How to Make Money From Home in India (2026): Real Ways' },
  ],
  '/features/reviews': [
    { slug: 'book-button-google-business-profile', title: 'Booking Button on Google Business Profile: How to Add It' },
    { slug: 'start-online-consultation-practice-india', title: 'How to Start an Online Consultation Business in India' },
    { slug: 'appointment-confirmation-message', title: 'Appointment Confirmation Message: 15 Templates for India' },
  ],
  '/features/analytics': [
    { slug: 'consultation-fees-india', title: 'How Much to Charge for Consultation in India (2026)' },
    { slug: 'how-to-price-coaching-services-india', title: 'How to Price Coaching Services in India (₹ Packages)' },
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
  ],
  '/tools/no-show-cost-calculator': [
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
    { slug: 'advance-payment-for-appointments', title: 'Advance Payment for Appointments: How to Take It in India' },
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
  ],
  '/tools/gst-calculator': [
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
    { slug: 'consultation-fees-india', title: 'How Much to Charge for Consultation in India (2026)' },
    { slug: 'how-to-ask-client-for-payment-politely', title: 'How to Ask a Client for Payment Politely (+ Call Script)' },
  ],
  '/earnings-calculator': [
    { slug: 'topmate-commission', title: 'Topmate Commission & Fees (2026): What You Keep per ₹1,000' },
    { slug: 'calendly-pricing-india', title: 'Calendly Pricing in India (2026): Plans in ₹ with GST' },
    { slug: 'consultation-fees-india', title: 'How Much to Charge for Consultation in India (2026)' },
    { slug: 'best-appointment-booking-apps-india', title: 'Appointment Scheduling Apps in India: 8 Compared in ₹ (2026)' },
  ],
  '/for/tutors': [
    { slug: 'how-to-start-online-tuition', title: 'How to Start Online Tuition in India: Batches, Fees & UPI' },
    { slug: 'tuition-fee-reminder-message', title: 'Tuition Fee Reminder Message: Hindi & English Templates' },
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
  ],
  '/for/fitness': [
    { slug: 'personal-trainer-charges-india', title: 'How Much Do Personal Trainers Charge in India? (2026)' },
    { slug: 'how-to-become-freelance-personal-trainer', title: 'How to Become a Freelance Personal Trainer' },
    { slug: 'advance-payment-for-appointments', title: 'Advance Payment for Appointments: How to Take It in India' },
  ],
  '/for/life-coaches': [
    { slug: 'how-to-price-coaching-services-india', title: 'How to Price Coaching Services in India (₹ Packages)' },
    { slug: 'start-online-consultation-practice-india', title: 'How to Start an Online Consultation Business in India' },
    { slug: 'client-intake-form-questions', title: 'Client Intake Form Questions: Templates by Profession' },
  ],
  '/for/business-consultant': [
    { slug: 'consultation-fees-india', title: 'How Much to Charge for Consultation in India (2026)' },
    { slug: 'start-online-consultation-practice-india', title: 'How to Start an Online Consultation Business in India' },
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
  ],
  '/for/therapists': [
    { slug: 'client-intake-form-questions', title: 'Client Intake Form Questions: Templates by Profession' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
    { slug: 'consultation-fees-india', title: 'How Much to Charge for Consultation in India (2026)' },
  ],
  '/for/yoga-instructors': [
    { slug: 'how-to-start-online-yoga-classes', title: 'How to Start Yoga Classes Online in India: Batches & UPI' },
    { slug: 'payment-reminder-message', title: 'Payment Reminder Message: 20 WhatsApp & Email Templates' },
    { slug: 'booking-link-instagram-bio', title: 'Booking Link for Instagram Bio: Setup, WhatsApp & UPI' },
  ],
  '/for/doctors': [
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
  ],
  '/for/dentists': [
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
  ],
  '/for/physiotherapists': [
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
  ],
  '/for/dermatologists': [
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
  ],
  '/for/pediatricians': [
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
  ],
  '/for/gynecologists': [
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
  ],
  '/for/ent-specialists': [
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
  ],
  '/for/ophthalmologists': [
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
  ],
  '/for/veterinarians': [
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
  ],
  '/for/nutritionists': [
    { slug: 'consultation-fees-india', title: 'How Much to Charge for Consultation in India (2026)' },
    { slug: 'client-intake-form-questions', title: 'Client Intake Form Questions: Templates by Profession' },
    { slug: 'payment-reminder-message', title: 'Payment Reminder Message: 20 WhatsApp & Email Templates' },
  ],
  '/for/salon': [
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'whatsapp-business-away-message', title: 'Away Message for Business: 40 WhatsApp Templates + Setup' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
    { slug: 'booking-link-instagram-bio', title: 'Booking Link for Instagram Bio: Setup, WhatsApp & UPI' },
  ],
  '/for/spa': [
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'whatsapp-business-away-message', title: 'Away Message for Business: 40 WhatsApp Templates + Setup' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
    { slug: 'booking-link-instagram-bio', title: 'Booking Link for Instagram Bio: Setup, WhatsApp & UPI' },
  ],
  '/for/photographers': [
    { slug: 'advance-payment-for-appointments', title: 'Advance Payment for Appointments: How to Take It in India' },
    { slug: 'booking-link-instagram-bio', title: 'Booking Link for Instagram Bio: Setup, WhatsApp & UPI' },
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
  ],
  '/for/freelancers': [
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
    { slug: 'how-to-ask-client-for-payment-politely', title: 'How to Ask a Client for Payment Politely (+ Call Script)' },
    { slug: 'payment-reminder-message', title: 'Payment Reminder Message: 20 WhatsApp & Email Templates' },
  ],
  '/for/sports-turf': [
    { slug: 'advance-payment-for-appointments', title: 'Advance Payment for Appointments: How to Take It in India' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
    { slug: 'whatsapp-business-away-message', title: 'Away Message for Business: 40 WhatsApp Templates + Setup' },
  ],
  '/for/astrologers': [
    { slug: 'consultation-fees-india', title: 'How Much to Charge for Consultation in India (2026)' },
    { slug: 'booking-link-instagram-bio', title: 'Booking Link for Instagram Bio: Setup, WhatsApp & UPI' },
    { slug: 'start-online-consultation-practice-india', title: 'How to Start an Online Consultation Business in India' },
  ],
  '/for/lawyers': [
    { slug: 'consultation-fees-india', title: 'How Much to Charge for Consultation in India (2026)' },
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
    { slug: 'client-intake-form-questions', title: 'Client Intake Form Questions: Templates by Profession' },
  ],
  '/for/chartered-accountants': [
    { slug: 'consultation-fees-india', title: 'How Much to Charge for Consultation in India (2026)' },
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
    { slug: 'client-intake-form-questions', title: 'Client Intake Form Questions: Templates by Profession' },
  ],
  '/for/architects': [
    { slug: 'consultation-fees-india', title: 'How Much to Charge for Consultation in India (2026)' },
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
    { slug: 'client-intake-form-questions', title: 'Client Intake Form Questions: Templates by Profession' },
  ],
  '/for/events': [
    { slug: 'advance-payment-for-appointments', title: 'Advance Payment for Appointments: How to Take It in India' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
    { slug: 'payment-reminder-message', title: 'Payment Reminder Message: 20 WhatsApp & Email Templates' },
  ],
  '/for/agencies': [
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
    { slug: 'advance-payment-for-appointments', title: 'Advance Payment for Appointments: How to Take It in India' },
    { slug: 'payment-reminder-message', title: 'Payment Reminder Message: 20 WhatsApp & Email Templates' },
  ],
  '/glossary/buffer-time': [
    { slug: '30-minute-call-setup', title: '30 Minute Call: How to Set One Up and Run It Well' },
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
  ],
  '/glossary/no-show': [
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
  ],
  '/glossary/advance-payment': [
    { slug: 'advance-payment-for-appointments', title: 'Advance Payment for Appointments: How to Take It in India' },
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
  ],
  '/glossary/cancellation-policy': [
    { slug: 'cancellation-policy-template', title: 'Cancellation Policy for Appointments: Templates + ₹ Examples' },
    { slug: 'appointment-cancellation-reschedule-message', title: 'Appointment Cancellation Message & Reschedule Templates' },
  ],
  '/glossary/reschedule': [
    { slug: 'appointment-cancellation-reschedule-message', title: 'Appointment Cancellation Message & Reschedule Templates' },
  ],
  '/glossary/reminder': [
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
  ],
  '/glossary/whatsapp-reminder': [
    { slug: 'appointment-reminder-templates', title: 'WhatsApp Reminder Message for Appointment: 36 Templates' },
    { slug: 'manage-appointments-on-whatsapp', title: 'How to Manage Appointments on WhatsApp: 3 Setups Compared' },
  ],
  '/glossary/upi': [
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
    { slug: 'calendly-upi-payments', title: 'Calendly UPI Payment: Not Native, and 3 Workarounds (2026)' },
  ],
  '/glossary/gst-invoice': [
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
    { slug: 'how-to-ask-client-for-payment-politely', title: 'How to Ask a Client for Payment Politely (+ Call Script)' },
  ],
  '/glossary/payment-gateway': [
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
    { slug: 'calendly-upi-payments', title: 'Calendly UPI Payment: Not Native, and 3 Workarounds (2026)' },
  ],
  '/glossary/payout': [
    { slug: 'collect-payments-from-clients-india', title: 'How to Collect Payments from Clients Online in India (2026)' },
  ],
  '/glossary/commission': [
    { slug: 'topmate-commission', title: 'Topmate Commission & Fees (2026): What You Keep per ₹1,000' },
    { slug: 'best-appointment-booking-apps-india', title: 'Appointment Scheduling Apps in India: 8 Compared in ₹ (2026)' },
  ],
  '/glossary/platform-fee': [
    { slug: 'topmate-commission', title: 'Topmate Commission & Fees (2026): What You Keep per ₹1,000' },
    { slug: 'calendly-pricing-india', title: 'Calendly Pricing in India (2026): Plans in ₹ with GST' },
  ],
  '/glossary/intake-form': [
    { slug: 'client-intake-form-questions', title: 'Client Intake Form Questions: Templates by Profession' },
    { slug: 'please-share-anything-that-will-help-prepare-for-our-meeting', title: '\'Please Share Anything That Will Help Prepare\': 30 Examples' },
  ],
  '/glossary/booking-page': [
    { slug: 'booking-link-instagram-bio', title: 'Booking Link for Instagram Bio: Setup, WhatsApp & UPI' },
    { slug: 'how-to-book-an-appointment-online', title: 'How to Book an Appointment Online (+ Add a Button)' },
  ],
  '/glossary/booking-link': [
    { slug: 'booking-link-instagram-bio', title: 'Booking Link for Instagram Bio: Setup, WhatsApp & UPI' },
    { slug: 'book-button-google-business-profile', title: 'Booking Button on Google Business Profile: How to Add It' },
  ],
  '/glossary/double-booking': [
    { slug: 'two-bookings-one-slot', title: 'Two bookings, one slot, fifty people trying' },
  ],
  '/glossary/availability': [
    { slug: 'how-to-book-an-appointment-online', title: 'How to Book an Appointment Online (+ Add a Button)' },
  ],
  '/glossary/meeting-link': [
    { slug: 'meeting-invitation-templates', title: 'Meeting Invitation: Email, WhatsApp, Hindi & RWA Templates' },
  ],
  '/glossary/placeholder-meeting': [
    { slug: 'meeting-invitation-templates', title: 'Meeting Invitation: Email, WhatsApp, Hindi & RWA Templates' },
    { slug: 'scheduling-poll-group-meeting', title: 'Scheduling Poll: Find a Time a Group Can Meet' },
  ],
  '/glossary/recurring-meeting': [
    { slug: 'meeting-invitation-templates', title: 'Meeting Invitation: Email, WhatsApp, Hindi & RWA Templates' },
    { slug: 'scheduling-poll-group-meeting', title: 'Scheduling Poll: Find a Time a Group Can Meet' },
  ],
  '/glossary/preferred-time': [
    { slug: 'scheduling-poll-group-meeting', title: 'Scheduling Poll: Find a Time a Group Can Meet' },
    { slug: 'meeting-invitation-templates', title: 'Meeting Invitation: Email, WhatsApp, Hindi & RWA Templates' },
  ],
  '/glossary/digital-product': [
    { slug: 'how-to-sell-digital-products-online', title: 'How to Sell Digital Products Online: A Complete Guide' },
  ],
  '/glossary/google-calendar-sync': [
    { slug: 'two-bookings-one-slot', title: 'Two bookings, one slot, fifty people trying' },
  ],
  '/glossary/lead-time': [
    { slug: 'how-to-reduce-no-shows', title: 'How to Reduce No-Shows: A Playbook for Indian Appointments' },
  ],
  '/glossary/soft-booking': [
    { slug: 'advance-payment-for-appointments', title: 'Advance Payment for Appointments: How to Take It in India' },
  ],
  '/glossary/direct-booking': [
    { slug: 'booking-link-instagram-bio', title: 'Booking Link for Instagram Bio: Setup, WhatsApp & UPI' },
    { slug: 'advance-payment-for-appointments', title: 'Advance Payment for Appointments: How to Take It in India' },
  ],
  '/glossary/availability-24-7': [
    { slug: 'whatsapp-business-away-message', title: 'Away Message for Business: 40 WhatsApp Templates + Setup' },
  ],
};
