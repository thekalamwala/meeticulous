import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  LogOut, LifeBuoy, ChevronDown, User, CalendarDays, Gift, HelpCircle, ExternalLink,
  Star, MessageCircle, ArrowRight, Clock,
} from "lucide-react";
import GuestSidebar from "../components/common/GuestSidebar";

// explore/console-restyle — a WORKING, no-login prototype of the restyled guest
// console at /preview/guest. It reuses the real restyled GuestSidebar and mirrors
// the restyled GuestLayout topbar + account menu and GuestOverview with sample
// data, so the exact Loop & Slot design can be clicked through without a session.
// Public, noindex; renders nothing a real account owns. Not a production surface.

const ring = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose";

const SAMPLE = {
  name: "Meera Shah",
  email: "meera.shah@gmail.com",
  next: { service: "Nutrition deep-dive", host: "Ananya Rao", when: "Tue 18 Nov, 6:00 pm" },
  upcoming: 3,
  completed: 11,
};

// The account menu — identical markup to GuestLayout's AccountMenu, with a
// sample user so the identity head shows populated.
const PreviewAccountMenu = () => {
  const [open, setOpen] = useState(false);
  const r = useRef(null);
  const initials = SAMPLE.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("");

  useEffect(() => {
    const onPointer = (e) => { if (r.current && !r.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, []);

  const row = `group mx-1.5 flex w-[calc(100%-12px)] items-center gap-2 rounded-lg px-2 py-[7px] text-left text-[12px] font-medium text-ink/70 transition hover:bg-blush hover:text-ink ${ring}`;
  const slot = "grid h-6 w-6 shrink-0 place-items-center rounded-md bg-neutral-100 text-ink/50 transition group-hover:bg-white group-hover:text-maroon";
  const LINKS = [
    { label: "Profile", icon: User },
    { label: "My bookings", icon: CalendarDays },
    { label: "Rewards", icon: Gift },
    { label: "Help centre", icon: HelpCircle, external: true },
  ];

  return (
    <div ref={r} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`flex items-center gap-1.5 rounded-full p-0.5 transition hover:bg-blush ${ring}`} aria-haspopup="menu" aria-expanded={open}>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-maroon font-display text-[13px] font-extrabold text-white">{initials}</span>
        <ChevronDown className={`h-4 w-4 text-ink/35 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2.2} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border-2 border-neutral-200 bg-white text-ink dash-elev-3" role="menu">
          <div className="relative overflow-hidden bg-blush px-3 pb-3 pt-3.5 text-center">
            <span aria-hidden="true" className="absolute -left-6 -top-8 h-20 w-20 rounded-full border-[3px] border-maroon/10" />
            <span aria-hidden="true" className="absolute -right-7 top-6 h-16 w-16 rounded-full border-[3px] border-maroon/10" />
            <span className="relative mx-auto grid h-11 w-11 place-items-center rounded-full bg-maroon font-display text-[14px] font-extrabold text-white ring-[3px] ring-white">{initials}</span>
            <p className="relative mt-2 truncate font-display text-[13px] font-bold leading-tight tracking-[-0.02em]">{SAMPLE.name}</p>
            <p className="relative mt-0.5 truncate text-[10.5px] font-medium text-maroon/60">{SAMPLE.email}</p>
          </div>
          <div className="border-t-2 border-neutral-200 px-3 py-2.5">
            <div className="flex gap-1 rounded-full bg-neutral-100 p-0.5">
              <button type="button" className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${ring} text-neutral-500 hover:text-neutral-800`}>Hosting</button>
              <button type="button" className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${ring} bg-maroon text-white shadow-sm`}>Guesting</button>
            </div>
          </div>
          <div className="border-t-2 border-neutral-200 py-1.5">
            {LINKS.map((l) => (
              <button key={l.label} type="button" onClick={() => setOpen(false)} className={row} role="menuitem">
                <span className={slot}><l.icon className="h-3.5 w-3.5" strokeWidth={2.2} /></span>
                <span className="flex-1 truncate">{l.label}</span>
                {l.external && <ExternalLink className="h-3 w-3 shrink-0 text-ink/25" strokeWidth={2.4} />}
              </button>
            ))}
          </div>
          <div className="border-t-2 border-neutral-200 py-1.5">
            <button type="button" onClick={() => setOpen(false)} className={`${row} text-ink/55 hover:bg-error-bg hover:text-error-fg`} role="menuitem">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-neutral-100 text-ink/50 transition group-hover:bg-white group-hover:text-error-fg">
                <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
              <span className="flex-1">Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StatTile = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-xl border-2 border-neutral-200 bg-white p-3.5">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blush text-maroon"><Icon size={19} strokeWidth={2} /></span>
    <div className="min-w-0">
      <p className="font-display text-[26px] font-extrabold leading-none tracking-[-0.04em] text-ink">{value}</p>
      <p className="mt-1 text-[11px] font-semibold text-ink/50">{label}</p>
    </div>
  </div>
);

const QuickLink = ({ icon: Icon, label }) => (
  <span className="flex items-center gap-3 rounded-full border-2 border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-ink/70 transition hover:border-maroon/40 hover:text-ink">
    <Icon size={17} strokeWidth={2} className="shrink-0 text-maroon" />
    <span className="flex-1">{label}</span>
    <ArrowRight size={15} className="text-ink/25" strokeWidth={2.4} />
  </span>
);

// The restyled Overview, populated with sample data.
const PreviewOverview = () => (
  <div className="flex flex-col gap-5">
    <div>
      <h1 className="font-display text-[26px] font-extrabold leading-none tracking-[-0.04em] text-maroon">Hi {SAMPLE.name.split(" ")[0]}</h1>
      <p className="mt-1.5 text-[13px] font-medium text-ink/55">
        Here&apos;s <span className="font-serif text-[1.08em] italic text-ink/70">what&apos;s happening</span> with your bookings.
      </p>
    </div>

    <div className="block rounded-2xl bg-maroon p-5 text-white">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-white/70">
        <span className="h-2 w-2 rounded-full bg-pink" aria-hidden="true" /> Next booking
      </div>
      <p className="mt-2 font-display text-[19px] font-extrabold leading-tight tracking-[-0.03em]">{SAMPLE.next.service}</p>
      <p className="mt-1 text-[13px] font-medium text-white/75">with {SAMPLE.next.host} · {SAMPLE.next.when}</p>
    </div>

    <div className="grid grid-cols-2 gap-2.5">
      <StatTile icon={CalendarDays} label="Upcoming" value={SAMPLE.upcoming} />
      <StatTile icon={Star} label="Completed" value={SAMPLE.completed} />
    </div>

    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-ink/40">Quick links</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <QuickLink icon={CalendarDays} label="My bookings" />
        <QuickLink icon={MessageCircle} label="Chat with support" />
        <QuickLink icon={Star} label="My reviews" />
        <QuickLink icon={Gift} label="Rewards" />
      </div>
    </div>
  </div>
);

export default function GuestConsolePreview() {
  const [navOpen, setNavOpen] = useState(false);
  const triggerRef = useRef(null);

  return (
    <div className="flex min-h-screen overflow-x-clip bg-cream">
      <GuestSidebar open={navOpen} onClose={() => setNavOpen(false)} triggerRef={triggerRef} />

      <main className="flex min-w-0 flex-1 flex-col lg:pl-56">
        <div className="bg-marigold-100 px-4 py-1.5 text-center text-[11px] font-bold text-marigold-800">
          PROTOTYPE · restyled guest console · sample data · shown as a host-guest, so the switch is visible
        </div>
        <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center border-b-2 border-neutral-200 bg-cream/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button" ref={triggerRef} onClick={() => setNavOpen(true)}
            className={`mr-auto grid h-9 w-9 place-items-center rounded-full text-ink/45 transition hover:bg-blush hover:text-maroon lg:hidden ${ring}`}
            aria-label="Open navigation"
          >
            <Clock className="h-[19px] w-[19px]" strokeWidth={1.9} />
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Link to="/help" aria-label="Support" className={`grid h-9 w-9 place-items-center rounded-full text-ink/45 transition hover:bg-blush hover:text-maroon ${ring}`}>
              <LifeBuoy className="h-[19px] w-[19px]" strokeWidth={1.9} />
            </Link>
            <PreviewAccountMenu />
          </div>
        </header>

        <div className="app-container max-w-4xl py-7">
          <PreviewOverview />
        </div>
      </main>
    </div>
  );
}
