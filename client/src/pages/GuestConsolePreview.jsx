import { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import {
  LogOut, LifeBuoy, ChevronDown, User, CalendarDays, Gift, HelpCircle, ExternalLink,
  Star, MessageCircle, ArrowRight, CalendarClock, Hash, Download, Video, Lock,
  Ticket, Percent, Trophy, Sparkles, FileText, Mail, Phone, Cake, Menu,
} from "lucide-react";
import GuestSidebar from "../components/common/GuestSidebar";
import MeetDropdown from "../components/ui/MeetDropdown";

// explore/console-restyle — a WORKING, no-login prototype of the FULL restyled
// guest console at /preview/guest/*. It reuses the real restyled GuestSidebar
// (passed base="/preview/guest" so the rail navigates within the prototype) and
// mirrors every guest page in the Loop & Slot look with sample data. Public +
// noindex; renders nothing a real account owns. Not a production surface.
//
// Field names and page skeletons mirror the real pages (CustomerBookings,
// GuestInvoices, Loyalty, CustomerReviews, MyCourses, CustomerProfile) so the
// design is judged against the real content, not invented content.

const ring = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose";
const BASE = "/preview/guest";

const ME = { name: "Meera Shah", email: "meera.shah@gmail.com", phone: "+91 98••• ••210" };

const BOOKINGS = [
  { id: "bk_9f2a71", title: "Nutrition deep-dive", host: "Ananya Rao", when: "Tue 18 Nov, 6:00 pm", rel: "in 2 days", amount: "₹2,400", status: "confirmed" },
  { id: "bk_7c1d40", title: "Follow-up consult", host: "Ananya Rao", when: "Mon 24 Nov, 5:30 pm", rel: "in 8 days", amount: "₹1,200", status: "confirmed" },
  { id: "bk_5b8e22", title: "Sports nutrition audit", host: "Vikram Shetty", when: "Thu 6 Nov, 7:00 pm", rel: "", amount: "₹4,500", status: "completed" },
  { id: "bk_3a0c19", title: "Discovery call", host: "Ananya Rao", when: "Fri 31 Oct, 1:00 pm", rel: "", amount: "Free", status: "completed" },
  { id: "bk_1e7f05", title: "Diet review", host: "Sana Kapoor", when: "Wed 22 Oct, 4:00 pm", rel: "", amount: "₹1,800 · refunded", status: "cancelled" },
];

const INVOICES = [
  { id: "inv_2291", number: "MT-2026-0291", type: "Booking", date: "14 Nov 2026", total: "₹2,832" },
  { id: "inv_2187", number: "MT-2026-0187", type: "Booking", date: "06 Nov 2026", total: "₹5,310" },
  { id: "inv_2044", number: "MT-2026-0044", type: "Subscription", date: "01 Nov 2026", total: "₹1,392" },
];

const TIERS = [
  { name: "Bronze", spend: "₹0+", perks: "2% back as credits", unlocked: true },
  { name: "Silver", spend: "₹5,000+", perks: "5% back as credits", unlocked: true },
  { name: "Gold", spend: "₹15,000+", perks: "8% back + early slots", unlocked: false },
  { name: "Platinum", spend: "₹40,000+", perks: "12% back + priority support", unlocked: false },
];

const REVIEWS = [
  { author: "Ananya Rao", when: "15 Nov 2026", rating: 5, service: "Nutrition deep-dive", comment: "Meera came prepared and followed through on the plan. A pleasure to work with." },
  { author: "Vikram Shetty", when: "07 Nov 2026", rating: 5, service: "Sports nutrition audit", comment: "Clear goals, on time, asked great questions." },
  { author: "Sana Kapoor", when: "22 Oct 2026", rating: 4, service: "Diet review", comment: "Engaged and punctual." },
];

const COURSES = [
  { title: "Everyday nutrition, simplified", by: "Ananya Rao" },
  { title: "Fuel for runners", by: "Vikram Shetty" },
];

/* ── Shared bits ────────────────────────────────────────────────────────── */

const PageHead = ({ title, sub, right }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
    <div>
      <h1 className="font-display text-[24px] font-extrabold leading-none tracking-[-0.04em] text-maroon">{title}</h1>
      {sub && <p className="mt-1.5 text-[13px] font-medium text-ink/55">{sub}</p>}
    </div>
    {right}
  </div>
);

const Card = ({ className = "", children }) => (
  <div className={`rounded-[8px] border-2 border-neutral-200 bg-white p-4 ${className}`}>{children}</div>
);

const STATUS = {
  confirmed: "bg-success-bg text-success-fg",
  completed: "bg-blush text-maroon",
  cancelled: "bg-error-bg text-error-fg",
};
const StatusChip = ({ status }) => (
  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold capitalize ${STATUS[status] || "bg-neutral-100 text-ink/55"}`}>{status}</span>
);

const Stars = ({ n }) => (
  <span className="inline-flex" aria-label={`${n} of 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? "fill-marigold text-marigold" : "text-neutral-200"}`} strokeWidth={1.5} />
    ))}
  </span>
);

const Empty = ({ icon: Icon, title, body }) => (
  <div className="grid place-items-center rounded-2xl border-2 border-dashed border-neutral-200 bg-white px-4 py-10 text-center">
    <Icon className="mb-2 h-7 w-7 text-ink/25" strokeWidth={1.8} />
    <p className="font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink">{title}</p>
    <p className="mt-1 max-w-xs text-[12px] font-medium leading-snug text-ink/50">{body}</p>
  </div>
);

/* ── Pages ──────────────────────────────────────────────────────────────── */

const Overview = () => (
  <div className="flex flex-col gap-5">
    <div>
      <h1 className="font-display text-[26px] font-extrabold leading-none tracking-[-0.04em] text-maroon">Hi Meera</h1>
      <p className="mt-1.5 text-[13px] font-medium text-ink/55">
        Here&apos;s <span className="font-serif text-[1.08em] italic text-ink/70">what&apos;s happening</span> with your bookings.
      </p>
    </div>
    <div className="rounded-2xl bg-maroon p-5 text-white">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-white/70">
        <span className="h-2 w-2 rounded-full bg-pink" /> Next booking
      </div>
      <p className="mt-2 font-display text-[19px] font-extrabold leading-tight tracking-[-0.03em]">Nutrition deep-dive</p>
      <p className="mt-1 text-[13px] font-medium text-white/75">with Ananya Rao · Tue 18 Nov, 6:00 pm</p>
    </div>
    <div className="grid grid-cols-2 gap-2.5">
      {[[CalendarDays, "Upcoming", 3], [Star, "Completed", 11]].map(([Ic, l, v]) => (
        <div key={l} className="flex items-center gap-3 rounded-[8px] border-2 border-neutral-200 bg-white p-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blush text-maroon"><Ic size={19} strokeWidth={2} /></span>
          <div><p className="font-display text-[26px] font-extrabold leading-none tracking-[-0.04em] text-ink">{v}</p><p className="mt-1 text-[11px] font-semibold text-ink/50">{l}</p></div>
        </div>
      ))}
    </div>
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-ink/40">Quick links</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {[[CalendarDays, "My bookings"], [MessageCircle, "Chat with support"], [Star, "My reviews"], [Gift, "Rewards"]].map(([Ic, l]) => (
          <span key={l} className="flex items-center gap-3 rounded-full border-2 border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-ink/70">
            <Ic size={17} strokeWidth={2} className="shrink-0 text-maroon" /><span className="flex-1">{l}</span><ArrowRight size={15} className="text-ink/25" strokeWidth={2.4} />
          </span>
        ))}
      </div>
    </div>
  </div>
);

const Bookings = () => {
  const [filter, setFilter] = useState("All bookings");
  const FILTERS = ["All bookings", "Upcoming", "Completed", "Cancelled"];
  const next = BOOKINGS.find((b) => b.status === "confirmed");
  const shown = BOOKINGS.filter((b) =>
    filter === "All bookings" ? true
    : filter === "Upcoming" ? b.status === "confirmed"
    : filter === "Completed" ? b.status === "completed"
    : b.status === "cancelled");

  return (
    <div>
      <PageHead
        title="My bookings"
        sub="Hi Meera, here are the sessions you've booked."
        right={
          <MeetDropdown size="sm" ariaLabel="Filter bookings" value={filter} onChange={setFilter} options={FILTERS} />
        }
      />

      {next && (
        <div className="mb-4 rounded-2xl bg-maroon p-5 text-white">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-white/70"><CalendarClock className="h-4 w-4" strokeWidth={2.2} /> Your next session · {next.rel}</div>
          <p className="mt-2 font-display text-[19px] font-extrabold leading-tight tracking-[-0.03em]">{next.title}</p>
          <p className="mt-1 text-[13px] font-medium text-white/75">with {next.host} · {next.when}</p>
          <div className="mt-3 flex gap-2">
            <span className="rounded-full bg-white px-3.5 py-1.5 text-[12px] font-bold text-maroon">Join</span>
            <span className="rounded-full bg-white/15 px-3.5 py-1.5 text-[12px] font-bold text-white">Details</span>
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <Empty icon={CalendarDays} title={`No ${filter.toLowerCase()} to show`} body="When you book a session it'll show up here." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((b) => (
            <Card key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink">{b.title}</p>
                  <StatusChip status={b.status} />
                </div>
                <p className="mt-0.5 text-[12px] font-medium text-ink/55">with {b.host}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-medium text-ink/50">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" strokeWidth={2} /> {b.when}</span>
                  <span className="inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5" strokeWidth={2} /> {b.id.slice(3)}</span>
                  <span className="font-bold text-ink/70">{b.amount}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <span className="rounded-full border-2 border-neutral-200 px-3 py-1.5 text-[11.5px] font-bold text-ink/65">Details</span>
                {b.status === "confirmed" && <span className="rounded-full bg-maroon px-3 py-1.5 text-[11.5px] font-bold text-white">Join</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const Invoices = () => (
  <div>
    <PageHead title="Invoices" sub="Download GST tax invoices for your bookings and subscriptions." />
    <div className="flex flex-col gap-2.5">
      {INVOICES.map((v) => (
        <Card key={v.id} className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blush text-maroon"><FileText className="h-[18px] w-[18px]" strokeWidth={2} /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[14px] font-extrabold tracking-[-0.02em] text-ink">{v.number}</p>
            <p className="truncate text-[11.5px] font-medium text-ink/50">{v.type} · {v.date} · <span className="font-bold text-ink/70">{v.total}</span></p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-neutral-200 px-3 py-1.5 text-[11.5px] font-bold text-ink/65 ${ring}`}><Download className="h-3.5 w-3.5" strokeWidth={2.2} /> Download</span>
        </Card>
      ))}
    </div>
  </div>
);

