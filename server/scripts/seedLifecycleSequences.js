'use strict';
/**
 * seedLifecycleSequences.js — create the nurture sequences the CRM lifecycle
 * engine (services/crm/lifecycleEngine.js) enrols leads into, plus the churn
 * win-back sequence that markCancelled enrols cancelled hosts into.
 *
 * The engine enrols BY EXACT NAME, so names must match its SEQ constants exactly.
 * Run on BOTH DBs (staging Tokyo → prod Mumbai), per project convention:
 *
 *     node server/scripts/seedLifecycleSequences.js
 *
 * Idempotent: each sequence is matched by name; on re-run its steps are deleted
 * and reinserted so copy edits re-apply cleanly and no duplicates accumulate.
 *
 * SENDERS (v3.122): every email carries a sender_key → it sends FROM that persona.
 *  - tithi  = the automated lifecycle voice (onboarding, first-booking, nudges).
 *  - sujata = the offers/marketing voice (anything with a discount or deadline).
 *
 * EMAIL steps carry a `preview` (distinct inbox preheader) stored in variables.
 * {{username}} / {{account_name}} resolve from the linked profile at send time
 * (messageService). WHATSAPP steps reference an approved AiSensy Campaign Name in
 * template_key with ordered params in `variables`.
 *
 * Nothing here sends anything — sequences fire through messageService, gated by
 * the crm_admin_sends kill-switch (default OFF).
 */
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');

// {{first_name}} {{name}} {{profession}} {{city}} {{booking_link}} {{username}} {{account_name}}
const BL = '{{booking_link}}';
const p = (html) => `<p>${html}</p>`;
const SIGN_TITHI = p(`— Tithi`);
const SIGN_SUJATA = p(`— Sujata`);
const SIGN_DURGA = p(`— Durga`);
// Founder's own booking page — his signature name links here. class="sig" keeps it
// an inline text link (plainBody promotes bare links to buttons; sig links stay inline).
const FOUNDER_URL = 'https://meeticulous.com/sndatarkar';
const SIGN_SHUBHAM = p(`— <a href="${FOUNDER_URL}" class="sig">Shubham</a> | Founder @ Meeticulous`);

// Approved AiSensy Campaign Names (the human name sendCampaign uses).
const WA = { onboarding: 'Onboarding Nudge', firstBooking: 'Get First Booking', winback: 'Winback Offer - Additional Month' };

