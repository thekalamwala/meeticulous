# Daily Build-in-Public Blog — Claude Code Operating Brief

**Purpose:** This is the single instruction file for generating Book A Sloth's build-in-public blog.
Hand it to Claude Code and say: *"Follow docs/blog-daily-build-in-public.md and generate the post for <DATE>."*
Claude Code will read that day's real PRs + changelog, write one post in the house voice, and insert it into the blog.

---

## 0. TL;DR for Claude Code

For a given calendar day:
1. Gather that day's real work (merged PRs, commits, changelog entries) — Section 3.
2. Pick ONE story angle for the day — Section 4.
3. Write ONE ~500-word post in the house voice — Section 5.
4. Turn it into a valid post object — Section 6.
5. Insert it into the blog store, newest-first, unique slug — Section 6/7.
6. Build + test + open a PR — Section 8.

One post per day. Never invent facts, metrics, or features that aren't in the commits/changelog.

---

## 1. Where posts live (the store)

**Current state (static):** posts live in `client/src/data/blogPosts.js`, in the exported array `BLOG_POSTS`,
rendered by `client/src/pages/Blog.jsx` (index) and `client/src/pages/BlogPost.jsx` (detail).

> ⚠️ If/when the blog moves to a Supabase `blog_posts` table + admin CMS, THIS is the only section that
> changes: instead of editing `blogPosts.js`, insert a row via the blog API/migration. The voice, angle,
> and schema rules below stay identical. Check for a `blog_posts` table / `server/routes/blog*` before
> assuming static — if they exist, use the DB path.

### Post object schema (must match exactly)

```js
{
  slug: 'url-safe-unique-slug',   // /blog/:slug — unique, kebab-case, no collisions with reservedSegments
  title: 'The headline',
  date: 'Jul 6, 2026',            // display string; list is newest-first
  author: 'Bolt 958',            // keep unless told otherwise; byline links to AUTHOR_URL
  readMins: 4,                    // rough, honest read time
  category: 'Engineering',        // MUST be a key of CATEGORY_THEME (Section 6.1)
  image: null,                    // null → branded fallback panel (fine as default)
  excerpt: 'One or two line summary for the card + hero subtitle.',
  body: [ /* array of blocks, Section 6.2 */ ],
}
```

New posts go at the **TOP** of `BLOG_POSTS` (newest-first). `AUTHOR_URL` is already exported in the file.

---

## 2. Style reference (already-published anchors)

Read these existing posts in `blogPosts.js` before writing, and match their register:
`building-in-public-why-we-blog`, `zero-commission-bet`, `payments-and-calendars-on-autopilot`.
The founder journal in `docs/build-in-public-blog-series.md` is the long-form voice bible — match its tone.

---

## 3. Gather the day's real material

Run these for the target `<DATE>` (format `YYYY-MM-DD`) to get the source facts. Never write from memory.

```bash
# All commits merged that day, across branches (the raw material)
git log --all --since="<DATE> 00:00" --until="<DATE> 23:59" --date=short \
  --pretty="%ad | %s" | sort -u

# PRs merged that day (the shippable units)
git log --all --since="<DATE> 00:00" --until="<DATE> 23:59" \
  --grep="Merge pull request" --pretty="%s%n%b"

# Changelog entries authored around that day (customer-facing framing)
git log --all --since="<DATE> 00:00" --until="<DATE> 23:59" -- docs/CHANGELOG.md \
  || sed -n '1,80p' docs/CHANGELOG.md
# Also check the in-app changelog: client/src/pages/Changelog.jsx
```

From the output, extract: what shipped, what got fixed, what broke, what decision was made.
Prefer `feat(...)`, `fix(...)`, `docs(spec/plan...)`, security/perf work, and changelog lines.
Ignore pure noise: `chore(deps)` bumps, CI tweaks, revert-of-revert churn — unless that IS the story
(a dependency scare, a rough day) and it's genuinely interesting.

---

## 4. Pick ONE angle per day (this is the hard part)

A single day often has 15–50 commits. Do NOT list them. Choose the ONE thread with the most human or
product interest and build the whole post around it. Everything else is at most a sentence of context.