const Rewards = () => (
  <div>
    <div className="mb-4 flex items-center gap-3 rounded-2xl bg-maroon p-5 text-white">
      <Sparkles className="h-6 w-6 shrink-0" strokeWidth={2} />
      <div>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/60">Coming soon</p>
        <p className="font-display text-[18px] font-extrabold tracking-[-0.03em]">Loyalty program</p>
        <p className="text-[12px] font-medium text-white/75">The more you book, the more you climb — and the more you get back.</p>
      </div>
    </div>
    <Card className="mb-4">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink">Your tier</p>
        <p className="text-[12px] font-semibold text-ink/55">Total spent: <span className="font-bold text-ink">₹8,400</span></p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {TIERS.map((t) => (
          <div key={t.name} className={`rounded-xl border-2 p-2.5 ${t.unlocked ? "border-maroon/25 bg-blush" : "border-neutral-200 bg-white"}`}>
            <div className="flex items-center gap-1.5">
              {t.unlocked ? <Trophy className="h-3.5 w-3.5 text-maroon" strokeWidth={2.2} /> : <Lock className="h-3.5 w-3.5 text-ink/30" strokeWidth={2.2} />}
              <p className="font-display text-[12.5px] font-extrabold tracking-[-0.02em] text-ink">{t.name}</p>
            </div>
            <p className="mt-1 text-[11px] font-bold text-maroon">{t.spend}</p>
            <p className="mt-0.5 text-[10.5px] font-medium leading-snug text-ink/50">{t.perks}</p>
          </div>
        ))}
      </div>
    </Card>
    <div className="grid gap-2.5 sm:grid-cols-3">
      {[[Gift, "Rewards", "Credits and gifts as you book."], [Ticket, "Scratch cards", "Win surprise rewards."], [Percent, "Promo codes", "Exclusive codes from our partners."]].map(([Ic, t, b]) => (
        <Card key={t} className="relative">
          <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-neutral-100 text-ink/35"><Lock className="h-3 w-3" strokeWidth={2.4} /></span>
          <Ic className="h-6 w-6 text-maroon" strokeWidth={1.9} />
          <p className="mt-2 font-display text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">{t}</p>
          <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-ink/50">{b}</p>
        </Card>
      ))}
    </div>
  </div>
);