const SEQUENCES = [
  // ── Cold-pool engagement (B2) — enrolled by listEngagementService off the
  //    email opens/clicks counters. Openers/clickers run while status='list';
  //    'New marketing' takes over once a lead is promoted to 'new'. Sujata voice.
  {
    name: 'Openers nurture', sender_key: 'sujata',
    description: 'Cold lead opened but has not clicked — nudge them to look properly.',
    is_active: true, stop_on_reply: true, stop_on_convert: true,
    steps: [
      { step_no: 1, delay_hours: 24, channel: 'email',
        subject: 'Did that land, {{first_name}}?',
        preview: 'One tap to see how Meeticulous actually works.',
        body: p(`You opened my last note — thanks. In case it got buried: Meeticulous is one link your clients use to book <i>and</i> pay, so you stop chasing times and payments.`) + p(`<a href="${BL}">See how it works →</a>`) + SIGN_SUJATA },
      { step_no: 2, delay_hours: 72, channel: 'email',
        subject: 'The 2-minute version',
        preview: 'Services, calendar and payments in one place.',
        body: p(`Quick version: you list what you do, set your hours, share one link. Clients pick a slot and pay upfront. That's it.`) + p(`<a href="${BL}">Take a look →</a>`) + SIGN_SUJATA },
      { step_no: 3, delay_hours: 120, channel: 'email',
        subject: 'Last nudge from me, {{first_name}}',
        preview: `If it's not for you, no worries at all.`,
        body: p(`I won't keep emailing. If a cleaner way to take bookings sounds useful, the link's below — if not, all good.`) + p(`<a href="${BL}">Have a look →</a>`) + SIGN_SUJATA },
    ],
  },
  {
    name: 'Clickers nurture', sender_key: 'sujata',
    description: 'Cold lead clicked once — warm; move them toward creating a page.',
    is_active: true, stop_on_reply: true, stop_on_convert: true,
    steps: [
      { step_no: 1, delay_hours: 24, channel: 'email',
        subject: 'Glad that caught your eye, {{first_name}}',
        preview: 'Your page takes about two minutes to set up.',
        body: p(`You had a look — nice. Setting up your own page takes about two minutes: add a service, set a price, share the link.`) + p(`<a href="${BL}">Create your page →</a>`) + SIGN_SUJATA },
      { step_no: 2, delay_hours: 72, channel: 'email',
        subject: 'What happens after you set it up',
        preview: 'One link. Clients book and pay. You get on with the work.',
        body: p(`Once your page is live, a client picks a service, chooses a time and pays — you just show up. No back-and-forth, no payment chasing.`) + p(`<a href="${BL}">Get started →</a>`) + SIGN_SUJATA },
    ],
  },
  {
    name: 'New marketing', sender_key: 'sujata',
    description: 'Lead promoted to New (engaged past the threshold) — push to sign up.',
    is_active: true, stop_on_reply: true, stop_on_convert: true,
    steps: [
      { step_no: 1, delay_hours: 0,   channel: 'email',
        subject: 'Ready when you are, {{first_name}}',
        preview: 'Create your booking page — free to start.',
        body: p(`You clearly liked what you saw — so let's get you a page. It's free to start, and you can be taking bookings today.`) + p(`<a href="${BL}">Create your page →</a>`) + SIGN_SUJATA },
      { step_no: 2, delay_hours: 48,  channel: 'email',
        subject: 'How {{profession}}s use Meeticulous',
        preview: 'From enquiry to a paid booking, no chasing.',
        body: p(`Someone asks to book you. Instead of trading messages and sharing UPI details, you send one link — they choose, book and pay.`) + p(`<a href="${BL}">See it in action →</a>`) + SIGN_SUJATA },
      { step_no: 3, delay_hours: 96,  channel: 'email',
        subject: 'Want me to set it up with you?',
        preview: `Reply "HELP" and I'll get your page live with you.`,
        body: p(`If you'd rather not do it alone, reply <b>HELP</b> and I'll walk your page to live with you. Won't take long.`) + SIGN_SUJATA },
      { step_no: 4, delay_hours: 168, channel: 'email',
        subject: 'Closing the loop, {{first_name}}',
        preview: 'Your page is one step away whenever you want it.',
        body: p(`Last one from me on this. Your page is a couple of taps away whenever the time's right.`) + p(`<a href="${BL}">Create your page →</a>`) + SIGN_SUJATA },
    ],
  },
  {
    name: 'Signed-up-not-activated', sender_key: 'tithi',
    description: 'Host signed up but has not finished onboarding — nudge to live.',
    is_active: true, stop_on_reply: true, stop_on_convert: true,
    steps: [
      { step_no: 1, delay_hours: 0,  channel: 'email',
        subject: 'Welcome to Meeticulous, {{first_name}}',
        preview: `Your page is almost ready — let's get you live today.`,
        body: p(`You're in. Your page is almost ready — let's get you live today.`) + p(`<a href="${BL}/dashboard">Finish setup →</a>`) + SIGN_TITHI },
      { step_no: 2, delay_hours: 24, channel: 'email',
        subject: 'Make your page look ready to book',
        preview: `Add your photo and the details clients trust.`,
        body: p(`Add your photo and a line about what you do — it's what makes clients trust you enough to book.`) + p(`<a href="${BL}/dashboard">Complete profile →</a>`) + SIGN_TITHI },
      // WhatsApp nudge at ~48h quiet — Onboarding Nudge: {{1}} name, {{2}} account name, {{3}} link.
      { step_no: 3, delay_hours: 48, channel: 'whatsapp', template_key: WA.onboarding,
        variables: ['{{first_name}}', '{{account_name}}', '{{booking_link}}/dashboard/'],
        subject: null, body: `Hi {{first_name}} 👋 Your Meeticulous page is one service away from live. Want a hand finishing it?` },
      { step_no: 4, delay_hours: 24, channel: 'email',
        subject: 'Add your first service',
        preview: `Add one service, set the price, you're ready to share.`,
        body: p(`Give your clients something to book. Add one service, set the price, and your page can start taking bookings.`) + p(`<a href="${BL}/dashboard/services">Add a service →</a>`) + SIGN_TITHI },
      { step_no: 5, delay_hours: 72, channel: 'email',
        subject: 'Need a hand getting live?',
        preview: `Reply with a screenshot of where you're stuck.`,
        body: p(`Not sure what to fill in? Reply to this email with a screenshot of where you're stuck — I'll take a look.`) + SIGN_TITHI },
    ],
  },
  {
    name: 'Activated-no-booking', sender_key: 'tithi',
    description: 'Host is live but has zero paid bookings — help land the first.',
    is_active: true, stop_on_reply: true, stop_on_convert: true,
    steps: [
      { step_no: 1, delay_hours: 0,  channel: 'email',
        subject: "Your page is ready — now let's get the first booking",
        preview: `Get your link in front of someone who already knows you.`,
        body: p(`You're live. Now let's get your link in front of someone who already knows you.`) + p(`<a href="${BL}/dashboard">Share your page →</a>`) + SIGN_TITHI },
      { step_no: 2, delay_hours: 72, channel: 'email',
        subject: '3 ways hosts get their first booking',
        preview: `Copy-paste scripts for WhatsApp, bio and story.`,
        body: p(`Pick one — don't overthink it.`)
          + p(`<b>1. WhatsApp</b> — "I'm now taking bookings online. Pick a time here: ${BL}/{{username}}"`)
          + p(`<b>2. Instagram</b> — add your link to your bio.`)
          + p(`<b>3. Story</b> — "Bookings are now open 👇" + your link.`) + SIGN_TITHI },
      // WhatsApp nudge — Get First Booking: {{1}} name, {{2}} public profile URL.
      { step_no: 3, delay_hours: 48, channel: 'whatsapp', template_key: WA.firstBooking,
        variables: ['{{first_name}}', '{{booking_link}}/{{username}}'],
        subject: null, body: `{{first_name}}, share your booking link once today — most first bookings come from a single share 🚀` },
      { step_no: 4, delay_hours: 48, channel: 'email',
        subject: "Still quiet? Let's fix that together",
        preview: `Send me your link — I'll tell you what I'd change.`,
        body: p(`Reply with your link and I'll tell you what I'd change.`) + SIGN_TITHI },
    ],
  },
  {
    name: 'Win-back', sender_key: 'tithi',
    description: 'Inactive 30+ days, never converted — re-engage (nudge only; these leads never paid).',
    is_active: true, stop_on_reply: true, stop_on_convert: true,
    steps: [
      { step_no: 1, delay_hours: 0,   channel: 'email',
        subject: 'Your booking page is still waiting for you',
        preview: `Pick up where you left off whenever you're ready.`,
        body: p(`Your Meeticulous page is still here. Pick up where you left off — about two minutes.`) + p(`<a href="${BL}/dashboard">Pick up where you left off →</a>`) + SIGN_TITHI },
      { step_no: 2, delay_hours: 120, channel: 'email',
        subject: 'A few things got better',
        preview: `Faster payouts, WhatsApp reminders, a cleaner page.`,
        body: p(`A few things got better since you last looked: payouts are faster, your clients get WhatsApp booking reminders, and your booking page is cleaner and quicker to book on.`) + p(`<a href="${BL}/dashboard">See what's new →</a>`) + SIGN_TITHI },
    ],
  },
  {
    // NEW — enrolled by subscriptionService.markCancelled for hosts who CANCELLED a
    // paid plan. Carries the win-back OFFER (from Sujata). Redemption is manual:
    // the host renews and an admin adds the 2 bonus months via Host360.
    name: 'Churn-winback', sender_key: 'tithi',
    description: 'Host cancelled a paid subscription — win them back with an offer (Sujata).',
    is_active: true, stop_on_reply: true, stop_on_convert: true,
    steps: [
      { step_no: 1, delay_hours: 0, channel: 'email', sender_key: 'tithi',
        subject: 'Sorry to see you go, {{first_name}}',
        preview: `Tell me what got in the way — 30 seconds.`,
        body: p(`You cancelled your plan, and I'd genuinely like to know why.`)
          + p(`What was the biggest reason? — Too expensive · Didn't get enough bookings · Something was missing · Something wasn't working · Other.`)
          + p(`Just hit reply, or:`) + p(`<a href="${BL}/feedback">Share your feedback →</a>`) + SIGN_TITHI },
      // The OFFER — from Sujata. Conditional on renewal; admin adds the 2 bonus months.
      { step_no: 2, delay_hours: 48, channel: 'email', sender_key: 'sujata',
        subject: `Come back. We'll give you 2 months free.`,
        preview: `Pick monthly or yearly — we add 2 extra months.`,
        body: p(`We'd love to have you back, {{first_name}}. Come back and we'll give you <b>2 months free</b> — pick monthly or yearly, we add 2 months on top.`) + p(`<a href="${BL}/dashboard/upgrade">Renew now →</a>`) + p(`Reply <b>DONE</b> once you have and we'll add the 2 months.`) + SIGN_SUJATA },
      // WhatsApp offer — Winback Offer: {{1}} name, {{2}} product, {{3}} offer, {{4}} renewal link.
      { step_no: 3, delay_hours: 24, channel: 'whatsapp', sender_key: 'sujata', template_key: WA.winback,
        variables: ['{{first_name}}', 'Meeticulous', '2 Month Addition', '{{booking_link}}/dashboard/upgrade'],
        subject: null, body: `{{first_name}}, renew your Meeticulous plan and we'll add 2 months free on top. Reply RENEW 💛` },
      { step_no: 4, delay_hours: 96, channel: 'email', sender_key: 'tithi',
        subject: 'What stopped Meeticulous from working for you?',
        preview: `Tell me what got in the way — I'll look into it.`,
        body: p(`If it wasn't price, tell me what didn't work. Reply to this email — I'll look into it personally.`) + SIGN_TITHI },
    ],
  },
  // ── Behavioural onboarding (Phase 6) — the engine enrols the FIRST unfilled gap
  //    on the go-live path and stops the previous gap's sequence as each is filled.
  {
    name: 'Onboarding: add photo', sender_key: 'tithi',
    description: 'Signed up, no profile photo yet — the #1 trust signal.',
    is_active: true, stop_on_reply: true, stop_on_convert: true,
    steps: [
      { step_no: 1, delay_hours: 0,  channel: 'email',
        subject: 'One thing left, {{first_name}} — add your photo',
        preview: `Clients book faster when they can see who they're booking.`,
        body: p(`Your page is almost there. Add your photo so clients know who they're booking with — it's the first thing they look for.`) + p(`<a href="${BL}/dashboard">Add your photo →</a>`) + SIGN_TITHI },
      { step_no: 2, delay_hours: 48, channel: 'email',
        subject: 'A page with a face gets booked',
        preview: `30 seconds to add your photo.`,
        body: p(`People book people. Add a photo and your page instantly feels more trustworthy — takes about 30 seconds.`) + p(`<a href="${BL}/dashboard">Add your photo →</a>`) + SIGN_TITHI },
    ],
  },
  {
    name: 'Onboarding: add service', sender_key: 'tithi',
    description: 'Has photo but no service — nothing to book yet.',
    is_active: true, stop_on_reply: true, stop_on_convert: true,
    steps: [
      { step_no: 1, delay_hours: 0,  channel: 'email',
        subject: 'What should clients book, {{first_name}}?',
        preview: `Add one service and your page can take bookings.`,
        body: p(`Your page needs something to book. Add one service, set the price — and clients can start booking you.`) + p(`<a href="${BL}/dashboard/services">Add a service →</a>`) + SIGN_TITHI },
      { step_no: 2, delay_hours: 48, channel: 'email',
        subject: 'One service is all it takes',
        preview: `Add it, set a price, share your link.`,
        body: p(`You don't need to list everything — just one service to go live. You can always add more later.`) + p(`<a href="${BL}/dashboard/services">Add a service →</a>`) + SIGN_TITHI },
    ],
  },
  {
    name: 'Onboarding: set availability', sender_key: 'tithi',
    description: "Has a service but no availability — clients can't pick a time.",
    is_active: true, stop_on_reply: true, stop_on_convert: true,
    steps: [
      { step_no: 1, delay_hours: 0,  channel: 'email',
        subject: 'Your service is ready. Is your calendar?',
        preview: `Set your hours so clients can pick a time.`,
        body: p(`You've added a service — nice. Now set your availability so clients can pick a time that works for you both.`) + p(`<a href="${BL}/dashboard/availability">Set availability →</a>`) + SIGN_TITHI },
      { step_no: 2, delay_hours: 48, channel: 'email',
        subject: 'Almost live — just add your hours',
        preview: `Set availability and your page is ready to share.`,
        body: p(`One step from live: add the hours you're free to take bookings, and your page is ready to share.`) + p(`<a href="${BL}/dashboard/availability">Set availability →</a>`) + SIGN_TITHI },
    ],
  },
  {
    // Celebration — Durga. stop_on_convert=false so it isn't cut off the moment the
    // host counts as 'activated' (having a booking is exactly why they're here).
    name: 'First booking celebration', sender_key: 'durga',
    description: 'Host just landed their first paid booking — celebrate + teach booking #2.',
    is_active: true, stop_on_reply: false, stop_on_convert: false,
    steps: [
      { step_no: 1, delay_hours: 0,  channel: 'email', sender_key: 'durga',
        subject: '🎉 Your first booking, {{first_name}}!',
        preview: `The hard part's done — now let's get booking #2.`,
        body: p(`Your first booking is in — congratulations! 🎉 That's the hard part done.`) + p(`Now let's get booking #2: share your link with a few more people who'd book you.`) + p(`<a href="${BL}/dashboard">Share your page →</a>`) + SIGN_DURGA },
      { step_no: 2, delay_hours: 72, channel: 'email', sender_key: 'durga',
        subject: 'How to get booking #2',
        preview: `One WhatsApp, one story, one ask this week.`,
        body: p(`The hosts who grow keep doing one thing: they keep sharing. This week — one WhatsApp broadcast, one Instagram story, one direct ask.`) + SIGN_DURGA },
    ],
  },
  {
    // Cold acquisition (audience 'lead'). Founder voice (Shubham) — sent PLAIN, no
    // brand shell (messageService PLAIN_SENDERS → 'cold' layout), so it reads like a
    // 1:1 note from someone who lived the pain. SEEDED INACTIVE.
    name: 'New Lead nurture', sender_key: 'shubham', audience: 'lead',
    description: 'Cold lead (event/import/website). Founder voice, plain 1:1 style. SEEDED INACTIVE — switch on when ready.',
    is_active: false, stop_on_reply: true, stop_on_convert: true,
    steps: [
      { step_no: 1, delay_hours: 0,   channel: 'email',
        subject: '{{first_name}}, the WhatsApp booking dance is insane and you know it',
        preview: `I did it for two years. Never again.`,
        body: p(`{{first_name}} — can we talk about the madness for a sec?`)
          + p(`"Are you free Thursday?" "How much?" "Can you do 4 instead?" "Sent the UPI — did it come?" Fifteen messages, three days, and half of them ghost you anyway.`)
          + p(`I ran my own bookings like this for way too long. It's not a business — it's a part-time job as your own receptionist.`)
          + p(`Meeticulous ends it. One link. They pick, they book, they <b>pay</b> — before they can flake.`)
          + p(`<a href="${BL}">See the thing that saved my sanity →</a>`) + SIGN_SHUBHAM
          + p(`P.S. Reply <b>SHOW ME</b> and I'll send you a 30-second walkthrough. No signup. Just look.`) },
      { step_no: 2, delay_hours: 48,  channel: 'email',
        subject: 'three apps to get paid once. what are we doing.',
        preview: `WhatsApp, UPI, and your memory holding it together.`,
        body: p(`Be honest, {{first_name}} — your booking "system" right now is WhatsApp for times, UPI for money, and your brain praying you didn't double-book.`)
          + p(`I lived in that mess. One client paid twice, another never paid, and I found out at 11pm.`)
          + p(`One link fixes the whole circus. Services, calendar, payment — clients handle it themselves in two taps.`)
          + p(`<a href="${BL}">Grab your link →</a>`) + SIGN_SHUBHAM
          + p(`P.S. It'd be yours the second you sign up.`) },
      { step_no: 3, delay_hours: 72,  channel: 'email',
        subject: 'the enquiry-to-ghost pipeline (you know it)',
        preview: `Every step is a place they drop off.`,
        body: p(`The dance, one more time, because it still makes me twitch:`)
          + p(`"free Thursday?" → you check → you reply → silence → you follow up feeling needy → maybe they pay.`)
          + p(`Every step is a place they ghost. Every step is you doing unpaid admin.`)
          + p(`Your Meeticulous link deletes all of it. They choose, book, pay — one move, while they're still excited.`)
          + p(`<a href="${BL}">Try it →</a>`) + SIGN_SHUBHAM
          + p(`P.S. The people who blow up do ONE thing — link in bio, link in story, link in every WhatsApp status. That's the whole trick.`) },
      { step_no: 4, delay_hours: 120, channel: 'email',
        subject: '{{first_name}} I\'ll literally set it up for you',
        preview: `Reply and we do it together, right now.`,
        body: p(`Okay {{first_name}}, I'm done watching you suffer the WhatsApp gauntlet.`)
          + p(`Reply <b>HELP</b> and I'll set your page up with you. One quick back-and-forth, and you walk away with a booking link that gets you paid while you sleep.`)
          + p(`No pitch. I just remember how much time I wasted on this — and I don't want you wasting yours.`) + SIGN_SHUBHAM
          + p(`P.S. Want to nose around first? Reply and I'll send you a live example page.`) },
    ],
  },
];

