-- ============================================================================
-- Content rewrite: Shubham N Datarkar (host username=sndatarkar) — 4 active services
-- Date: 2026-09-11   Author: content fix for Soft-404 / low SEO+GEO audit score
-- Target DB: PROD (Mumbai, ayjhlwyzszykqtnaktpb).  DATA CHANGE ONLY — no schema.
-- ============================================================================
--
-- WHY:
--   The 4 active services scored low on the internal SEO/GEO audit and 2 of them
--   are flagged "Soft 404" by Google (the other 2 "unknown to Google"). Root cause
--   is thin content:
--     - services had 15–49 crawlable words (need >150 for full content credit;
--       <40 words trips the GEO hard-cap at 50 and the "thin content" 0.25 cap).
--     - seo_description was NULL → weak/short meta.
--
--   The audit's SERVICE word-count reads ONLY (short_description + description)
--   (server/services/seo/pageContentModel.js:123-126) — NOT long_description/faqs.
--   So the *overview lives in `description`* (plain text) to lift the audit score,
--   while `long_description` (HTML) drives the on-page Overview tab + Google render,
--   and `seo_description` (120–160 chars) controls the meta tag (client/src/utils/seo.js:51).
--
-- FIELD → UI SLOT (client/src/pages/ServiceDetail.jsx):
--   short_description → hero subtitle
--   long_description || description → Overview tab (HTML sanitized)
--   included_items / excluded_items → Deliverables tab ("What's Included" / "Not Included") — string[]
--   important_note → notes
--   faqs → FAQ accordion + FAQPage JSON-LD — [{ "question": ..., "answer": ... }]
--
-- SCOPE:
--   Talk / Video KYC   → full rewrite (were placeholders).
--   Demo / SEO Consultancy → expand thin/truncated `description` + set seo_*; their
--                            existing long_description/items/faqs were already good
--                            and are left untouched.
--
-- SAFETY: idempotent (re-running sets the same values). Keyed by service id.
--   Reversible — take a backup first (below). Run inside the transaction.
--
--   Backup before running:
--     \copy (select id, short_description, description, long_description, important_note,
--            included_items, excluded_items, faqs, seo_title, seo_description,
--            og_title, og_description
--            from services
--            where host_id='6dbf6aac-6580-41d9-a8dd-6ba3b9609f32' and is_active=true)
--       to 'sndatarkar_services_backup_2026-09-11.csv' csv header;
--
-- AFTER RUNNING:
--   1. Re-run the SEO crawl so the audit re-scores these pages.
--   2. In Google Search Console, "Request Indexing" for the 4 service URLs
--      (only after this content is live — a still-thin page just re-earns Soft 404).
-- ============================================================================

begin;

-- ── 1. Talk about Shubham Datarkar Dot Com  (₹0, 30 min) ────────────────────
update services set
  short_description = $b$A free, no-agenda 30-minute conversation with Shubham Datarkar — the person behind shubhamdatarkar.com and the founder of Meeticulous. Come with a question, an idea, a bit of feedback, or nothing in particular. This is simply time to talk.$b$,
  description = $b$Talk about Shubham Datarkar Dot Com is an open, one-on-one video call with Shubham Datarkar — founder of Meeticulous and the maker behind shubhamdatarkar.com. There is no fixed agenda and nothing to buy. It is a relaxed thirty minutes to connect directly with Shubham.

People usually book this call after finding Shubham through his website, his writing, or his work on Meeticulous. Some come to share feedback on the product, some to explore a collaboration or partnership, some to bounce around an idea for their own project, and some just to say hello and see how the platform works from the inside.

Bring whatever is on your mind. Shubham will listen, share honest thoughts, and point you toward something useful wherever he can. If it turns into something bigger, great — and if it is just a good conversation, that is fine too.$b$,
  long_description = $b$<p><strong>Talk about Shubham Datarkar Dot Com</strong> is an open, one-on-one video call with <strong>Shubham Datarkar</strong> — founder of Meeticulous and the maker behind shubhamdatarkar.com. No fixed agenda, nothing to buy. Just a relaxed thirty minutes to talk.</p>
