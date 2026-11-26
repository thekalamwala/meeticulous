// Insights (Kept, 2026-11-25) — the rail's old "Intelligence": Overview, Revenue,
// Audience and Demand as ONE page with in-page tabs. Each tab is still its own
// real URL (/dashboard/intelligence/<tab>), so bookmarks and deep links keep
// working; App renders this same component on all four, so switching tabs keeps
// the heading and tab bar in place and only swaps the body.
//
// Tabs: underlined on desktop, a full-width segmented control below 1024px.
// Earnings folded into Revenue: /dashboard/earnings redirects there (App.jsx).
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isFreePlan } from '../../utils/themeUtils';
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
const Tabs = ({ starter }) => (
  // Phone/tablet (<1024): one full-width segmented control, like Bookings.
  // Desktop: text tabs with a maroon underline on a hairline (mock).
  <nav aria-label="Insights" className="grid grid-cols-4 gap-1 rounded-[14px] bg-white p-1 lg:flex lg:gap-7 lg:rounded-none lg:border-b lg:border-neutral-200 lg:bg-transparent lg:p-0">
    {TABS.map((t) => (
      <NavLink key={t.id} to={`/dashboard/intelligence/${t.id}`}
        className={({ isActive }) => cn(
          'inline-flex h-10 min-w-0 items-center justify-center rounded-[10px] px-1 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose',
          'lg:-mb-px lg:h-auto lg:shrink-0 lg:rounded-none lg:border-b-2 lg:px-0.5 lg:pb-3 lg:pt-1 lg:text-[15px]',
          isActive
            ? 'bg-maroon text-white lg:border-maroon lg:bg-transparent lg:text-maroon'
            : 'text-muted active:bg-blush lg:border-transparent lg:hover:text-maroon',
        )}>
        {() => (
          <span className="inline-flex min-w-0 items-center gap-1">
            <span className="truncate">{t.label}</span>
            {starter && t.pro && (
              <>
                {/* Desktop only: four phone segments have no room for it, and the
                    tab's own band says "Pro" the moment it opens. */}
                <span className="hidden shrink-0 rounded-[6px] bg-blush px-1.5 py-px text-[12px] font-semibold leading-tight text-maroon lg:inline">Pro</span>
              </>
            )}
          </span>
        )}
      </NavLink>
    ))}
  </nav>
);

const Insights = () => {
  const { tab } = useParams();
  const { user } = useAuth();
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
        <Tabs starter={isFreePlan(user?.plan)} />
      </header>
      <Body key={current.id} />
    </div>
  );
};

export default Insights;
