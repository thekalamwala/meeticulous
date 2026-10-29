'use strict';
// intentHandlers.js — deterministic, on-brand answers + action cards for the known
// Bolt topics classified by intent.js. Each handler returns a short markdown answer
// and up to a few "cards" (identical shape to pills: { label, action:{type,value} },
// type 'route' navigates, 'send' re-asks the bot), so they ride the existing pills
// channel to the client with zero client/controller changes.
//
// Cards link ONLY to routes verified to exist in client/src/App.jsx. Money REVERSALS
// (refunds/disputes) are handled upstream by SENSITIVE_RE in botService before the
// intent layer runs, so the Payments handler never intercepts an actual dispute — it
// only explains how payments work and offers a human ticket.

const HANDLERS = {
  booking: {
    answer:
      "To book, open a host's page, pick a service and an open slot, then confirm — " +
      "you'll get a confirmation on WhatsApp and email. No account needed to start; " +
      "we verify you with a quick OTP.",
    cards: [
      { label: 'Browse services', action: { type: 'route', value: '/services' } },
      { label: 'My bookings',     action: { type: 'route', value: '/my-bookings' } },
    ],
  },
  reschedule: {
    answer:
      "You can reschedule or cancel from **My bookings** — open the booking and choose " +
      "Reschedule or Cancel. Any refund on a cancellation follows the host's policy shown " +
      "at checkout.",
    cards: [
      { label: 'My bookings',    action: { type: 'route', value: '/my-bookings' } },
      { label: 'How payments work', action: { type: 'send',  value: 'How do payments and invoices work?' } },
    ],
  },
  payments: {
    answer:
      "Payments run securely through Razorpay at checkout — your booking is confirmed once " +
      "payment succeeds, and a receipt/invoice is emailed to you. For a specific charge on " +
      "your account, a human on our team can look it up.",
    cards: [
      { label: 'How payments work', action: { type: 'send',  value: 'How do payments and invoices work?' } },
      { label: 'Raise a ticket',    action: { type: 'route', value: '/support' } },
    ],
  },
  calendar: {
    answer:
      "Hosts can connect Google Calendar so booked slots block automatically and new bookings " +
      "show up on your calendar. Manage it from your dashboard availability settings.",
    cards: [
      { label: 'Availability & calendar', action: { type: 'route', value: '/dashboard/availability' } },
    ],
  },
  notifications: {
    answer:
      "Booking confirmations and reminders go out over WhatsApp and email automatically. " +
      "Review the contact details we notify from in your profile settings.",
    cards: [
      { label: 'Profile settings', action: { type: 'route', value: '/dashboard/profile' } },
    ],
  },
  reviews: {
    answer:
      "After a completed booking, guests and hosts can review each other — you'll get a link " +
      "once the session is done, and reviews show on every host's public page.",
    cards: [
      { label: 'My reviews', action: { type: 'route', value: '/reviews' } },
    ],
  },
  host: {
    answer:
      "Becoming a host is free to start — sign up with Google, set up your profile and " +
      "services, and share your booking page. Paid plans (Host+/Studio) unlock more services " +
      "and features.",
    cards: [
      { label: 'Become a host',        action: { type: 'route', value: '/become-a-host' } },
      { label: 'See plans & pricing',  action: { type: 'send',  value: 'What does it cost?' } },
    ],
  },
};

// Clarify chips. Each value is phrased to contain exactly ONE topic keyword, so when
// the user taps it the next turn classifies to a single intent and never re-clarifies —
// this is the loop guard (no server state needed).
const CLARIFY_PROMPTS = {
  reschedule:    { label: 'Reschedule or cancel', value: 'I want to reschedule or cancel a booking' },
  payments:      { label: 'Payments & invoices',  value: 'How do payments and invoices work?' },
  calendar:      { label: 'Calendar sync',        value: 'How does calendar sync work?' },
  notifications: { label: 'Notifications',         value: 'How do booking notifications work?' },
  reviews:       { label: 'Reviews',               value: 'How do reviews work?' },
  host:          { label: 'Become a host',         value: 'How do I become a host?' },
  booking:       { label: 'Booking a service',     value: 'How do I book a service?' },
};

// handle(intent) → { answer, cards } | null
function handle(intent) {
  return HANDLERS[intent] || null;
}

// buildClarify(candidates) → { answer, cards } — one question + a 'send' chip per
// candidate topic. Cards are safe to run through pills.validate (dedupe + cap 3).
function buildClarify(candidates = []) {
  const cards = candidates
    .map((c) => CLARIFY_PROMPTS[c])
    .filter(Boolean)
    .map((p) => ({ label: p.label, action: { type: 'send', value: p.value } }));
  return {
    answer: "I can help with a few things there — which did you mean?",
    cards,
  };
}

module.exports = { handle, buildClarify, HANDLERS, CLARIFY_PROMPTS };