<p>Most people book this after finding Shubham through his website, his writing, or his work on Meeticulous. Come to:</p>
<ul>
<li>Share feedback on Meeticulous, or an idea to make it better</li>
<li>Explore a collaboration, partnership, or piece of work together</li>
<li>Get an honest second opinion on something you are building</li>
<li>Simply connect and see how the platform works from the inside</li>
</ul>
<p>Bring whatever is on your mind. Shubham will listen, share honest thoughts, and point you toward something useful where he can. If it grows into something bigger, wonderful — and if it is just a good conversation, that is a win too.</p>$b$,
  important_note = $b$This is a free, informal conversation. Please join on time from a device with a stable connection and working video. If you have something specific to discuss, send a line or two beforehand so we can make the most of the thirty minutes.$b$,
  included_items = $j$["A free 30-minute one-on-one video call with Shubham","Honest feedback on your idea, product, or question","A relaxed, no-agenda conversation","Pointers to useful resources, people, or next steps","A first-hand look at how Meeticulous works"]$j$::jsonb,
  excluded_items = $j$["Not paid consulting or a formal advisory session","No written notes, report, or recording by default","Not technical support for Meeticulous accounts","No guarantee of partnership, investment, or hiring","Not a sales or pricing negotiation"]$j$::jsonb,
  faqs = $j$[
    {"question":"What is this call about?","answer":"It is an open, free 30-minute video conversation with Shubham Datarkar — founder of Meeticulous and the maker behind shubhamdatarkar.com. There is no fixed agenda; you can talk about whatever is on your mind."},
    {"question":"Who usually books this?","answer":"People who found Shubham through his website, his writing, or Meeticulous and want to share feedback, explore a collaboration, get a second opinion, or simply connect."},
    {"question":"Does it cost anything?","answer":"No. This session is completely free — it is just time to talk, with nothing to buy."},
    {"question":"Do I need to prepare anything?","answer":"Not at all. If you have a specific topic, sending a short note beforehand helps, but coming with an open mind is perfectly fine."},
    {"question":"Is this technical support for my Meeticulous account?","answer":"No. For account or booking help, please use Meeticulous support. This call is a general conversation, not a support session."}
  ]$j$::jsonb,
  seo_title = $b$Talk with Shubham Datarkar — Free 30-Min 1:1 Call$b$,
  seo_description = $b$Book a free 30-minute one-on-one call with Shubham Datarkar, founder of Meeticulous. No agenda — share feedback, explore ideas, or just connect.$b$,
  og_title = $b$Talk with Shubham Datarkar — Free 1:1 Call$b$,
  og_description = $b$A free, no-agenda 30-minute video call with the founder of Meeticulous. Share feedback, explore a collaboration, or simply connect.$b$,
  seo_updated_at = now(), seo_updated_by = 'sql:sndatarkar-content-2026-09-11', updated_at = now()
where id = 'aa65524b-9519-4fff-8f03-9a05a72d2f17';

-- ── 2. Video KYC for Meeticulous  (₹0, 15 min) ─────────────────────────────
update services set
  short_description = $b$A quick, guided 15-minute video call to complete identity verification (KYC) for your Meeticulous host account. Verifying your identity keeps the platform trusted and unlocks payouts, so you can start getting paid for your bookings.$b$,
  description = $b$Video KYC for Meeticulous is a short, guided identity-verification call for hosts on the platform. KYC (Know Your Customer) is a standard, one-time check that confirms you are who you say you are — it keeps Meeticulous safe for guests and is required before your earnings can be paid out.

In about fifteen minutes over video, a member of the Meeticulous team will verify your identity and confirm the details on your host account. You will be asked to show a valid government ID and to confirm a few basic details already on file. The process is straightforward, and the team will guide you through each step.

Once your KYC is approved, payouts are unlocked on your account and you can begin receiving settlements for your paid bookings without further verification delays.$b$,
  long_description = $b$<p><strong>Video KYC for Meeticulous</strong> is a short, guided identity-verification call for hosts. KYC (Know Your Customer) is a standard, one-time check that confirms your identity — it keeps the platform trusted for guests and is <strong>required before your earnings can be paid out</strong>.</p>
<p>In about fifteen minutes over video, a member of the Meeticulous team will:</p>
<ul>
<li>Verify your identity against a valid government-issued ID</li>
<li>Confirm the key details on your host account</li>
<li>Answer any questions you have about the payout process</li>
</ul>
<p>The process is simple and fully guided. Once your KYC is approved, <strong>payouts are unlocked</strong> on your account and you can start receiving settlements for your paid bookings without further delays.</p>$b$,
  important_note = $b$Please keep a valid government-issued photo ID ready and join from a well-lit space with a stable internet connection and a working camera. Make sure the name and details on your ID match your Meeticulous host account to avoid delays in approval.$b$,
  included_items = $j$["A guided 15-minute video verification call","Identity check against a valid government-issued ID","Confirmation of your host account details","Help with any payout or verification questions","KYC approval that unlocks payouts on your account"]$j$::jsonb,
  excluded_items = $j$["Not a product demo or training session","Does not include tax, GST, or accounting advice","No document editing or account changes on your behalf","Not technical support for bookings or the app","Approval is subject to valid, matching documents"]$j$::jsonb,
  faqs = $j$[
    {"question":"What is Video KYC and why is it needed?","answer":"KYC (Know Your Customer) is a one-time identity check required before payouts can be enabled on your host account. It keeps Meeticulous safe and trusted for everyone."},
    {"question":"What documents should I keep ready?","answer":"A valid government-issued photo ID such as Aadhaar, PAN, passport, or driving licence. Make sure the details match your host account."},
    {"question":"How long does the call take?","answer":"Around 15 minutes. The team guides you through each step, so there is nothing to prepare beyond having your ID ready."},
    {"question":"What happens after I am verified?","answer":"Once your KYC is approved, payouts are unlocked on your account and you can start receiving settlements for your paid bookings."},
    {"question":"Is my information safe?","answer":"Yes. Your details are used only for identity verification and handled securely as part of the platform's standard KYC process."}
  ]$j$::jsonb,
  seo_title = $b$Video KYC for Meeticulous Hosts — Verify & Get Paid$b$,
  seo_description = $b$Complete your Meeticulous host KYC in a quick 15-minute guided video call. Verify your identity to unlock payouts and start getting paid for bookings.$b$,
  og_title = $b$Video KYC for Meeticulous Hosts$b$,
  og_description = $b$A quick 15-minute guided video call to verify your identity and unlock payouts on your Meeticulous host account.$b$,
  seo_updated_at = now(), seo_updated_by = 'sql:sndatarkar-content-2026-09-11', updated_at = now()
