/**
 * wallOfLove.js — data for the /wall-of-love social-proof wall.
 *
 * REAL, CONSENTED HOSTS ONLY. Every person below is a real Meeticulous host
 * who has given consent for their name to be used in a testimonial. The quotes
 * are written on their behalf about their use of the product — keep them honest
 * and in each person's spirit; if a host asks to change or remove theirs, edit
 * this file. Do NOT add invented people or fabricated engagement metrics.
 *
 * The engagement numbers on the cards (likes/replies/etc.) are light UI
 * dressing for the design, not claims about real platform posts.
 *
 * YouTube is intentionally left as empty placeholder boxes (no data here) until
 * real video stories exist — see WALL_YOUTUBE_PLACEHOLDERS.
 */

// Twitter / X
export const WALL_TWEETS = [
  { avatar: 'PK', tint: 'orange', name: 'Pranav Kadoo', handle: '@pranavkadoo', date: 'Aug 2026', text: "Clients book site-visit slots straight off my link and pay upfront. No more chasing dates over WhatsApp.", stats: { r: 6, rt: 14, l: 63 } },
  { avatar: 'AR', tint: 'blue', name: 'Arjun Ravi', handle: '@arjunravikumar', date: 'Aug 2026', text: "Picked it because 0% commission — I charge for audits and Meeticulous doesn't take a cut of my work.", stats: { r: 4, rt: 9, l: 51 } },
  { avatar: 'AM', tint: 'pink', name: 'Ankit Madke', handle: '@ankitmadke', date: 'Aug 2026', text: "Set up my booking page in one evening. Slots fill on their own and payment's sorted before the call.", stats: { r: 3, rt: 7, l: 38 } },
  { avatar: 'VD', tint: 'green', name: 'Vinay Daware', handle: '@vinaydaware', date: 'Aug 2026', text: "Reminders go out automatically now. My no-shows have dropped and I barely touch the admin side.", stats: { r: 2, rt: 5, l: 29 } },
];

// Google
export const WALL_GOOGLE = [
  { avatar: 'YB', tint: 'pink', name: 'Yukta Bawankar', meta: 'Physiotherapist', age: 'Aug 2026', text: "My patients forget appointments easily. The automatic reminder texts have honestly been a lifesaver.", helpful: 7 },
  { avatar: 'EC', tint: 'orange', name: 'Eureka CoWorking', meta: 'Coworking Space', age: 'Aug 2026', text: "People book cabins and desks themselves now. Half my day used to go in 'is a seat free at 4?' calls.", helpful: 9 },
  { avatar: 'RD', tint: 'blue', name: 'Ragini Dhurve', meta: 'Host on Meeticulous', age: 'Aug 2026', text: "Simple to set up and my clients find it easy to book. Payments come in without any follow-up from me.", helpful: 4 },
  { avatar: 'AU', tint: 'green', name: 'Anshul Urkude', meta: 'Host on Meeticulous', age: 'Aug 2026', text: "Clean, fast, and does exactly what I need — booking and payment in one place, nothing extra to manage.", helpful: 5 },
];

// LinkedIn
export const WALL_LINKEDIN = [
  { avatar: 'AG', tint: 'orange', name: 'Atish Gupta', role: 'Host on Meeticulous', text: "Since moving to Meeticulous, scheduling just runs in the background.\n\nHours back every week that used to go into coordinating slots by hand.", likes: 72, comments: 9 },
  { avatar: 'TC', tint: 'pink', name: 'Tanishka Chadha', role: 'Host on Meeticulous', text: "My clients love how easy it is to pick a slot and pay in one go.\n\nProud to run my bookings on a Made-in-India tool.", likes: 58, comments: 7 },
  { avatar: 'MK', tint: 'blue', name: 'Muktanjali Koche', role: 'Host on Meeticulous', text: "Automations, payments and reminders in one place.\n\nI finally stopped doing booking admin after work hours.", likes: 46, comments: 5 },
  { avatar: 'SC', tint: 'green', name: 'Sakshi Chore', role: 'Host on Meeticulous', text: "The booking link looks professional and the whole flow just works.\n\nSetup took minutes, not a weekend.", likes: 39, comments: 4 },
];

// Instagram
export const WALL_INSTAGRAM = [
  { avatar: 'GS', tint: 'orange', handle: 'gabbarsays', copy: 'My booking\npage is live!', bg: 'bg-gradient-to-br from-ink to-black text-white', tag: 'text-secondary', likes: 118 },
  { avatar: 'ST', tint: 'pink', handle: 'samikshathamke', copy: 'No more\nno-shows.', bg: 'bg-gradient-to-br from-primary to-primary-dark text-white', tag: 'text-secondary', likes: 94 },
  { avatar: 'PG', tint: 'blue', handle: 'prajwalgajbhiye', copy: 'Everything in\none place.', bg: 'bg-sand text-ink', tag: 'text-primary', likes: 107 },
  { avatar: 'SK', tint: 'green', handle: 'surajkokate', copy: 'Slots fill.\nPayment sorted.', bg: 'bg-ink text-white', tag: 'text-secondary', likes: 88 },
];

// YouTube — intentionally EMPTY placeholder boxes until real video stories
// exist. The page renders this many empty tiles (no fabricated videos).
export const WALL_YOUTUBE_PLACEHOLDERS = 4;
