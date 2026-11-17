import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation, Link, useNavigate } from "react-router-dom";
import {
  LogOut, LifeBuoy, ChevronDown, User, CalendarDays, Gift, HelpCircle, ExternalLink,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { isHost } from "../../utils/roleRoutes";
import GuestSidebar from "./GuestSidebar";
import GuestTabBar from "./GuestTabBar";
import PullToRefresh from "../dashboard/ui/PullToRefresh";
import { RefreshProvider } from "../dashboard/ui/refreshContext";

// Guest-space shell (/user/*). A single-level console for the logged-in
// customer: a labelled left rail (GuestSidebar) + a lean topbar. Deliberately
// simpler than the host DashboardLayout — no plan chip, no KYC tick, no
// public-profile link, and crucially NO hosting/mode switch. Guest chrome only.
//
// STYLING (explore/console-restyle): Loop & Slot — cream ground, 2px rounded
// borders, maroon avatar, blush menu head with the ee-thread arcs, icon-in-slot
// rows. The account menu follows the Host Lab ProfileMenu styling, with
// guest-appropriate contents (no Pro badge, no setup checklist, no mode switch).

const ring = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose";

// Rich account menu — matches the Host Lab profile menu. A guest has no plan,
// no setup checklist and no second door, so those rows are dropped; the
// identity head, the inset blush-hover rows and the error-bg sign-out stay.
const AccountMenu = () => {
  const { user, logout, mode, setMode } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const name = user?.name || "You";

  // Dual-capability accounts (a host who is also in their guest space) can hop
  // doors. Same mechanism the host DashboardLayout uses: set the mode, go to the
  // other console. Pure guests are not hosts, so they never see this.
  const dual = isHost(user);
  const switchMode = (next) => {
    setOpen(false);
    if (next === (mode || "traveling")) return;
    setMode?.(next);
    navigate(next === "hosting" ? "/dashboard" : "/user");
  };
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "U";

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    const onPointer = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  const row = `group mx-1.5 flex w-[calc(100%-12px)] items-center gap-2 rounded-lg px-2 py-[7px] text-left text-[12px] font-medium text-ink/70 transition hover:bg-blush hover:text-ink ${ring}`;
  const slot = "grid h-6 w-6 shrink-0 place-items-center rounded-md bg-neutral-100 text-ink/50 transition group-hover:bg-white group-hover:text-maroon";

  const LINKS = [
    { label: "Profile", to: "/user/profile", icon: User },
    { label: "My bookings", to: "/user/my-bookings", icon: CalendarDays },
    { label: "Rewards", to: "/user/loyalty", icon: Gift },
    { label: "Help centre", to: "/help", icon: HelpCircle, external: true },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full p-0.5 transition hover:bg-blush ${ring}`}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {user?.profile_image ? (
          <img src={user.profile_image} alt={name} className="h-9 w-9 rounded-full object-cover ring-2 ring-maroon/15" />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-full bg-maroon font-display text-[13px] font-extrabold text-white">
            {initials}
          </div>
        )}
        <ChevronDown className={`h-4 w-4 text-ink/35 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2.2} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border-2 border-neutral-200 bg-white text-ink dash-elev-3"
          role="menu"
        >
          {/* Identity head — blush ground with the ee-thread arcs behind the
              avatar (brand motif, tone-on-tone, never over text). */}
          <div className="relative overflow-hidden bg-blush px-3 pb-3 pt-3.5 text-center">
            <span aria-hidden="true" className="absolute -left-6 -top-8 h-20 w-20 rounded-full border-[3px] border-maroon/10" />
            <span aria-hidden="true" className="absolute -right-7 top-6 h-16 w-16 rounded-full border-[3px] border-maroon/10" />
            {user?.profile_image ? (
              <img src={user.profile_image} alt={name} className="relative mx-auto h-11 w-11 rounded-full object-cover ring-[3px] ring-white" />
            ) : (
              <span className="relative mx-auto grid h-11 w-11 place-items-center rounded-full bg-maroon font-display text-[14px] font-extrabold text-white ring-[3px] ring-white">
                {initials}
              </span>
            )}
            <p className="relative mt-2 truncate font-display text-[13px] font-bold leading-tight tracking-[-0.02em]">{name}</p>
            {user?.email && <p className="relative mt-0.5 truncate text-[10.5px] font-medium text-maroon/60">{user.email}</p>}
          </div>

          {/* Mode switch — the SAME segmented pill the host DashboardLayout
              shows: isHost-gated, mode-driven active half, setMode + navigate.
              Kept visually identical to /dashboard so the two consoles agree. */}
          {dual && (
            <div className="border-t-2 border-neutral-200 px-3 py-2.5">
              <div className="flex gap-1 rounded-full bg-neutral-100 p-0.5">
                <button
                  type="button"
                  onClick={() => switchMode("hosting")}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${ring} ${
                    (mode || "traveling") === "hosting" ? "bg-maroon text-white shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  Hosting
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("traveling")}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${ring} ${
                    (mode || "traveling") === "traveling" ? "bg-maroon text-white shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  Guesting
                </button>
              </div>
            </div>
          )}

          <div className="border-t-2 border-neutral-200 py-1.5">
            {LINKS.map((l) => (
              <Link key={l.label} to={l.to} onClick={() => setOpen(false)} className={row} role="menuitem">
                <span className={slot}><l.icon className="h-3.5 w-3.5" strokeWidth={2.2} /></span>
                <span className="flex-1 truncate">{l.label}</span>
                {l.external && <ExternalLink className="h-3 w-3 shrink-0 text-ink/25" strokeWidth={2.4} />}
              </Link>
            ))}
          </div>

          <div className="border-t-2 border-neutral-200 py-1.5">
            <button
              type="button"
              onClick={() => { setOpen(false); logout?.(); }}
              className={`${row} text-ink/55 hover:bg-error-bg hover:text-error-fg`}
              role="menuitem"
            >
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

const GuestLayout = () => {
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const navTriggerRef = useRef(null);

  // Route change closes the mobile drawer.
  useEffect(() => { setNavOpen(false); }, [pathname]);

  return (
    <RefreshProvider>
    <div className="flex min-h-screen overflow-x-clip bg-cream">
      <GuestSidebar open={navOpen} onClose={() => setNavOpen(false)} triggerRef={navTriggerRef} />

      {/* Main — offset by the fixed 224px (w-56) rail on lg+. */}
      <main className="flex min-w-0 flex-1 flex-col lg:pl-56">
        <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center border-b-2 border-neutral-200 bg-cream/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6">
          {/* Mobile nav opener moved to the bottom tab bar's "More" button. */}
          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/help"
              title="Support"
              aria-label="Support"
              className={`grid h-9 w-9 place-items-center rounded-full text-ink/45 transition hover:bg-blush hover:text-maroon ${ring}`}
            >
              <LifeBuoy className="h-[19px] w-[19px]" strokeWidth={1.9} />
            </Link>
            <AccountMenu />
          </div>
        </header>

        {/* pb clears the fixed mobile tab bar (+ safe area); desktop keeps py-7. */}
        <PullToRefresh>
          <div className="app-container max-w-4xl py-7 pb-[calc(68px+env(safe-area-inset-bottom))] flex-1 lg:pb-7">
            <Outlet />
          </div>
        </PullToRefresh>
      </main>

      {/* Native-app bottom tab bar — mobile only (< lg). Its "More" button is the
          mobile nav opener (the topbar hamburger moved here). */}
      <GuestTabBar onOpenMore={() => setNavOpen(true)} moreTriggerRef={navTriggerRef} />
    </div>
    </RefreshProvider>
  );
};

export default GuestLayout;
