# Meeticulous — Admin Console Guide

A practical guide for anyone operating the admin console. Read the first three
sections before your first shift; use the rest as a reference.

> **What this console is:** the internal operator panel for Meeticulous — where
> staff verify hosts, work bookings and disputes, run payouts, moderate content,
> and configure the platform. It is separate from the host dashboard
> (`/dashboard`) and the guest area (`/user`).

---

## 1. Signing in

- Admin sign-in is at **`/hello-sloth`** (not the normal login page).
- Your admin session is completely separate from any host/guest login — it lives
  under its own key and cannot be reached from a host account.
- **2FA (authenticator code) is mandatory** for admins. Keep your recovery codes
  somewhere safe.
- **Your permissions are baked in at sign-in.** If your role changes (or a
  permission is added), you must **sign out and back in** for it to take effect —
  the console will keep hiding/403-ing the new area until you re-login.

To sign out: profile menu (top-right) → **Sign out**, or the **Sign out** button
at the bottom of the mobile menu.

---

## 2. Roles & permissions

What you can see and do is decided by your **role**. Each role is a fixed bundle
of permissions. The console hides anything you can't use — if a whole section is
missing from your rail, your role doesn't grant any page in it.

| Role | Who it's for | Roughly can… |
|------|--------------|--------------|
| **Super Admin** | Founders / platform owners | Everything (wildcard). |
| **Operations** | Day-to-day ops team | Hosts, KYC, bookings, services, reviews, disputes, feedback, leads, badges, announcements; read-only finance. |
| **Support** | Customer support | Bookings (view + cancel), disputes, reviews, feedback, support inbox; read-only users/hosts/KYC/finance. |
| **Finance** | Money team | Full finance: payouts, refunds, transactions, ledger, commission, plans, coupons, referrals. |
| **Marketing** | Growth team | Campaigns, content (pages/blogs/newsletter/FAQ), email/WhatsApp, plans, coupons, referrals, badges, branding, SEO. |
| **Developer** | Engineering | Integrations, feature flags, health, audit logs. |

> **Rule of thumb:** if you think you should be able to do something but the
> button/page isn't there, it's a permission — ask a Super Admin to check your
> role, then **re-login**.

---

## 3. Getting around — the navigation

The console has a **two-level navigation**:

1. **Primary rail** (far left, thin icon strip) — one icon per **section**. Hover
   an icon to see its name. The active section shows a colored bar on its left
   edge. A small **red dot** on an icon means that section has work waiting.
2. **Secondary sidebar** (next to the rail) — the **pages inside the active
   section**. The current page is highlighted in the section's color. A **red
   number pill** next to a page is a live count of items needing attention.

Both are driven by one config, so the rail, the sidebar, breadcrumbs, and search
always agree.

**Also on the top bar:**
- **Breadcrumbs** (left) — where you are; click a crumb to go back up.
- **Search (⌘K / Ctrl-K)** — jump to any page by name. Fastest way to navigate.
- **Bell** — the "needs attention" summary (same counts that drive the rail dots).
- **Lightning (Quick Actions)** — shortcuts to the most common create actions.
- **Sun/Moon** — light/dark theme.
- **Profile menu** — settings + sign out.

**On mobile / narrow screens:** the rail and sidebar collapse into a single menu
behind the ☰ button (top-left).

### The attention badges (what the red counts mean)

The dots and pills are **real, live counts** pulled from the platform, refreshed
as you navigate. Today they cover:

| Badge | Section → Page | Means |
|-------|----------------|-------|
| Pending payouts | Revenue → Payouts | Host payout requests awaiting action. |
| Reviews to moderate | Support → Reviews | Reviews flagged for a decision. |
| Pending verifications | People → Hosts | Unverified hosts waiting for approval. |
| Abandoned bookings | Operations → Bookings | Started-but-unpaid bookings gone stale (>1h). |
| Failed emails | Growth → Communication | Emails that failed to send. |
| Failed WhatsApp/notifs | Growth → Notifications | Notifications that failed to deliver. |

A section's dot is the sum of its pages' counts. **Zero = no dot** (nothing to do).

---

## 4. The sections (what lives where)

Sections are ordered by how often and how urgently the work comes up — daily,
time-sensitive work sits at the top; configuration sinks to the bottom. Pages
marked **(coming soon)** are placeholders that are routed but not built yet.

### Overview — the daily starting point
- **Dashboard** — platform at a glance (revenue, bookings, hosts, users).
- **Revenue / Pending Actions / Marketing Insights** — dashboard views for
  money, the attention queue, and traffic/funnels.
- **Feature Status** — which feature flags / kill-switches are on.

### Operations — bookings & the catalog (highest daily volume)
- **Bookings** — every guest booking; open one to see details. *(Abandoned-booking badge lives here.)*
- **Services** — all host services/listings.
- **Service Categories** — the category taxonomy services choose from.
- **Professions** — the profession taxonomy above categories.
- **Explore Page** — curate what shows on the public explore page.
- **Addons** *(coming soon)* — paid add-ons/upsells.

