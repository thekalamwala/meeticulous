import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { Menu, LogOut, LifeBuoy, ChevronDown, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import GuestSidebar from "./GuestSidebar";

// Guest-space shell (/user/*). A single-level console for the logged-in
// customer: a labelled left rail (GuestSidebar) + a lean topbar. Deliberately
// simpler than the host DashboardLayout — no plan chip, no KYC tick, no
// public-profile link, and crucially NO hosting/mode switch. Guest chrome only.

// Compact account menu — Profile + Log out. Guests have no plan/billing/KYC.
const AccountMenu = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const initial = (user?.name || user?.email || "U").trim().charAt(0).toUpperCase();

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full p-0.5 transition-colors hover:bg-gray-100"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {user?.profile_image ? (
          <img src={user.profile_image} alt={user?.name || "You"} className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initial}
          </div>
        )}
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
          role="menu"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="truncate text-sm font-bold text-gray-900">{user?.name || "You"}</p>
            {user?.email && <p className="truncate text-xs text-gray-500">{user.email}</p>}
          </div>
          <div className="py-1.5">
            <Link
              to="/user/profile"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
              role="menuitem"
            >
              <User className="h-4 w-4 shrink-0" strokeWidth={1.7} />
              <span className="flex-1">Profile</span>
            </Link>
          </div>
          <div className="border-t border-gray-100 py-1.5">
            <button
              type="button"
              onClick={() => { setOpen(false); logout?.(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-500 transition-colors hover:bg-red-50"
              role="menuitem"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.7} />
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
    <div className="flex min-h-screen overflow-x-hidden" style={{ background: "#F8FAFC" }}>
      <GuestSidebar open={navOpen} onClose={() => setNavOpen(false)} triggerRef={navTriggerRef} />

      {/* Main — offset by the fixed 224px (w-56) rail on lg+. */}
      <main className="flex min-w-0 flex-1 flex-col lg:pl-56">
        <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center border-b border-gray-200/80 bg-white/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6">
          <button
            ref={navTriggerRef}
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-haspopup="dialog"
            className="mr-1 grid h-9 w-9 place-items-center rounded-full text-gray-500 transition-colors hover:bg-primary/5 hover:text-primary lg:hidden"
          >
            <Menu className="h-[19px] w-[19px]" strokeWidth={1.8} />
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/help"
              title="Support"
              aria-label="Support"
              className="grid h-9 w-9 place-items-center rounded-full text-gray-500 transition-colors hover:bg-primary/5 hover:text-primary"
            >
              <LifeBuoy className="h-[19px] w-[19px]" strokeWidth={1.7} />
            </Link>
            <AccountMenu />
          </div>
        </header>

        <div className="app-container max-w-4xl py-7 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default GuestLayout;