where id = '6e0ddb63-e82a-457d-8c2b-14ea4f297fde';

-- ── 3. Meeticulous App Online Demo (30-Min)  (₹1, 30 min) ──────────────────
--    long_description / included / excluded / faqs / important_note already good
--    (left untouched). Only expand the thin `description` + set seo_*.
update services set
  description = $b$The Meeticulous App Online Demo is a live, one-on-one walkthrough of the platform, run over a thirty-minute video call. Instead of reading documentation, you see the app in action and ask questions as you go.

During the session, a host shares their screen and shows you how Meeticulous actually works: creating and setting up a profile, browsing and booking services, managing your listings and calendar, and using the scheduling and payment tools. It is built for anyone evaluating the platform — new users, creators and professionals thinking of offering their services, or businesses comparing options before they commit.

The demo is tailored to your use case. Come with questions about your own situation and you will leave with a clear picture of whether Meeticulous fits your needs and how to get started. You will also see how a real booking, payment, and confirmation flow works from end to end, so nothing about the platform stays a mystery.$b$,
  seo_title = $b$Meeticulous App Demo — Live 30-Min Walkthrough$b$,
  seo_description = $b$See Meeticulous in action in a live 30-minute demo. A host walks you through booking, scheduling, listings, and payments, with time for your questions.$b$,
  og_title = $b$Meeticulous App Online Demo$b$,
  og_description = $b$A live 30-minute walkthrough of Meeticulous — booking, scheduling, listings, and payments — with time for your questions.$b$,
  seo_updated_at = now(), seo_updated_by = 'sql:sndatarkar-content-2026-09-11', updated_at = now()
where id = 'd7b2768c-acd2-447e-9b8d-9cafb3fef151';

-- ── 4. SEO Consultancy by Shubham (30-Min)  (₹1000, 30 min) ─────────────────
--    long_description / included / excluded / faqs / important_note already good
--    (left untouched). Fix the truncated short_description + thin description + seo_*.
update services set
  short_description = $b$Get clear, actionable SEO advice in a focused 30-minute session with Shubham. Bring your website and your visibility challenges, and leave with a prioritized plan covering strategy, technical fixes, and on-page and content improvements you can act on right away.$b$,
  description = $b$SEO Consultancy by Shubham is a one-on-one advisory session that diagnoses why your website is not getting the search visibility it should — and gives you clear, prioritized steps to fix it. It is a practical thirty minutes, not a sales pitch.

Before the call, you share your website and your main concerns. During the session, Shubham reviews your site's current performance, identifies the biggest obstacles to organic traffic, and talks you through what to change first. You will cover the areas that matter most for your goals: technical SEO issues holding you back, keyword and content direction, and on-page improvements that move rankings.

You leave with a focused, prioritized action plan you can implement yourself or hand to your team — no ongoing agency retainer required. It is ideal for business owners, marketers, and content teams who want expert direction without committing to a long engagement.$b$,
  seo_title = $b$SEO Consultancy by Shubham — 30-Min Advisory Call$b$,
  seo_description = $b$Book a focused 30-minute SEO consultation with Shubham. Get a prioritized, actionable plan to fix the technical, on-page, and content issues holding your site back.$b$,
  og_title = $b$SEO Consultancy by Shubham — 30-Min Advisory Call$b$,
  og_description = $b$A focused 30-minute SEO consultation with Shubham — leave with a prioritized, actionable plan to grow your search visibility.$b$,
  seo_updated_at = now(), seo_updated_by = 'sql:sndatarkar-content-2026-09-11', updated_at = now()
where id = '42c0acca-63ab-4c24-8c16-dcdcd9b7bd17';

-- Sanity check (review before commit): word counts the audit will read.
--   select slug,
--     array_length(regexp_split_to_array(trim(coalesce(short_description,'')||' '||coalesce(description,'')), '\s+'),1) as audit_words,
--     length(seo_description) as meta_len
--   from services where host_id='6dbf6aac-6580-41d9-a8dd-6ba3b9609f32' and is_active=true order by price;

commit;
