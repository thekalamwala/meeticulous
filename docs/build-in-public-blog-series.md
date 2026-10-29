# Book A Sloth — Build-in-Public Blog Series (30 Posts)

_Backdated public journal, May 22 → June 18. Founder voice, honest, dated._

POST 1 — May 22
Title: We already sold this thing. So why am I rebuilding it from zero?
What's inside:
- The PHP + SQL version is real, self-hosted, and already sold to a handful of paying customers who use it daily
- The uncomfortable truth: every new customer means an install, a server, and a support call — it doesn't scale
- The decision to build a hosted SaaS version so people can just sign up instead of install
- What Book A Sloth actually does, in one line: a payment-ready booking page for any creator in under 2 minutes
- Why I'm choosing to do this in public now, even though the code's been private for about a month
- The thing I'm most scared of: rebuilding something that already works
- The one rule for this series — honest, dated, no polishing the bad days
---
POST 2 — May 23
Title: Throwing away working PHP code (and why it still hurt)
What's inside:
- The sunk-cost knot: the PHP app works, customers like it, and I'm choosing not to just extend it
- Why a multi-tenant SaaS is a fundamentally different animal from a self-hosted install — auth, tenant isolation, billing, updates
- What I'm keeping: the domain logic, the money model, the hard-won lessons from real users
- What I'm dropping: the entire stack, the single-tenant database, the admin assumptions baked into it
- The genuinely emotional part — deleting code you were proud of
- First decision logged for the record: this is a rewrite, not a port
---
POST 3 — May 25
Title: Why Next.js + Supabase instead of just more PHP
What's inside:
- The honest evaluation: stay in PHP/MySQL where I'm fast, or jump stacks where I'm slow
- Why Supabase won: Postgres + Auth + Storage + Row Level Security out of the box, generous free tier, far less DevOps for a solo builder
- Why Next.js: one codebase for the marketing site and the app, server components, painless deploys
- The risk I'm taking on purpose — being slower for a few weeks to be faster for years
- The OTP-first booking idea needs a real auth layer, and Supabase hands me that instead of me building it
- What I explicitly did NOT pick and why: custom Postgres + an ORM, or a separate SPA + REST API
- A note to other devs: choose the stack that deletes the most boring work, not the trendiest one
---
POST 4 — May 26
Title: Day one of an empty repo (the good kind of scary)
What's inside:
- `create-next-app`, the first commit, the blank-canvas feeling
- Folder structure decisions up front: marketing routes vs app routes vs admin
- Setting up the Supabase project and getting my head around the anon-key vs service-role split
- First Postgres tables sketched on paper: profiles, services, bookings
- Locking in the public URL shape early — bookasloth.com/:username
- Small win: the dev server runs and a hello page renders
- What I'm deliberately NOT building yet (payments, email, literally everything)
---
POST 5 — May 27
Title: The first page that actually looked like something
What's inside:
- Building the public profile page at /:username — host bio, avatar, theme color, service cards
- Pulling real Supabase data into a server component for the first time
- Picking Tailwind and a tiny set of design tokens so I stop bikeshedding colors
- The first "oh, this could actually be nice" moment seeing a profile render
- Hardcoding a fake host to design against before auth even exists
- Why I built the guest-facing page before the dashboard — a motivation hack: build the part users see first
---
POST 6 — May 29
Title: Auth was supposed to be the easy part
What's inside:
- The plan: Supabase Auth for hosts and guests, email/password plus OAuth
- The first wall: the guest booking flow can't require an account — that would kill conversions
- The realization that I need OTP verification for guests who will never sign up
- Sketching a dedicated otp_codes table instead of leaning only on Supabase Auth
- Late night #1: chasing a redirect loop between server-side and client-side auth state
- A small win before bed — host login finally works
---
POST 7 — May 30
Title: OTP without accounts: the booking flow nobody talks about
What's inside:
- Why most booking tools force a signup, and why I refuse to
- Designing OTP properly: generate, email it, verify, expire — all server-side
- The first version stored codes in an in-memory Map because it was fast to write (foreshadowing)
- bcrypt-hashing the codes so a database leak never hands out valid OTPs
- Rate-limit thinking from the start: attempts, resend count, lockout window
- The flow on paper: pick a slot → enter details → verify OTP → booking created
- Laying down the bones of the bookings table
---
POST 8 — June 1
Title: The bug that only happens in production: vanishing OTPs
What's inside:
- Deployed, tested live, and got "No OTP found" on a code I had literally just received
- The cause: the in-memory OTP store gets wiped on every server restart and redeploy
- Why this is blindingly obvious in hindsight and completely invisible on localhost
- Decision reversed: move OTP storage out of memory and into a Supabase table with upsert
- Using the email as the primary key for atomic replace semantics on resends
- One of those fixes that feels like losing a whole day to learn a single sentence
---
POST 9 — June 2
Title: Row Level Security broke my brain (then saved it)
What's inside:
- Trying to do everything client-side with Supabase RLS policies
- The mess: policies fighting the server, half-loaded data, debugging invisible permission denials
- The decision: the server uses the service-role key and owns every write; the client only listens to auth state
- Why bypassing RLS on the server is a feature, not a hack, when the server is the gatekeeper
- Rewriting data access to go through API routes instead of the browser
- What I wish past-me had known about Supabase access patterns before I started
---
POST 10 — June 2
Title: An 11pm rabbit hole: timezones in availability
What's inside:
- Designing the availability model: a weekly schedule stored as JSON, blocked dates, buffer minutes
- The trap: storing slots without a timezone, so guests in other zones see the wrong times
- Deciding on IST as the default while still storing enough to stay correct
- The slot-generation logic: turning a weekly schedule plus existing bookings into bookable times
- Buffer minutes between bookings so hosts aren't slammed back-to-back
- Two posts in one day because I couldn't stop — flagging the burst honestly
---
POST 11 — June 3
Title: The day the whole booking flow silently created garbage
What's inside:
- Something breaks badly: bookings were being created even when the payment failed
- Root cause: I created the booking before confirming the Razorpay payment, optimistically
- Orphaned, unpaid bookings cluttering the table and — worse — blocking real time slots
- The fix: only finalize a booking after payment capture is actually confirmed
- Introducing a clear pending state versus a confirmed state
- The gut-punch of realizing this would have burned real hosts
- Why I'm grateful this surfaced at 14 bookings and not 1,400
---
POST 12 — June 4
Title: Razorpay, GST, and the math that has to be exactly right
What's inside:
- Wiring Razorpay orders for paid bookings end to end
- The money model carried over from the PHP version: service price + ₹10 platform fee + 18% GST on the fee
- Commission: 5% on the free tier, 0% on paid plans, calculated on the service price
- Deciding to snapshot every number onto the booking row, immutably, at the moment of creation
- Why recalculating later is an accounting trap — admins can change the fee at any time
- Recording the actual Razorpay fee from the API response instead of estimating it
- A worked example showing exactly where every rupee ends up
---
POST 13 — June 5
Title: I spent two days on a calendar nobody will thank me for
What's inside:
- The UI/UX decision that took way too long: the host availability editor
- Versions I tried and threw away — a big grid, then toggles, then a per-day time-range list
- The tension between powerful (handle every edge case) and simple (most hosts just want Mon–Fri, 10–6)
- The blocked-dates problem: how do you let someone say "I'm off June 20" without a clunky modal
- Why I kept rebuilding it, and how I finally forced myself to ship "good enough"
- The lesson: the boring screens are where the real product actually lives
---
POST 14 — June 6
Title: Pricing a product when you already know the unit economics
What's inside:
- Thinking through SaaS tiers versus the old self-hosted license model
- The three tiers taking shape: free Starter, Creator, Professional
- The free-tier dilemma: real limits (3 services, 20 bookings/month) without it becoming crippleware
- Why the free tier carries 5% commission and paid tiers drop to 0% — aligning incentives with the creator's success
- Monthly vs annual, and making annual the obvious better deal
- Designing it so admins can edit prices and limits from the database without a redeploy
- The scary open question: will free-tier creators ever actually upgrade?
---
POST 15 — June 7
Title: First end-to-end booking on the new stack
What's inside:
- The moment: picked a slot, received the OTP, paid in Razorpay test mode, booking confirmed
- Confirmation emails firing to both the host and the guest
- Watching the pricing snapshot land correctly on the booking row
- How long this took versus how small it looks in a single screenshot
- The quiet satisfaction of a flow that finally holds together instead of falling apart
- What's still faked behind the curtain — reminders, calendar, WhatsApp
---
POST 16 — June 7
Title: Killing my Twilio integration after it already worked
What's inside:
- The plan was Twilio for WhatsApp notifications, and I built it — it actually sent messages
- The reversal: for the Indian market, AiSensy fits the WhatsApp Business reality far better
- The pain of deleting working code for the second time this month
- Designing notifications to be provider-agnostic so this swap never hurts again
- DB-configured keys and per-event channel toggles, with no hardcoded provider anywhere
- Another burst day — shipping the swap while the reasoning was still fresh
---
POST 17 — June 9
Title: A paying PHP customer told me I built the wrong reschedule
What's inside:
- Real feedback from an existing self-hosted user: my reschedule flow assumed the host decides everything
- Their reality: guests ask to move a session, and the host shouldn't silently override the guest's calendar
- The feature change: reschedules now require the guest's acknowledgement before they're final
- How one sentence from a real user beat a week of my own assumptions
- Reworking the booking state to carry a pending-reschedule status
- Why early customers are worth more than any analytics dashboard I could build
---
POST 18 — June 9
Title: Google Calendar and the Meet link that wouldn't generate
What's inside:
- Adding Google Calendar so online bookings auto-create a Meet event
- The OAuth dance: scopes, refresh tokens, the consent screen
- The bug: events were created but no Meet link was attached
- The fix — the specific conferenceData request flag I'd been missing
- Deciding calendar sync should be host-optional, not required, to cut onboarding friction
- A small but genuine win after a fiddly integration
---
POST 19 — June 10
Title: Honestly? I'm tired.
What's inside:
- The honest, tired, real post — no big lesson, just where my head actually is
- A month of rebuilding something that already exists and already works
- The doubt creeping in: am I rebuilding out of vision, or out of ego
- The unglamorous middle of a project, where nothing is new and nothing is done
- What's keeping me going: the few real users, the cleaner architecture, the public promise I made
- Deliberately not wrapping this one in a bow
---
POST 20 — June 11
Title: The migration that nearly nuked my bookings table
What's inside:
- Breaks badly #2: a schema change to add a column went sideways
- A new not-null column without a default rejected existing rows and blocked new writes
- The cold-sweat moment of watching booking inserts fail in the logs
- Why I now treat every migration as additive, then backfill, then add a fallback in code
- The Supabase schema-cache lag I hit, and the defensive fallback pattern I adopted because of it
- Recovering, and writing the migration discipline down so I never repeat this
---
POST 21 — June 11
Title: Climbing out — the user who asked "when can I move my page over?"
What's inside:
- The refuel moment, landing right after the rough patch
- A PHP customer asking to migrate to the hosted version the day it's ready
- What that one message did for my motivation after the migration scare
- Re-scoping on the spot: what's truly required for them to switch versus what can wait
- Turning vague dread back into a concrete, finite punch list
- A burst of work powered entirely by one sentence from one person
---
POST 22 — June 12
Title: Cutting features so I can actually ship one
What's inside:
- Feature-freeze thinking begins: drawing the line between v1 and "later"
- What's in: booking, payments, availability, notifications, the host dashboard, onboarding
- What's explicitly out for launch: the full guest booking-history page, review UI, in-app refunds, the CMS
- The discipline of writing "not now" next to genuinely good ideas
- Designing the 10-step vendor onboarding as the real front door to the product
- Why a smaller, finished product beats a bigger, leaking one
---
POST 23 — June 13
Title: The onboarding flow that decides everything
What's inside:
- Building the 10-step host onboarding: slug → OTP → password → profile → first service → plan
- Why claiming the username/slug first creates an instant sense of ownership
- Forcing a first service during onboarding so nobody ever lands on an empty page
- The drop-off fear: every extra step loses people, but skipping setup loses them later
- Plan selection at the end versus the start — and why I moved it
- Watching a fake new host go from cold-start to a live page
---
POST 24 — June 13
Title: Small win — a stranger booked my test page and it just worked
What's inside:
- The celebration post — a small milestone, not a launch
- Shared a test profile link, and someone outside the project actually booked a slot
- OTP, test payment, confirmation email, calendar event — the whole chain held
- No code change needed, no panic in the logs — the boring miracle of it just working
- Letting myself enjoy it for exactly one evening
- Why this lands harder than any feature checkbox ever has
---
POST 25 — June 14
Title: Cleanup week — deleting my own scaffolding
What's inside:
- The final-sprint shift from building to hardening
- Ripping out the hardcoded fake hosts, the test flags, the console noise
- Tightening rate limits, OTP lockouts, and the separation between admin and user auth
- Writing tests around the money math specifically, because that's where mistakes cost real rupees
- The unglamorous satisfaction of a TODO list that's finally shrinking
- Resisting, hourly, the urge to add "just one more thing"
---
POST 26 — June 15
Title: Edge cases are where bookings go to die
What's inside:
- The pile of small UX gaps all surfacing at once before launch
- The double-booking race: two guests, same slot, same second — and the grace-period guard that stops it
- What happens when a guest fat-fingers their email at the OTP step
- Past-time slots, fully-booked days, services toggled inactive mid-checkout
- Each fix is tiny, but together they're the line between trust and a refund request
- Why I'd much rather find these than have my first real host find them
---
POST 27 — June 15
Title: The pricing page I rewrote five times
What's inside:
- Translating the business model into a page people will actually read
- How to show the platform fee and GST without spooking guests at checkout
- Making the free tier honest about its limits without it feeling stingy
- The monthly/annual toggle and the proration message that goes with it
- The copy struggle: explaining commission to creators in a single clear sentence
- A burst day spent closing the loop on something I'd been dreading for weeks
---
POST 28 — June 16
Title: Reminders, badges, and the polish that makes it feel real
What's inside:
- Wiring the 24-hour and 1-hour reminder emails onto a cron
- The badge system: a small dopamine layer for hosts, rule-driven instead of hardcoded
- Digital products as a quiet second revenue line for creators
- Unifying email templates under one shared layout so I stop hand-editing HTML shells
- The line between polish that matters and polish that's just procrastination
- Starting to feel less like a project and more like an actual product
---
POST 29 — June 16
Title: Everything that's still duct tape (an honest list)
What's inside:
- The pre-launch confession of every known gap
- The guest booking-history page still redirects to the wrong place — it's on the list, not done
- Review submission has a working API but no form yet
- Admin refunds and payout approvals are only partly built
- A couple of badge metrics return zero because there's no data source behind them yet
- Why I'm choosing to ship anyway, and what "done enough" honestly means
- Picking transparency over a fake-perfect launch
---
POST 30 — June 18
Title: Standing at the door, hand on the handle
What's inside:
- The final post: everything works end to end, and I'm about to open it up
- A month from an empty repo to a real, payment-ready booking platform
- What the rebuild actually bought me — scale, a cleaner stack, and lessons paid for by real users
- The fear and the calm of being one click away from public
- A genuine thank-you to the early PHP customers who made this worth doing
- Not pressing the button in this post — just standing here, ready
- What comes next, and a promise to keep journaling after the doors open
