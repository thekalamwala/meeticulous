import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DashboardLayoutV2 from "./DashboardLayoutV2";
import { ProfileMenu } from "./DashboardLayout";
import { GUEST_HOME, GUEST_HELP, GUEST_SECTIONS, GUEST_GROUPS, GUEST_ICONS, GUEST_TAB_BAR } from "./guestNav";

// Guest-space shell (/user/*). Kept (2026-11-27): the guest console runs on the
// SAME shell as the host dashboard — rail, topbar, phone tab bar, More sheet —
// so a dual-login host never crosses into what looks like another product.
// Only the nav model and the account menu differ. No bell: guests have no
// notification feed. Spec: docs/superpowers/specs/2026-11-27-guest-dashboard-kept-design.md

const GuestAccountMenu = () => {
  const { user, logout } = useAuth();
  const initial = (user?.name || user?.email || "U").trim().charAt(0).toUpperCase();
  return (
    <>
      <div className="hidden lg:block">
        <ProfileMenu guest user={user} initial={initial} logout={logout} identity
          triggerClassName="flex h-12 max-w-[260px] items-center gap-2.5 rounded-[14px] bg-white py-1.5 pl-1.5 pr-3 transition hover:bg-pink-100"
          chevronClassName="h-4 w-4 shrink-0 text-faint" />
      </div>
      <div className="lg:hidden"><ProfileMenu guest user={user} initial={initial} logout={logout} /></div>
    </>
  );
};

export const GUEST_SHELL = {
  home: GUEST_HOME,
  sections: GUEST_SECTIONS,
  groups: GUEST_GROUPS,
  icons: GUEST_ICONS,
  helpTo: GUEST_HELP,
  showBell: false,
  AccountMenu: GuestAccountMenu,
  tabBar: GUEST_TAB_BAR,
};

const GuestLayout = () => (
  <DashboardLayoutV2 config={GUEST_SHELL}>
    <Outlet />
  </DashboardLayoutV2>
);

export default GuestLayout;
