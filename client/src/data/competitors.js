// competitors.js — what each competitor actually offers, checked against their
// live pricing page on CHECKED_AT. The /compare hub and every /compare/* page
// read competitor claims from HERE, so a re-check is one edit.
//
// Rules (comparative claims about named companies — get them right):
//   - Only state what the `source` page says. Prices are as published, in their
//     currency; never convert to ₹ in a way that hides their free plan.
//   - `null` = not stated on their pricing page → render as "Not listed", never "No".
//   - Meeticulous's own column comes from data/plans.js, never from this file.
//   - Re-check every entry (and bump CHECKED_AT) before shipping a page that uses it.

export const CHECKED_AT = '2026-10-12';
export const CHECKED_LABEL = 'October 2026';

export const COMPETITORS = {
  calendly: {
    name: 'Calendly',
    path: '/compare/calendly-alternative',
    domain: 'calendly.com',
    color: '#006BFF',
    source: 'https://calendly.com/pricing',
    freePlan: 'Yes: 1 event type, 1 calendar',
    paidFrom: '$10 per seat / month (Standard, billed yearly)',
    currency: 'USD',
    payments: 'Stripe or PayPal, on paid plans',
    upi: false,
    whatsapp: null,
    sms: null,
    commission: 'None',
    trial: null,
  },
  acuity: {
    name: 'Acuity Scheduling',
    path: '/compare/acuity-alternative',
    domain: 'acuityscheduling.com',
    color: '#1B7FA8',
    source: 'https://acuityscheduling.com/signup.php',
    freePlan: 'No (7-day free trial)',
    paidFrom: '$16 / month (Starter, billed yearly; $20 monthly)',
    currency: 'USD, taxes extra',
    payments: 'Stripe, Square, PayPal, Venmo',
    upi: false,
    whatsapp: null,
    sms: 'Standard plan and up',
    commission: 'None',
    trial: '7 days',
  },
  setmore: {
    name: 'Setmore',
    path: '/compare/setmore-alternative',
    domain: 'setmore.com',
    color: '#009DE0',
    source: 'https://www.setmore.com/pricing',
    freePlan: 'Yes: up to 4 users, unlimited appointments',
    paidFrom: '$5 per user / month (Pro, billed yearly)',
    currency: 'USD',
    payments: 'Square, Stripe, PayPal, LawPay',
    upi: false,
    whatsapp: null,
    sms: 'Pro plan (500 credits / month)',
    commission: 'None',
    trial: '30-day refund on Pro',
  },
  simplybook: {
    name: 'SimplyBook.me',
    path: '/compare/simplybook-alternative',
    domain: 'simplybook.me',
    color: '#2FA8C9',
    source: 'https://simplybook.me/en/pricing',
    freePlan: 'Yes: 50 bookings / month, 1 provider',
    paidFrom: '€11.90 / month (Basic, billed yearly)',
    currency: 'EUR',
    payments: 'Stripe, PayPal, Square + regional gateways',
    upi: null,
    whatsapp: 'Paid credits ($8 per 100)',
    sms: 'Paid credits ($8 per 100)',
    commission: 'None',
    trial: '14 days',
  },
  zoho: {
    name: 'Zoho Bookings',
    path: '/compare/zoho-bookings-alternative',
    domain: 'zoho.com',
    color: '#E42527',
    source: 'https://www.zoho.com/bookings/pricing.html',
    freePlan: 'Yes: 1 user (Forever Free)',
    paidFrom: '$6 per user / month (Basic, billed yearly)',
    currency: 'USD',
    payments: 'Razorpay, Stripe, PayPal, Authorize.Net and more',
    upi: 'Via its Razorpay integration',
    whatsapp: 'Yes',
    sms: 'Via SMS provider integrations',
    commission: 'None',
    trial: null,
  },
  topmate: {
    name: 'Topmate',
    path: '/compare/topmate-alternative',
    domain: 'topmate.io',
    color: '#FF3E5F',
    source: 'https://topmate.io/pricing',
    freePlan: 'No subscription fee; commission on each sale',
    paidFrom: 'No subscription; takes a cut of each sale',
    currency: 'INR',
    payments: 'Built in; Topmate collects and pays you out',
    upi: null,
    whatsapp: null,
    sms: null,
    commission: '10% of each sale (20% on marketplace sales to new customers)',
    trial: null,
  },
};

export const COMPETITOR_LIST = Object.entries(COMPETITORS).map(([key, c]) => ({ key, ...c }));
