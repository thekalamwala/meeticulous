import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";
import { SITE_URL, collectionPageJsonLd, breadcrumbJsonLd } from "../utils/seo";

// /changelog — public "What's New" timeline. Marketing-facing product updates,
// newest first. Entries are curated release notes (backdated to launch window).
// Tags drive the colour chip: New / Improved / Fixed / Security.
const TAG_STYLES = {
  New:      { bg: 'rgba(5,150,105,0.10)',  fg: '#059669' },
  Improved: { bg: 'rgba(37,99,235,0.10)',  fg: '#0079C1' },
  Fixed:    { bg: 'rgba(245,158,11,0.12)', fg: '#b45309' },
  Security: { bg: 'rgba(124,58,237,0.10)', fg: '#1DA1F2' },
};

// Newest release renders first. Entries are hand-authored below in roughly
// reverse-chronological order; the render step sorts by date defensively so a
// misplaced entry can't show out of order (see SORTED_RELEASES).
const RELEASES = [
  {
    date: 'Oct 7, 2026',
    title: 'Every feature explained, and a proper welcome for invited hosts',
    tags: ['New', 'Improved', 'Fixed'],
    points: [
      'Ten rebuilt feature pages — payments, scheduling, booking pages, availability, Google Calendar, notifications, clients, digital products, reviews and analytics — each with a live demo you can click through, and every claim checked against what the product actually does today.',
      'Invite links now open a full page — how it works, real pricing, answers to common questions and a clear way to get started — instead of trailing off with nowhere to go.',
      'Fixed a rare case where an ordinary form submission could get a visitor temporarily blocked from the site. Our protection against real attacks stays in place.',
    ],
  },
  {
    date: 'Oct 3, 2026',
    title: 'Calendar, setup and profession pages, tightened',
    tags: ['Improved', 'Fixed'],
    points: [
      'New bookings in your Google Calendar now show you as attending, instead of “awaiting” a reply from yourself.',
      'Skipping your first service during setup now asks you to confirm — a page with at least one service is a page guests can actually book.',
      'Friendly mascot art on 13 profession pages, cleaner heroes, and richer behind-the-scenes details so Google and AI assistants understand exactly who each page is for.',
    ],
  },
  {
    date: 'Sep 28, 2026',
    title: 'A sharper profile, a smoother booking',
    tags: ['Improved', 'Fixed'],
    points: [
      'Host pages put price and ratings up front, service cards hug their content, and phones get a sticky “Book a session” bar.',
      'Booking now shows clearly labelled steps — Time, Details, Verify, Pay, Done — plus what you can count on: instant confirmation, a calendar invite, reminders and secure payment.',
      'Google- and LinkedIn-verified badges are now awarded automatically, no longer vanish once you start earning, and explain themselves when tapped.',
      'Digital products now work like services: a clean 16:9 cover, fees and GST shown upfront, a GST invoice with every purchase, and checkout codes that arrive on WhatsApp and verify first time.',
    ],
  },
  {
    date: 'Sep 27, 2026',
    title: 'Booking pages built for your profession — 18 and counting',
    tags: ['New'],
    points: [
      'Bespoke landing pages for the work you actually do — consultants, dentists, doctors, physiotherapists, dermatologists, ENT and eye specialists, nutritionists, life coaches, salons, spas, vets, pediatricians, astrologers, architects, chartered accountants, lawyers and sports turfs.',
      'A new “Who it’s for” menu lays them all out, so the right guests land on a page that speaks their language.',
    ],
  },
  {
    date: 'Sep 27, 2026',
    title: 'Two plans, plainly priced',
    tags: ['Improved', 'New'],
    points: [
      'Rebuilt the pricing page as a simple journey — Operate to Grow — so it’s obvious which plan fits where you are.',
      'Clearer, more honest pricing on the homepage too: no surprises, just what you pay and what you keep.',
    ],
  },
  {
    date: 'Sep 26, 2026',
    title: 'Show you’re the real deal with LinkedIn',
    tags: ['New'],
    points: [
      'Link your LinkedIn and earn a verified badge on your profile — an easy, extra signal of trust for the guests deciding to book you.',
    ],
  },
  {
    date: 'Sep 25, 2026',
    title: 'You decide who sees your page',
    tags: ['New'],
    points: [
      'New visibility controls let you keep your page public, unlisted, or share-by-link only — your call.',
      'Rather quote per job? Set any service to “price on request” and talk numbers with the guest directly.',
    ],
  },
  {
    date: 'Sep 25, 2026',
    title: 'A warm welcome for new guests',
    tags: ['Improved'],
    points: [
      'New guests now get a friendly welcome email from our founder — a small hello that sets the tone from the first booking.',
    ],
  },
  {
    date: 'Sep 24, 2026',
    title: 'Your next step, always in view',
    tags: ['New'],
    points: [
      'Your dashboard now nudges you toward the one thing that moves you forward — finish setup, add a service, share your link, get verified — so getting booked never stalls on “what now?”.',
    ],
  },
  {
    date: 'Sep 15, 2026',
    title: 'A faster, sharper, more accessible site',
    tags: ['Improved'],
    points: [
      'Images now reserve their space before they load, so pages stop jumping around as you reach for a button.',
      'Stronger colour contrast and a tightened security policy across the site — quicker to read, safer to use.',
    ],
  },
  {
    date: 'Sep 11, 2026',
    title: 'See your take-home, redesigned',
    tags: ['Improved'],
    points: [
      'The earnings calculator got a cleaner rebuild — set your price and plan and see exactly what lands in your account, before you commit to anything.',
    ],
  },
  {
    date: 'Sep 10, 2026',
    title: 'Easier to find on Google and AI answers',
    tags: ['Improved'],
    points: [
      'Richer, machine-readable details on every profile and service page, so search engines — and the new AI assistants people ask — can understand and surface what you offer.',
      'Cleaner titles, descriptions and internal links across the site to help the right guests discover you.',
    ],
  },
  {
    date: 'Sep 7, 2026',
    title: 'A calmer homepage — and a mobile crash squashed',
    tags: ['Improved', 'Fixed'],
    points: [
      'A tighter, calmer homepage with a gentler hero and a clearer path to getting started.',
      'Fixed a rare white-screen on phones when the browser’s auto-translate was on — the page now survives translation instead of blanking out.',
    ],
  },
  {
    date: 'Sep 5, 2026',
    title: 'GST reports, ready for your accountant',
    tags: ['New'],
    points: [
      'Studio hosts can now pull GST-ready reports and exports straight from the dashboard — your month’s paperwork in a couple of taps.',
    ],
  },
  {
    date: 'Sep 2, 2026',
    title: 'Payments and refunds you can count on',
    tags: ['Fixed', 'Improved'],
    points: [
      'An interrupted payment now picks up cleanly where it left off, instead of stranding a half-finished booking.',
      'Eligible refunds process automatically, and a batch of guards makes sure a booking can never get stuck in a wrong state.',
    ],
  },
  {
    date: 'Aug 31, 2026',
    title: 'One number, both sides of the table',
    tags: ['New'],
    points: [
      'Host and want to book someone yourself? Sign into your guest space with the same phone number — one identity, both experiences, no second account.',
    ],
  },
  {
    date: 'Aug 31, 2026',
    title: 'The calm way to sell your time',
    tags: ['Improved'],
    points: [
      'Refreshed how we describe Meeticulous across the site and profession pages — clearer, calmer, and honest about what we do: the booking, payments and reminders around your work, handled.',
    ],
  },
  {
    date: 'Aug 30, 2026',
    title: 'All your invoices, one tab',
    tags: ['New'],
    points: [
      'A dedicated Invoices tab in your dashboard gathers every GST invoice in one place — find and download any of them in seconds.',
    ],
  },
  {
    date: 'Aug 29, 2026',
    title: 'Notifications that keep up — and stay signed in',
    tags: ['New', 'Improved'],
    points: [
      'A real-time bell brings new bookings, reviews and alerts to you the moment they happen — no refresh needed.',
      'Notices now clear themselves once you’ve fixed the thing they were about, and you’ll hear about a failed renewal or a released referral reward right away.',
      'And you stay signed in across tabs and after a while away, instead of being bounced back to login.',
    ],
  },
  {
    date: 'Aug 25, 2026',
    title: 'Chat with us, right inside your dashboard',
    tags: ['New', 'Improved'],
    points: [
      'A new Chat tab for hosts and guests — ask Bolt anything and get an instant answer, now written like a real message with bold text, lists and tappable links instead of raw symbols.',
      'Need a person? During support hours (Mon–Fri, 10am–6pm IST) we connect you to our team; outside them you can leave a detailed note and we’ll reply right there when we’re back — Bolt stays on hand the whole time.',
      'A typing indicator shows when a reply’s on the way, and a small badge on the Chat tab lets you know the moment we answer.',
    ],
  },
  {
    date: 'Aug 23, 2026',
    title: 'A faster path from sign-up to your first booking',
    tags: ['New', 'Improved'],
    points: [
      'Setting up is shorter and clearer — pick what you do, add a few details, and you’re live, with fewer questions along the way.',
      'The “you’re live” moment now lets you add your first service right there, so your page can take bookings the instant you finish.',
      'Start free and upgrade whenever you like — no plan wall before you’ve even gone live.',
      'Listing an in-person service now always carries your venue, so guests get directions every time.',
    ],
  },
  {
    date: 'Aug 21, 2026',
    title: 'Signing up is smoother than ever',
    tags: ['Fixed'],
    points: [
      'Fixed a rare dead-end that could leave you stuck on the last step with nothing to tap — you can always get live now.',
      '“See all categories” now saves your pick properly instead of erroring, and your progress is never lost if you step back.',
      'The set-up flow shrugs off a flaky connection and keeps you on the right step, instead of showing the wrong one.',
    ],
  },
  {
    date: 'Aug 21, 2026',
    title: 'A moment worth sharing',
    tags: ['New'],
    points: [
      'Right after you publish, a share moment lets you send your booking link to WhatsApp, Messages or anywhere else in a single tap.',
    ],
  },
  {
    date: 'Aug 19, 2026',
    title: 'Booking updates you can count on',
    tags: ['Fixed'],
    points: [
      'Your booking confirmation now always arrives — however the payment cleared, on every path.',
      'WhatsApp booking and reschedule messages reliably reach you and your guests; a template mismatch had been quietly dropping some.',
      'Plus a batch of reliability fixes across booking and messaging — including profile saving for some older accounts.',
    ],
  },
  {
    date: 'Aug 17, 2026',
    title: 'Your week, recapped',
    tags: ['New'],
    points: [
      'A friendly weekly email rounds up your bookings, earnings and anything that needs attention — so you can see how things are going at a glance.',
    ],
  },
  {
    date: 'Aug 15, 2026',
    title: 'Verify when you’re ready, not before',
    tags: ['Improved'],
    points: [
      'Get set up and start sharing your page first — we now ask you to verify your identity only once you’ve made your first earning.',
      'Less paperwork up front, and a gentle nudge at exactly the right time, so your payouts are ready when you are.',
    ],
  },
  {
    date: 'Aug 13, 2026',
    title: 'Write with Bolt, back to full speed',
    tags: ['Fixed'],
    points: [
      'Fixed an issue that could stop Write with Bolt from drafting your listing — it’s back to writing your description, inclusions and FAQs in seconds.',
    ],
  },
  {
    date: 'Aug 13, 2026',
    title: 'Codes that submit themselves',
    tags: ['Improved'],
    points: [
      'Type the last digit of a verification code and we submit it for you — one less tap when you sign in or confirm a booking.',
    ],
  },
  {
    date: 'Aug 12, 2026',
    title: 'Pick your plan at signup, verify faster',
    tags: ['New', 'Improved'],
    points: [
      'You can now choose our Studio plan right as you set up your page — go live with everything unlocked in a single step, or start free and upgrade whenever you like.',
      'Getting verified is simpler too: we now ask only for your PAN, bank details, and address — no documents to upload or wait on.',
    ],
  },
  {
    date: 'Aug 7, 2026',
    title: 'Automatic GST invoices',
    tags: ['New'],
    points: [
      'Every payment now generates a proper GST invoice automatically — it arrives in your email and is always available to download from your dashboard.',
      'Subscription receipts are covered the same way, so your paperwork is ready whenever you need it.',
    ],
  },
  {
    date: 'Jul 30, 2026',
    title: 'A friendlier way to set up your page',
    tags: ['New', 'Improved'],
    points: [
      'Setting up as a host is now a guided flow: start by picking the persona that best describes what you do, instead of hunting through a long category list.',
      'Fill in your details on one screen and watch your booking page take shape beside you in a live preview — no guessing how it’ll look.',
      'The last step is a clear “publish” moment, so you know exactly when you’re live.',
    ],
  },
  {
    date: 'Jul 25, 2026',
    title: 'See what you’ll earn',
    tags: ['New'],
    points: [
      'A new earnings calculator on the pricing page lets you preview your take-home at any price and plan — before you commit to anything.',
    ],
  },
  {
    date: 'Jul 24, 2026',
    title: 'A cleaner Google sign-in',
    tags: ['Fixed', 'Security'],
    points: [
      'Signing in with Google no longer shows a warning screen about the app being unverified — you go straight from Google to your dashboard.',
      'We also trimmed what we ask Google for down to the minimum: permission to manage your booking events, check when you’re busy, and read your calendar’s time zone. Nothing more.',
      'The first time you sign in after this update, Google will ask you to confirm those permissions once. After that it’s business as usual, and your calendar keeps syncing exactly as before.',
    ],
  },
  {
    date: 'Jul 23, 2026',
    title: 'Manage your booking without an account',
    tags: ['New'],
    points: [
      'Booked as a guest without signing up? Every confirmation now carries a private link to your booking — open it any time to see the details or cancel, no account needed.',
      'The link is right in your confirmation email, so it’s always one click away.',
      'And if you later sign in with the same number, any bookings you made as a guest come with you and show up in your dashboard.',
    ],
  },
  {
    date: 'Jul 23, 2026',
    title: 'A noticeably faster site',
    tags: ['Improved'],
    points: [
      'Host profiles and service pages no longer jump around while loading — content now settles into place the first time, instead of shifting under your finger as you reach for a button.',
      'Trimmed what loads before the first paint and cached the heavy bits properly, so pages appear sooner, especially on mobile data.',
    ],
  },
  {
    date: 'Jul 23, 2026',
    title: 'Safer checkout',
    tags: ['Fixed'],
    points: [
      'Closed a gap where an impatient double-tap on Confirm or Pay could start the same booking twice. One tap, one booking — every time.',
    ],
  },
  {
    date: 'Jul 23, 2026',
    title: 'Easier to read, easier to find things',
    tags: ['Improved'],
    points: [
      'Better colour contrast across the homepage and pricing page, and proper labelling throughout, so the site works well with screen readers and in bright sunlight alike.',
      'Reorganised the header and footer so the page you want is where you’d expect it.',
      'Cleared out half-finished profile fields that asked for details we weren’t using yet.',
    ],
  },
  {
    date: 'Jul 23, 2026',
    title: 'Stronger account protection',
    tags: ['Security'],
    points: [
      'Passwords now have to meet a real strength bar wherever you set one.',
      'We also listen for security alerts from Google about connected accounts, so if something looks wrong with a linked Google account, we can act on it quickly.',
    ],
  },
  {
    date: 'Jul 22, 2026',
    title: 'Pricing, reimagined',
    tags: ['Improved', 'New'],
    points: [
      'A cleaner pricing page with our plans laid out side by side, so it’s easy to compare what each one includes and pick the right fit.',
      'New Enterprise option for agencies and larger teams who need bookings across a whole roster.',
    ],
  },
  {
    date: 'Jul 22, 2026',
    title: 'Bolt keeps getting smarter',
    tags: ['Improved'],
    points: [
      'Our support assistant now answers more questions accurately, links you to the right help article, and hands you to a human more reliably when you’d rather talk to one.',
    ],
  },
  {
    date: 'Jul 19, 2026',
    title: 'A fresh new homepage',
    tags: ['Improved'],
    points: [
      'Rebuilt the homepage around a cleaner, Google-first welcome — clearer messaging, a tighter features grid and a faster path to getting started.',
    ],
  },
  {
    date: 'Jul 19, 2026',
    title: 'Moments',
    tags: ['New'],
    points: [
      'A little archive of the moments worth celebrating — playful, Google-Doodle-style pages we’ll keep adding to.',
    ],
  },
  {
    date: 'Jul 19, 2026',
    title: 'Cleaner photo uploads',
    tags: ['Fixed'],
    points: [
      'Fixed a faint coloured line that could get baked into photos while cropping — your avatar and service images now upload crisp and border-free.',
    ],
  },
  {
    date: 'Jul 19, 2026',
    title: 'Sharper preview when you share a host',
    tags: ['Fixed'],
    points: [
      'Paste a host’s profile link into WhatsApp, Facebook or a message and it now shows their photo in a proper preview card. Before, the photo came through too small and some apps showed no card at all.',
    ],
  },
  {
    date: 'Jul 18, 2026',
    title: 'Meet Bolt, your support assistant',
    tags: ['New'],
    points: [
      'A friendly chat assistant, right on the site — ask how anything works and Bolt answers in seconds, drawing from our real help docs and linking you to the source.',
      'It remembers the conversation, so you can ask follow-ups naturally, and hands you to a human whenever you’d rather talk to one.',
    ],
  },
  {
    date: 'Jul 18, 2026',
    title: 'Find anything, faster',
    tags: ['Improved'],
    points: [
      'A redesigned search launcher makes hosts, services and pages easier to reach.',
      'Our Help centre now has full-text search, so the answer you need is only a keyword away.',
    ],
  },
  {
    date: 'Jul 18, 2026',
    title: 'A wall of love',
    tags: ['New'],
    points: [
      'A new home for the kind words creators and guests share about Meeticulous, gathered from across the web in one place.',
    ],
  },
  {
    date: 'Jul 17, 2026', version: 'v3.69',
    title: 'Your listing, written for you',
    tags: ['New'],
    points: [
      'Meet Write with Bolt: give your service a title and our AI drafts the rest — description, what’s included, FAQs and more — in seconds. Everything stays yours to edit; it’s a head start, not a template.',
      'Not quite your voice? Regenerate with a quick nudge like “make it warmer” until it feels right.',
    ],
  },
  {
    date: 'Jul 15, 2026', version: 'v3.76',
    title: 'Your clients, all in one place',
    tags: ['New'],
    points: [
      'A built-in CRM for Studio hosts — every guest who books becomes a client, automatically, with their history in one view.',
      'Keep private notes and files against each client, add your own labels, and export the whole list to CSV whenever you need it.',
    ],
  },
  {
    date: 'Jul 15, 2026', version: 'v3.78',
    title: 'In-person bookings now come with a map',
    tags: ['New', 'Improved'],
    points: [
      'Set your venue once and every offline, in-person booking carries a Google Maps link — right in the confirmation, the calendar invite and the WhatsApp message.',
      'Guests know exactly where to go; online sessions keep their Meet links as before.',
    ],
  },
  {
    date: 'Jul 15, 2026',
    title: 'Your contacts stay yours',
    tags: ['Improved', 'Security'],
    points: [
      'Phone numbers are now shown only when they’re genuinely needed for a booking — keeping guest and host contacts protected.',
      'Email and location details stay exactly where you expect them.',
    ],
  },
  {
    date: 'Jul 14, 2026', version: 'v3.77',
    title: 'Refer a host, earn cash',
    tags: ['New'],
    points: [
      'Love Meeticulous? Refer a fellow creator and earn a cash reward once they’re up and running on a paid plan.',
      'Track your referrals and rewards straight from your dashboard — clean and hands-off.',
    ],
  },
  {
    date: 'Jul 13, 2026', version: 'v3.75',
    title: 'Meeticulous, for teams',
    tags: ['New'],
    points: [
      'A new Enterprise page for agencies, studios and larger teams who need to run bookings across a whole roster from one place.',
      'Tell us what you need and our team will tailor a plan and get you set up.',
    ],
  },
  {
    date: 'Jul 12, 2026',
    title: 'Share your page in one tap',
    tags: ['Improved'],
    points: [
      'A native share button on your dashboard — send your booking link straight to WhatsApp, Messages or anywhere else using your phone’s own share sheet.',
    ],
  },
  {
    date: 'Jul 11, 2026', version: 'v3.72',
    title: 'A smarter way to get discovered',
    tags: ['New', 'Improved'],
    points: [
      'Rebuilt Explore ranks real services by quality and relevance, so guests searching for what you offer see the best matches first.',
      'Search and public listings are faster and crash-proof, even under heavy load.',
    ],
  },
  {
    date: 'Jul 11, 2026', version: 'v3.71',
    title: 'Your calendar, never double-booked',
    tags: ['Improved', 'Fixed'],
    points: [
      'Hardened the booking engine so two guests can never grab the same slot — even in the same split second — while a short grace window keeps genuine back-to-back bookings flowing.',
    ],
  },
  {
    date: 'Jul 9, 2026',
    title: 'The mobile dashboard keeps getting better',
    tags: ['Improved'],
    points: [
      'More native-app polish on mobile: an infinite-scroll bookings feed, smoother sheets and forms, friendly success screens and a clearer step-by-step onboarding progress bar.',
      'Set your hours per day with a simple open/closed toggle, and pick your brand colour from a proper colour wheel.',
    ],
  },
  {
    date: 'Jul 8, 2026', version: 'v3.68',
    title: 'Get verified, get paid',
    tags: ['New', 'Security'],
    points: [
      'Verify your identity in four quick steps — your details are encrypted and stored privately, never shown on your page.',
      'A verified badge builds trust with guests, and clearing verification unlocks your payouts.',
      'Prefer a face-to-face check? A video-KYC option is on the way.',
    ],
  },
  {
    date: 'Jul 7, 2026', version: 'v3.67',
    title: 'Proper GST tax invoices, done for you',
    tags: ['New', 'Improved'],
    points: [
      'Every booking and subscription now generates a clean, GST-compliant tax invoice — with the right place-of-supply and tax split worked out automatically.',
      'Download any invoice from your dashboard, or opt in for one right at checkout.',
      'No spreadsheets, no manual maths — just receipts you and your accountant can rely on.',
    ],
  },
  {
    date: 'Jul 7, 2026',
    title: 'An app-like experience on your phone',
    tags: ['Improved'],
    points: [
      'The host dashboard now feels like a native app on mobile — smooth page transitions, swipe gestures and tap-friendly confirmations.',
      'Faster, calmer and built for running your bookings on the go.',
    ],
  },
  {
    date: 'Jul 6, 2026',
    title: 'Pages built for your profession',
    tags: ['New'],
    points: [
      'New landing pages tailored to your line of work — doctors, lawyers, salons, fitness coaches, consultants and more — so the right guests find you faster.',
      'Get in touch anytime through our new contact page.',
    ],
  },
  {
    date: 'Jul 3, 2026', version: 'v3.64',
    title: 'Reviews you can trust',
    tags: ['Improved'],
    points: [
      'Reviews that break our community guidelines can now be taken down — so the ratings on every profile and service page stay honest and fair.',
      'Nothing changes for genuine feedback: your real reviews keep showing exactly where they always have.',
    ],
  },
  {
    date: 'Jul 1, 2026', version: 'v3.59',
    title: 'Turn one session into the next',
    tags: ['New', 'Improved'],
    points: [
      'Rebook nudges for Studio hosts: after a completed session, your guest gets a warm “ready for another?” reminder — at 3 days and again at 21 days — with a one-tap link straight back to your page.',
      'Completely hands-off — it automatically skips anyone who’s already rebooked, so the right people get nudged at the right time.',
      'Sent by email today, with WhatsApp ready to switch on.',
      'Behind the scenes: sharper product analytics so we can see what’s driving bookings and keep building what helps you get booked.',
    ],
  },
  {
    date: 'Jun 29, 2026', version: 'v3.54',
    title: 'Reminders that actually show up — even last-minute',
    tags: ['New', 'Improved'],
    points: [
      'Automatic booking reminders before every session — a 24-hour heads-up on Host+, plus a 1-hour nudge and reschedule alerts on Studio.',
      'Booked something at the last minute? A catch-up sweep makes sure short-notice bookings still get their reminder in time.',
    ],
  },
  {
    date: 'Jun 28, 2026', version: 'v3.53',
    title: 'A booking page that looks and feels like you',
    tags: ['New', 'Improved'],
    points: [
      'Dress up your service page with animated, brand-tinted backgrounds — curated and ready to pick.',
      'New profession-scoped service categories so you tag your work with the labels that actually fit your craft.',
      'A slimmer, calmer navigation with a redesigned profile menu and a full Use Cases mega-menu — fewer links, faster to what you need.',
    ],
  },
  {
    date: 'Jun 28, 2026',
    title: 'Get to know Meeticulous',
    tags: ['New'],
    points: [
      'A revamped About page — our story, the team and the brands building with us.',
      'A new Blog where we share what we’re building, in public.',
    ],
  },
  {
    date: 'Jun 27, 2026', version: 'v3.5',
    title: 'A dashboard that actually works the way you do',
    tags: ['Improved', 'Fixed'],
    points: [
      'Rebuilt the host dashboard: sticky sidebar, sticky top bar with profile, notifications and one-tap support.',
      'Mobile menus now open as native-feeling bottom sheets instead of cramped dropdowns.',
      'Earnings, pending payouts and “needs action” counts are now accurate to the rupee — cancelled bookings no longer inflate your numbers.',
    ],
  },
  {
    date: 'Jun 25, 2026', version: 'v3.37',
    title: 'Sell digital products alongside your sessions',
    tags: ['New'],
    points: [
      'Upload an e-book, template or guide and sell it straight from your booking page — no extra tools.',
      'Buyers get an instant, secure download link by email the moment payment clears.',
      'Every sale lands in your ledger with a clean GST invoice.',
    ],
  },
  {
    date: 'Jun 24, 2026', version: 'v3.31',
    title: 'Become a host in under 60 seconds',
    tags: ['New', 'Improved'],
    points: [
      'New Google-first onboarding: one tap connects your identity, calendar and Meet links — no passwords to invent.',
      'Claim your booking link (meeticulous.com/yourname) right at the start and keep it forever.',
      'Smoother mobile navigation with a full-screen drawer and faster page loads.',
    ],
  },
  {
    date: 'Jun 23, 2026', version: 'v3.28',
    title: 'Receipts your customers will actually keep',
    tags: ['Improved', 'Security'],
    points: [
      'Premium, wallet-style invoices with your branding, GST breakup and a one-tap download.',
      'Refreshed every transactional email with a cleaner, friendlier identity.',
      'Hardened the platform after a full security review — tighter data access across the board.',
    ],
  },
  {
    date: 'Jun 22, 2026', version: 'v3.23',
    title: 'A homepage that tells your story',
    tags: ['New', 'Fixed'],
    points: [
      'Reimagined homepage with live counters, real creator stories and a clearer path to “Let’s Get Started”.',
      'Fixed a sign-in hiccup for visitors arriving on the www. version of the site.',
    ],
  },
  {
    date: 'Jun 20, 2026', version: 'v3.21',
    title: '60 industries, one booking page',
    tags: ['New'],
    points: [
      'Pick from 60+ industry categories so guests instantly understand what you offer.',
      'Tag each service with its own category for cleaner, more discoverable pages.',
    ],
  },
  {
    date: 'Jun 19, 2026', version: 'v3.18',
    title: 'Meeticulous goes live 🚀',
    tags: ['New'],
    points: [
      'Production launch — payments, calendars and notifications running on hardened, monitored infrastructure.',
      'Automated backups, error tracking and a documented deploy pipeline behind the scenes.',
    ],
  },
  {
    date: 'Jun 18, 2026', version: 'v3.17',
    title: 'Your link is yours, forever',
    tags: ['New', 'Improved'],
    points: [
      'Permanent usernames: change your handle and old links keep redirecting — never lose a booking.',
      'Big speed-ups on public booking pages: lighter scripts, self-hosted fonts, snappier first paint.',
    ],
  },
  {
    date: 'Jun 17, 2026', version: 'v3.16',
    title: 'Two-way reviews + a home for your bookings',
    tags: ['New', 'Security'],
    points: [
      'Guests and hosts can now review each other — build trust both ways.',
      'A dedicated dashboard for guests to track upcoming and past bookings.',
      'Admin accounts are now protected with mandatory two-factor authentication.',
    ],
  },
  {
    date: 'Jun 16, 2026', version: 'v3.12',
    title: 'Get paid, then get paid again',
    tags: ['New'],
    points: [
      'Subscriptions with auto-renew — monthly or annual — powered by Razorpay UPI AutoPay.',
      'New settlement engine tracks your clearing balance from booking to payout.',
      'Hosts can verify their WhatsApp number for trusted, branded notifications.',
    ],
  },
  {
    date: 'Jun 15, 2026', version: 'v3.7',
    title: 'Respect for the inbox',
    tags: ['New'],
    points: [
      'One-click unsubscribe for marketing emails — booking and payment emails always get through.',
      'Added clear Help, Privacy and Unsubscribe pages.',
    ],
  },
  {
    date: 'Jun 14, 2026', version: 'v3.2',
    title: 'Log in with just your phone',
    tags: ['New', 'Improved'],
    points: [
      'Phone-first login — your number is your identity, a one-time code is your key.',
      'Behind the scenes: feature switches let us roll out and roll back safely without downtime.',
    ],
  },
  {
    date: 'Jun 10, 2026',
    title: 'Notifications that reach people',
    tags: ['New'],
    points: [
      'A unified notification engine sends booking confirmations and reminders over email and WhatsApp.',
      'Queued, retried and logged — so the right message lands at the right time.',
    ],
  },
  {
    date: 'Jun 5, 2026',
    title: 'Reviews land on Meeticulous',
    tags: ['New'],
    points: [
      'Guests can leave a rating and a few words after every session.',
      'Your best reviews shine right on your public profile.',
    ],
  },
  {
    date: 'Jun 1, 2026',
    title: 'Calendars and Meet links, on autopilot',
    tags: ['New'],
    points: [
      'Connect Google Calendar once — busy times are blocked automatically, double-bookings disappear.',
      'Every online session gets a Google Meet link created for you.',
    ],
  },
  {
    date: 'May 24, 2026',
    title: 'A booking flow guests breeze through',
    tags: ['Improved'],
    points: [
      'Cleaner date and time picker with real-time availability.',
      'Guests can book with a quick WhatsApp code — no account, no friction.',
    ],
  },
  {
    date: 'May 18, 2026',
    title: 'Payments are live with Razorpay',
    tags: ['New'],
    points: [
      'Take secure card, UPI and netbanking payments at checkout.',
      'Money flows to verified hosts with GST-ready invoices on every order.',
    ],
  },
  {
    date: 'May 12, 2026',
    title: 'Publish your services',
    tags: ['New'],
    points: [
      'Create services with pricing, duration and a description — your storefront in minutes.',
      'Share one link and let guests book the slots you choose.',
    ],
  },
  {
    date: 'May 6, 2026',
    title: 'Sign in over WhatsApp',
    tags: ['New'],
    points: [
      'One-time codes delivered to WhatsApp — the fastest way for guests to verify and book.',
    ],
  },
  {
    date: 'May 1, 2026',
    title: 'Hello, Meeticulous 🦥',
    tags: ['New'],
    points: [
      'The very first build: a home for creators and professionals to get booked and get paid at 0% commission.',
      'Thanks for being here this early — the best is still ahead.',
    ],
  },
];