const Reviews = () => (
  <div>
    <PageHead
      title="Reviews"
      sub="What hosts said after your sessions."
      right={<div className="text-right"><p className="font-display text-[22px] font-extrabold leading-none tracking-[-0.03em] text-ink">4.8</p><p className="text-[11px] font-semibold text-ink/50">{REVIEWS.length} reviews</p></div>}
    />
    <div className="flex flex-col gap-2.5">
      {REVIEWS.map((r) => (
        <Card key={r.author + r.when}>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blush font-display text-[12px] font-extrabold text-maroon">{r.author.split(" ").map((w) => w[0]).join("")}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-ink">{r.author}</p>
              <p className="text-[11px] font-medium text-ink/45">{r.when} · {r.service}</p>
            </div>
            <Stars n={r.rating} />
          </div>
          <p className="mt-2 text-[12.5px] font-medium leading-snug text-ink/70">{r.comment}</p>
        </Card>
      ))}
    </div>
  </div>
);

const Courses = () => (
  <div>
    <PageHead title="My courses" sub="Video courses you've purchased." />
    {COURSES.length === 0 ? (
      <Empty icon={Video} title="No courses yet" body="Courses you buy will appear here to watch anytime." />
    ) : (
      <div className="grid gap-3 sm:grid-cols-2">
        {COURSES.map((c) => (
          <div key={c.title} className="overflow-hidden rounded-[8px] border-2 border-neutral-200 bg-white">
            <div className="grid aspect-video place-items-center bg-blush"><Video className="h-8 w-8 text-maroon/40" strokeWidth={1.6} /></div>
            <div className="p-3">
              <p className="font-display text-[14px] font-extrabold tracking-[-0.02em] text-ink">{c.title}</p>
              <p className="mt-0.5 text-[11.5px] font-medium text-ink/50">by {c.by}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const ProfileField = ({ icon: Ic, label, value, hint, readOnly }) => (
  <div>
    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink/40"><Ic className="h-3.5 w-3.5" strokeWidth={2.2} /> {label}</span>
    <div className={`mt-1.5 rounded-xl border-2 border-neutral-200 px-3 py-2.5 text-[13px] font-semibold ${readOnly ? "bg-neutral-50 text-ink/55" : "bg-white text-ink"}`}>{value}</div>
    {hint && <p className="mt-1 text-[10.5px] font-medium text-ink/40">{hint}</p>}
  </div>
);

const Profile = () => (
  <div>
    <PageHead title="My profile" sub="Manage your personal details." right={<span className="rounded-full border-2 border-neutral-200 px-3.5 py-1.5 text-[12px] font-bold text-ink/65">Edit</span>} />
    <Card className="mb-4 flex items-center gap-3">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-maroon font-display text-[18px] font-extrabold text-white">MS</span>
      <div><p className="font-display text-[16px] font-extrabold tracking-[-0.02em] text-ink">{ME.name}</p><p className="text-[12px] font-medium text-ink/50">{ME.email}</p></div>
    </Card>
    <div className="grid gap-3 sm:grid-cols-2">
      <ProfileField icon={User} label="Full name" value={ME.name} />
      <ProfileField icon={Phone} label="Phone number" value={ME.phone} />
      <ProfileField icon={Mail} label="Email" value={ME.email} hint="Your email can't be changed." readOnly />
      <ProfileField icon={Cake} label="Date of birth" value="18 Mar 1994" hint="Private — for your birthday wish." />
    </div>
    <div className="mt-4 flex items-center gap-2 rounded-xl bg-cream p-3 text-[11.5px] font-medium text-ink/55">
      <Lock className="h-4 w-4 shrink-0 text-maroon" strokeWidth={2} /> Your details are private and never shown to hosts beyond your bookings.
    </div>
  </div>
);

const Chat = () => (
  <div className="flex min-h-[60vh] flex-col">
    <PageHead title="Chat with support" sub="We usually reply within a few hours." />
    <Card className="flex flex-1 flex-col gap-3">
      <div className="flex flex-1 flex-col justify-end gap-2.5">
        <div className="max-w-[80%] self-start rounded-2xl rounded-bl-md bg-blush px-3.5 py-2 text-[12.5px] font-medium text-ink">Hi Meera! How can we help with your bookings today?</div>
        <div className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-maroon px-3.5 py-2 text-[12.5px] font-medium text-white">Can I move my Tuesday session to Wednesday?</div>
        <div className="max-w-[80%] self-start rounded-2xl rounded-bl-md bg-blush px-3.5 py-2 text-[12.5px] font-medium text-ink">Of course — I&apos;ll check Ananya&apos;s Wednesday slots and get back to you.</div>
      </div>
      <div className="flex items-center gap-2 rounded-full border-2 border-neutral-200 px-3 py-1.5">
        <input disabled placeholder="Type a message…" className="flex-1 bg-transparent text-[13px] text-ink/70 outline-none" />
        <span className="grid h-8 w-8 place-items-center rounded-full bg-maroon text-white"><ArrowRight className="h-4 w-4" strokeWidth={2.4} /></span>
      </div>
    </Card>
  </div>
);

/* ── Account menu — sample identity, host-guest so the switch shows ──────── */

const AccountMenu = () => {
  const [open, setOpen] = useState(false);
  const r = useRef(null);
  useEffect(() => {
    const onP = (e) => { if (r.current && !r.current.contains(e.target)) setOpen(false); };
    const onK = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onP); document.addEventListener("keydown", onK);
    return () => { document.removeEventListener("pointerdown", onP); document.removeEventListener("keydown", onK); };
  }, []);
  const row = `group mx-1.5 flex w-[calc(100%-12px)] items-center gap-2 rounded-lg px-2 py-[7px] text-left text-[12px] font-medium text-ink/70 transition hover:bg-blush hover:text-ink ${ring}`;
  const slot = "grid h-6 w-6 shrink-0 place-items-center rounded-md bg-neutral-100 text-ink/50 transition group-hover:bg-white group-hover:text-maroon";
  const LINKS = [[User, "Profile"], [CalendarDays, "My bookings"], [Gift, "Rewards"], [HelpCircle, "Help centre", true]];
  return (
    <div ref={r} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`flex items-center gap-1.5 rounded-full p-0.5 transition hover:bg-blush ${ring}`} aria-haspopup="menu" aria-expanded={open}>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-maroon font-display text-[13px] font-extrabold text-white">MS</span>
        <ChevronDown className={`h-4 w-4 text-ink/35 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2.2} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-[8px] border-2 border-neutral-200 bg-white text-ink dash-elev-3" role="menu">
          <div className="relative overflow-hidden bg-blush px-3 pb-3 pt-3.5 text-center">
            <span className="absolute -left-6 -top-8 h-20 w-20 rounded-full border-[3px] border-maroon/10" />
            <span className="absolute -right-7 top-6 h-16 w-16 rounded-full border-[3px] border-maroon/10" />
            <span className="relative mx-auto grid h-11 w-11 place-items-center rounded-full bg-maroon font-display text-[14px] font-extrabold text-white ring-[3px] ring-white">MS</span>
            <p className="relative mt-2 truncate font-display text-[13px] font-bold tracking-[-0.02em]">{ME.name}</p>
            <p className="relative mt-0.5 truncate text-[10.5px] font-medium text-maroon/60">{ME.email}</p>
          </div>
          <div className="border-t-2 border-neutral-200 px-3 py-2.5">
            <div className="flex gap-1 rounded-full bg-neutral-100 p-0.5">
              <button type="button" className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${ring} text-neutral-500 hover:text-neutral-800`}>Hosting</button>
              <button type="button" className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${ring} bg-maroon text-white shadow-sm`}>Guesting</button>
            </div>
          </div>
          <div className="border-t-2 border-neutral-200 py-1.5">
            {LINKS.map(([Ic, l, ext]) => (
              <button key={l} type="button" onClick={() => setOpen(false)} className={row} role="menuitem">
                <span className={slot}><Ic className="h-3.5 w-3.5" strokeWidth={2.2} /></span>
                <span className="flex-1 truncate">{l}</span>
                {ext && <ExternalLink className="h-3 w-3 shrink-0 text-ink/25" strokeWidth={2.4} />}
              </button>
            ))}
          </div>
          <div className="border-t-2 border-neutral-200 py-1.5">
            <button type="button" onClick={() => setOpen(false)} className={`${row} text-ink/55 hover:bg-error-bg hover:text-error-fg`} role="menuitem">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-neutral-100 text-ink/50 transition group-hover:bg-white group-hover:text-error-fg"><LogOut className="h-3.5 w-3.5" strokeWidth={2.2} /></span>
              <span className="flex-1">Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Shell ──────────────────────────────────────────────────────────────── */

export default function GuestConsolePreview() {
  const [navOpen, setNavOpen] = useState(false);
  const triggerRef = useRef(null);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen overflow-x-clip bg-cream">
      <GuestSidebar open={navOpen} onClose={() => setNavOpen(false)} triggerRef={triggerRef} base={BASE} />

      <main className="flex min-w-0 flex-1 flex-col lg:pl-56">
        <div className="bg-marigold-100 px-4 py-1.5 text-center text-[11px] font-bold text-marigold-800">
          PROTOTYPE · restyled guest console · sample data · shown as a host-guest, so the switch is visible
        </div>
        <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center border-b-2 border-neutral-200 bg-cream/95 px-4 backdrop-blur sm:px-6">
          <button type="button" ref={triggerRef} onClick={() => setNavOpen(true)} className={`mr-auto grid h-9 w-9 place-items-center rounded-full text-ink/45 transition hover:bg-blush hover:text-maroon lg:hidden ${ring}`} aria-label="Open navigation">
            <Menu className="h-[19px] w-[19px]" strokeWidth={2} />
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => navigate(`${BASE}/chat`)} aria-label="Support" className={`grid h-9 w-9 place-items-center rounded-full text-ink/45 transition hover:bg-blush hover:text-maroon ${ring}`}>
              <LifeBuoy className="h-[19px] w-[19px]" strokeWidth={1.9} />
            </button>
            <AccountMenu />
          </div>
        </header>

        <div className="app-container max-w-4xl py-7">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="my-bookings" element={<Bookings />} />
            <Route path="courses" element={<Courses />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="loyalty" element={<Rewards />} />
            <Route path="chat" element={<Chat />} />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<Navigate to={BASE} replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
