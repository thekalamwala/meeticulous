// Insights (Kept, 2026-11-25) — the rail's old "Intelligence": Overview, Revenue,
// Audience and Demand as ONE page with in-page tabs. Each tab is still its own
// real URL (/dashboard/intelligence/<tab>), so bookmarks and deep links keep
// working; App renders this same component on all four, so switching tabs keeps
// the heading and tab bar in place and only swaps the body.
//
// Tabs: a full-width segmented control below 1024px. On desktop (lg+, where the
// rail lists Overview/Revenue/Audience/Demand as its sub-rows) the in-page tabs are
// hidden: the rail already switches them, and two navs for one choice was noise.
// Earnings folded into Revenue: /dashboard/earnings redirects there (App.jsx).
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { cn } from '../../components/dashboard/ui/v2';
import IntelOverview from './IntelOverview';
import IntelRevenue from './IntelRevenue';
import IntelAudience from './IntelAudience';
import IntelDemand from './IntelDemand';

const TABS = [
  { id: 'overview', label: 'Overview', Body: IntelOverview },
  { id: 'revenue', label: 'Revenue', Body: IntelRevenue },
  { id: 'audience', label: 'Audience', Body: IntelAudience, pro: true },
  { id: 'demand', label: 'Demand', Body: IntelDemand, pro: true },
];

// Starter sees a small "Pro" tag on the Pro-only tabs (mock). The server is still
// the gate; this tag only sets expectations before the click.
const Tabs = () => (
  // Phone/tablet (<1024): one full-width segmented control, like Bookings.
  // Desktop: hidden; the rail's sub-rows are the tabs (founder call, 2026-11-27).
  <nav aria-label="Insights" className="grid grid-cols-4 gap-1 rounded-[14px] bg-white p-1 lg:hidden">
    {TABS.map((t) => (
      <NavLink key={t.id} to={`/dashboard/intelligence/${t.id}`}
        className={({ isActive }) => cn(
          'inline-flex h-10 min-w-0 items-center justify-center rounded-[10px] px-1 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose',
          isActive ? 'bg-maroon text-white' : 'text-muted active:bg-blush',
        )}>
        {/* No "Pro" tag: four phone segments have no room for it, and the tab's
            own band says "Pro" the moment it opens. */}
        <span className="truncate">{t.label}</span>
      </NavLink>
    ))}
  </nav>
);

const Insights = () => {
  const { tab } = useParams();
  const current = TABS.find((t) => t.id === tab);
  if (!current) return <Navigate to="/dashboard/intelligence/overview" replace />;
  const { Body } = current;
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 sm:gap-5">
        <div>
          <h1 className="mb-0 font-display text-[26px] font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon lg:text-[34px]">Insights</h1>
          <p className="mb-0 mt-1.5 text-[13.5px] text-muted sm:text-[15px]">What your bookings are telling you, and where to act next.</p>
        </div>
        <Tabs />
      </header>
      <Body key={current.id} />
    </div>
  );
};

export default Insights;