// Sort by date, newest first. `new Date('Jul 19, 2026')` parses the display
// string fine; sort is stable so same-day entries keep their authored order.
const SORTED_RELEASES = [...RELEASES].sort((a, b) => new Date(b.date) - new Date(a.date));

const Tag = ({ label }) => {
  const s = TAG_STYLES[label] || TAG_STYLES.New;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {label}
    </span>
  );
};

const Changelog = () => {
  useEffect(() => {
    const prev = document.title;
    document.title = "What's New · Meeticulous";
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="relative">
      <Seo
        title="What's New — Meeticulous Changelog"
        description="Every feature, improvement, and fix shipped to Meeticulous. Follow the latest updates to Meeticulous."
        image={ogCard('changelog')}
        canonical={`${SITE_URL}/changelog`}
        jsonLd={[
          collectionPageJsonLd({
            name: "What's New — Meeticulous Changelog",
            description: 'Every feature, improvement, and fix shipped to Meeticulous. Follow the latest updates to Meeticulous.',
            url: '/changelog',
          }),
          breadcrumbJsonLd({ items: [{ name: 'Home', path: '/' }, { name: 'Changelog', path: '/changelog' }] }),
        ]}
      />
      <div className="app-container py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <header className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-cta">
            Product updates
          </p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
            What’s New
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-gray-500 sm:text-base">
            Every improvement we’ve shipped to help you get booked and get paid —
            newest first. We’re just getting started.
          </p>
        </header>

        {/* Timeline */}
        <ol className="relative mt-12 border-l border-gray-200 sm:mt-16">
          {SORTED_RELEASES.map((r, i) => {
            // Accent = colour of the release's primary (first) tag. Drives both
            // the timeline node and the card's left border, replacing the old
            // animated background with a quieter, per-card cue.
            const accent = (TAG_STYLES[r.tags[0]] || TAG_STYLES.New).fg;
            return (
            <li key={i} className="relative ml-5 pb-10 last:pb-0 sm:ml-7">
              {/* node */}
              <span
                aria-hidden="true"
                className="absolute -left-[26px] top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-white sm:-left-[34px]"
                style={{ backgroundColor: accent, boxShadow: `0 0 0 3px ${accent}1f` }}
              />
              <div className="page-card p-5 sm:p-6" style={{ borderLeft: `4px solid ${accent}` }}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <time className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {r.date}
                  </time>
                  {r.version && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                      {r.version}
                    </span>
                  )}
                  <span className="flex flex-wrap gap-1.5">
                    {r.tags.map((t) => <Tag key={t} label={t} />)}
                  </span>
                </div>

                <h2 className="mt-2.5 font-heading text-lg font-bold tracking-tight text-ink sm:text-xl">
                  {r.title}
                </h2>

                <ul className="mt-3 space-y-2">
                  {r.points.map((p, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-600">
                      <svg viewBox="0 0 24 24" className="mt-1 h-3.5 w-3.5 shrink-0 text-c-emerald" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
            );
          })}
        </ol>

        {/* Footer CTA */}
        <div className="mt-12 rounded-2xl border border-black/5 bg-[#F8FAFC] px-6 py-10 text-center">
          <h3 className="font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Want all of this for your bookings?
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Set up your page, sync your calendar and start getting paid — at 0% commission.
          </p>
          <Link
            to="/become-a-host"
            className="btn mt-5 inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-[#005E99] transition-colors duration-150 shadow-sm hover:no-underline"
          >
            Become a host
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Changelog;