### People — hosts, identity & staff (onboarding is time-sensitive)
- **Hosts** — manage hosts and their status; **approve pending hosts here.** *(Pending-verification badge lives here.)*
- **KYC** — review host identity documents (approve/reject).
- **Host 360°** — the full picture of a single host in one place.
- **Staff & Roles** — admin accounts and what each role can do (Super/CXO only).

### Support & Moderation — anything customer-facing or flagged
- **Support Inbox** — live chats + escalations, with priority/SLA.
- **Tickets** *(coming soon)* — the support ticket queue.
- **Disputes** — booking/payment disputes to resolve.
- **Reviews** — approve or reject flagged reviews. *(Reviews-to-moderate badge lives here.)*
- **Host Feedback** — feedback hosts have submitted.
- **Bolt Support** — the support-bot console, FAQs, and its escalations.
- **Support Insights** — why people contact us (product intelligence).

### Sales / CRM — the leads funnel (a distinct sales operator)
- **Leads** — the lead list.
- **Pipeline** — leads by stage on a board.
- **Follow-ups** — what's due to be chased.
- **Desk** — the sales desk summary (needs-attention buckets).
- **Sequences** — automated outbound sequences.
- **Templates** — reusable outbound message templates.
- **Reports** — sales performance.

### Revenue — money (money moves = double-check everything)
- **Payouts** — host earnings and payout runs. *(Pending-payout badge lives here.)*
- **Refunds** *(coming soon)* — process and track refunds.
- **Transactions** *(coming soon)* — browse all payment transactions.
- **Finance Dashboard** — financial overview and KPIs.
- **Ledger / Journal** — account balances and the double-entry accounting journal.
- **Subscription Plans** — plan tiers, pricing, and limits.
- **Refer & Earn** — referral rewards config and ledger.
- **Invite Links** — lead-source attribution links (no payouts attached).

### Growth — marketing & content
- **Campaigns** — marketing campaigns and blasts.
- **Communication** — email/message templates & logs. *(Failed-email badge lives here.)*
- **Notifications** — platform notification controls & logs. *(Failed-notification badge lives here.)*
- **Badges** — host trust/achievement badges.
- **Appearance** — branding, themes, visuals.
- **Pages / Blogs / Newsletter / FAQ / Testimonials** *(coming soon)* — the CMS.
- **Menu Builder / Footer Builder** *(coming soon)* — site nav & footer config.

### System — configuration (rarely touched, high blast radius)
- **General Settings** — global platform settings.
- **Payment Settings** — Razorpay / gateway configuration.
- **Audit Logs** — who did what, when — the action trail.
- **Blocked IPs** — the IP blocklist / abuse controls.
- **Reserved Slugs** — protected URL slugs and namespaces.

---

## 5. Common workflows

**Approve a new host**
1. Rail → **People** → **Hosts** (look for the red count).
2. Filter to *Pending*, open the host.
3. Check their **KYC** (People → KYC) — approve the documents first if needed.
4. Approve the host. The pending count drops.

**Clear the attention queue (start of shift)**
1. Check the **bell** or the rail **dots** for where work is waiting.
2. Work top-down: Operations → People → Support → Revenue.
3. Each badge links straight to the filtered list that needs action.

**Resolve a dispute**
1. Rail → **Support & Moderation** → **Disputes**.
2. Open the dispute, review the booking and payment context, decide.

**Run / check payouts** *(Finance)*
1. Rail → **Revenue** → **Payouts** (red count = pending requests).
2. Review each request; money actions are irreversible — confirm before releasing.

**Find a page fast**
- Press **⌘K / Ctrl-K**, type the page name, hit Enter. Works for everything you
  have permission to see.

---

## 6. FAQ / troubleshooting

**A whole section is missing from my rail.**
Your role doesn't grant any page in it. That's expected — ask a Super Admin if you
believe you need it, then **sign out and back in**.

**I was given a new permission but still can't see the page.**
Permissions load at sign-in. **Re-login.**

**A red dot won't go away.**
Open the section's badged page and clear the underlying items (e.g. approve the
pending hosts). The count refreshes as you navigate; if it's genuinely zero and
still showing, reload.

**A page says it's empty / "coming soon".**
Pages marked *(coming soon)* above are placeholders — the feature isn't built yet.
That's not a bug.

**I clicked an old `/admin/dept/...` bookmark and landed on the Dashboard.**
The old department hub pages were retired in favor of this two-level nav. Update
your bookmark to the section/page you actually want.

---

*Nav structure & rationale: see [admin-nav-plan.md](admin-nav-plan.md). The nav is
configured in one file (`client/src/components/admin/adminNav.js`) — sections,
pages, icons, colors, permissions, and badges all live there.*