Selection priority when a day is busy:
1. Something **broke** or a scary near-miss (migration, security finding, payment edge) → best stories.
2. A **decision / reversal** (renamed Vendor→Host, swapped provider, changed pricing, cut a feature).
3. A **user-driven change** (feedback that reshaped a feature).
4. A **milestone** (went prod-live, shipped the blog, first real booking).
5. A meaty **feature** that a real host will feel (onboarding reshape, reviews, reminders).
6. Otherwise, an **engineering-craft** note (reliability, reconciler, caching) framed for humans.

If a day is genuinely thin (few, boring commits): either skip it, or fold it into the next day's post.
Realistic cadence beats forcing a weak post — some days quiet, some days two is fine.

---

## 5. House voice & rules

Write as the **founder, first person ("I")**. This is a journal, not a press release.

**Do:**
- ~500 words. Tight. If a word can be cut without losing meaning, cut it.
- One concrete idea, told as a story: the problem → what I tried → what broke → what I learned.
- Be **specific**. Name the actual thing (the real migration, the real security finding, the real rename).
  Translate the commit into plain human stakes — *why it matters to a host or a guest*, not the diff.
- Earn the win. A win only lands after something hard; don't hand out victories.
- Honest about rough edges, tired days, and things still held together with tape.
- Indian, practical context where natural (INR, WhatsApp, Razorpay, GST).
- Weave real people **only when the day's work genuinely involves them** — don't force it:
  - **Naman** — built the original PHP version; the old-world co-builder.
  - **Vishal** — backer/friend; funds small frictions (tools, a card when needed).
  - **Sujata** — partner; sells the *removal of pain*, not features; roasts the pricing page.
  - **Durga** — marketing; keeper of honesty + "you're allowed to be tired, not to disappear."
  - **Yukta** — physiotherapist customer; blunt feedback that makes the product honest.
  - **Himanshi** — entrepreneur customer; wants to move her page over; asks the hard trust questions.
  - **Mukesh** — coworking space owner; "software that makes money while I sleep."
  - **Mother** — the spine; counts trust, not users.

**Don't:**
- No marketing fluff, no hype adjectives, no "revolutionary/game-changing."
- No invented numbers, users, revenue, or benchmarks. If it's not in the commits/changelog/docs, don't claim it.
- No exposing secrets, internal hostnames, credentials, or unshipped security details that could be abused
  (write "we closed a set of security findings," not an exploit recipe).
- No em-dash-heavy AI cadence; vary sentence length; sound like a person.
- Don't dump a changelog. One angle, human story.