// The offer, also stored in the crm_templates library for manual sends (Sujata).
const OFFER_TEMPLATES = [
  { channel: 'email', name: 'offer_two_months_on_renewal', label: 'Offer · 2 months free on renewal', category: 'offer',
    subject: `Come back — 2 months free, {{first_name}}`,
    body: p(`Come back to Meeticulous and we'll give you <b>2 months free</b>, {{first_name}} — pick monthly or yearly, we add 2 months on top.`) + p(`<a href="{{booking_link}}/dashboard/upgrade">Renew now →</a>`) + p(`Reply <b>DONE</b> once you have and we'll add them.`) + SIGN_SUJATA },
];

async function upsertSequence(seq) {
  const { data: existing } = await supabaseAdmin.from('crm_sequences')
    .select('id').eq('name', seq.name).maybeSingle();

  const row = {
    name: seq.name, description: seq.description, is_active: seq.is_active,
    stop_on_reply: seq.stop_on_reply, stop_on_convert: seq.stop_on_convert,
    sender_key: seq.sender_key || null,
    // v3.160 audience axis: only the cold lead nurture targets leads; every host
    // lifecycle sequence defaults to 'customer'. Keeps the Growth/Marketing split
    // correct across re-seeds. Stripped below if the column isn't present yet.
    audience: seq.audience || 'customer',
    created_by: 'seed', updated_at: new Date().toISOString(),
  };

  // Schema-fallback: a DB without the v3.160 `audience` column rejects the row —
  // retry once without it so the seed still runs pre-migration.
  const write = async (r) => existing
    ? supabaseAdmin.from('crm_sequences').update(r).eq('id', existing.id).select('id').single()
    : supabaseAdmin.from('crm_sequences').insert(r).select('id').single();

  let seqId;
  let { data, error } = await write(row);
  if (error && /audience/i.test(error.message || '')) {
    const { audience, ...noAud } = row;
    ({ data, error } = await write(noAud));
  }
  if (error) throw error;
  seqId = existing ? existing.id : data.id;
  if (existing) await supabaseAdmin.from('crm_sequence_steps').delete().eq('sequence_id', seqId);

  const steps = seq.steps.map((s) => ({
    sequence_id: seqId, step_no: s.step_no, delay_hours: s.delay_hours,
    channel: s.channel || 'email', template_key: s.template_key || null,
    sender_key: s.sender_key || null,          // step override; else sequence sender applies
    subject: s.subject || null, body: s.body || null,
    // WhatsApp: ordered param array. Email: { preview } for the inbox preheader.
    variables: s.channel === 'whatsapp' ? (s.variables || null) : (s.preview ? { preview: s.preview } : null),
  }));
  const { error: stepErr } = await supabaseAdmin.from('crm_sequence_steps').insert(steps);
  if (stepErr) throw stepErr;

  return { name: seq.name, seqId, steps: steps.length, active: seq.is_active, created: !existing };
}

async function upsertOfferTemplate(t) {
  const { data: existing } = await supabaseAdmin.from('crm_templates').select('id').eq('name', t.name).maybeSingle();
  const row = { ...t, is_active: true, created_by: 'seed', updated_at: new Date().toISOString() };
  if (existing) await supabaseAdmin.from('crm_templates').update(row).eq('id', existing.id);
  else { const { error } = await supabaseAdmin.from('crm_templates').insert(row); if (error) throw error; }
  return { name: t.name, created: !existing };
}

async function main() {
  for (const seq of SEQUENCES) {
    const r = await upsertSequence(seq);
    console.log(`${r.created ? 'created' : 'updated'}: "${r.name}" — ${r.steps} steps, active=${r.active}`);
  }
  for (const t of OFFER_TEMPLATES) {
    const r = await upsertOfferTemplate(t);
    console.log(`${r.created ? 'created' : 'updated'} offer template: "${r.name}"`);
  }
  console.log('Done. Sequences match lifecycleEngine SEQ names + Churn-winback (markCancelled). Run on BOTH DBs.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