**Structure that works** (flex it, don't make every post identical):
opening hook (the tension) → what actually happened → the messy middle → what I learned / what it means for
hosts → a forward line to tomorrow.

---

## 6. Turn the post into a valid object

### 6.1 Category — map the day's dominant work to a `CATEGORY_THEME` key

Valid keys (must be exact): `News`, `Product`, `Feature Update`, `Guide`, `Growth`, `Engineering`, `Internal`.

- `feat(...)` user-facing → **Feature Update** or **Product**
- `fix(...)`, `perf(...)`, security, reliability, infra → **Engineering**
- pricing, plans, positioning, landing pages, competitor pages → **Growth**
- a how-to / explainer framing → **Guide**
- launches, milestones, announcements → **News**
- meta / building-in-public reflection / tired-day post → **Internal**

Only add a NEW category if truly needed, and then add a full theme entry (band/accent/light/chipBg/chipFg)
to `CATEGORY_THEME` — don't reference a key that doesn't exist or the hero color breaks.

### 6.2 Body blocks — use ONLY these (BlogPost.jsx supports no others)

```
{ p: 'paragraph' }
{ h2: 'section heading' }
{ ul: ['item', 'item'] }
{ ol: ['item', 'item'] }
{ steps: ['step one', 'step two'] }      // rendered as 01 / 02 …
{ quote: 'pull quote', cite: 'optional attribution' }
{ info: { title: 'Callout', text: '...' } }
{ table: { head: ['A','B'], rows: [['1','2']] } }
```

Most posts: mostly `{p}`, one or two `{h2}`, maybe one `{ul}`/`{info}`/`{quote}`. Keep it clean.

### 6.3 Other fields
- `date`: `'Mon D, YYYY'` (e.g. `'Jul 6, 2026'`) — must equal the day the work happened (backdate to `<DATE>`).
- `slug`: kebab-case from the title; **unique**; check it's not already in `BLOG_POSTS` and not a reserved
  segment (`client/src/config/reservedSegments.js`).
- `author`: `'Bolt 958'` unless told otherwise. `image`: `null` is an acceptable default.
- `readMins`: honest estimate (~200 words/min).

---

## 7. Insertion rules

- Insert the new object at the **top** of the `BLOG_POSTS` array (newest-first).
- Preserve existing formatting/quotes style in the file. Use the same fancy quotes the file already uses.
- Never edit or reorder existing posts unless explicitly told.
- One post per object; don't merge multiple days into one entry.

---

## 8. Workflow (per post)

```bash
git checkout -b blog/<DATE>-<short-slug>
# ...Claude Code edits client/src/data/blogPosts.js (add object at top)...
cd client && npm run build && npm test      # must pass
git add -A && git commit -m "content(blog): build-in-public post for <DATE>"
git push -u origin HEAD                       # open PR → merge to main → CI deploys to Vercel
```

Never commit straight to `main` (there's a branch-guard hook). Always PR.
If `npm run build` or tests fail because of the post (bad category key, malformed block), fix and re-run.

---

## 9. Worked example (imitate this quality)

**Target day:** 2026-06-19. Dominant work from `git log`: staging→prod release pipeline, daily encrypted
DB backups, Sentry error tracking, a **payments reconciler for bookings stuck unpaid on a missed webhook**,
founder-alert when a Razorpay webhook keeps failing, ops runbook. → Angle: *reliability after launch*.
Category: **Engineering**.

```js
{
  slug: 'the-day-after-launch-i-built-a-safety-net',
  title: 'The day after launch, I stopped building features and built a safety net',
  date: 'Jun 19, 2026',
  author: 'Bolt 958',
  readMins: 4,
  category: 'Engineering',
  image: null,
  excerpt: 'The scariest bug in a payments product is the one that happens while you sleep. So the day after going live, I built for the failures I can’t watch.',
  body: [
    { p: 'The day you launch, your instinct is to keep adding. The day after you launch, if you’re honest, you realise the job changed while you weren’t looking. It’s not “what can I build next” anymore. It’s “what happens when something breaks and I’m asleep.”' },
    { p: 'A booking platform moves real money. Razorpay tells us a payment succeeded by sending a webhook — a little message that says “this one’s paid.” Almost always it arrives in a second. But “almost always” is a terrifying phrase when it’s attached to money.' },
    { h2: 'The failure I can’t watch' },
    { p: 'What if the webhook never arrives? A guest pays, the confirmation is on its way, and the message that tells us so gets lost to a flaky network. Now there’s a booking stuck in limbo — paid by the guest, unconfirmed by us. Nobody’s at fault, and everyone’s unhappy.' },
    { p: 'So today I built a reconciler: a quiet background job that goes looking for bookings stuck unpaid on a missed webhook and settles them against what actually happened at Razorpay. And if a webhook keeps failing, it doesn’t fail silently — it messages me. I’d rather be woken up than find out from a customer.' },
    { h2: 'The unglamorous layer' },
    { p: 'Alongside it: a proper staging-to-production pipeline, daily encrypted database backups, error tracking so I see a crash the moment it happens, and a runbook for when things go wrong. None of this shows up on a screen a host will ever see.' },
    { quote: 'Reliability isn’t a feature you add later. It’s the floor you build on.', cite: 'Note to self, day two' },
    { p: 'A stranger trusted us with their money yesterday. Today’s work was making sure that trust survives the things I can’t stay awake to watch.' },
  ],
}
```

Match that: one clear angle, real facts from the commits, human stakes, ~500 words, honest.

---

## 10. Reusable prompts for Claude Code

- Single day: *"Follow docs/blog-daily-build-in-public.md. Generate and insert the post for 2026-06-20."*
- Backfill a range: *"Follow docs/blog-daily-build-in-public.md. For each day from 2026-06-18 to 2026-07-06,
  gather that day's PRs/commits/changelog, pick one angle, and add one post (skip genuinely thin days).
  Newest-first. Open one PR for the batch."*
- Ongoing: schedule a weekly run — *"For each day of last week, generate the daily post per the brief."*

**Guardrails, always:** one angle per day · only supported blocks · valid category key · unique slug ·
no invented facts/metrics · real people only when the work involves them · PR, never direct to main.
