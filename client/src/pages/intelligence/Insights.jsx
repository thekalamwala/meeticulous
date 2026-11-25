// Insights (Kept, 2026-11-25) — the rail's old "Intelligence": Overview, Revenue,
// Audience and Demand as ONE page with in-page tabs. Each tab is still its own
// real URL (/dashboard/intelligence/<tab>), so bookmarks and deep links keep
// working; App renders this same component on all four, so switching tabs keeps
// the heading and tab bar in place and only swaps the body.
//
// Tabs: underlined on desktop, chips on a phone (one layout, restyled at sm).
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
  { id: 'audience', label: 'Audience', Body: IntelAudience },
  { id: 'demand', label: 'Demand', Body: IntelDemand },
];

const Tabs = () => (
  <nav aria-label="Insights" className="dash-noscrollbar -mx-1 flex gap-2 overflow-x-auto px-1 sm:mx-0 sm:gap-7 sm:overflow-visible sm:border-b sm:border-neutral-200 sm:px-0">
    {TABS.map((t) => (
      <NavLink key={t.id} to={`/dashboard/intelligence/${t.id}`}
        className={({ isActive }) => cn(
          'shrink-0 whitespace-nowrap text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose',
          // Phone: chips. Desktop: text tabs with a maroon underline on the hairline.
          'rounded-[12px] px-4 py-2 sm:-mb-px sm:rounded-none sm:border-b-2 sm:px-0.5 sm:pb-3 sm:pt-1 sm:text-[15px]',
          isActive
            ? 'bg-maroon text-white sm:border-maroon sm:bg-transparent sm:text-maroon'
            : 'bg-white text-muted hover:bg-blush hover:text-maroon sm:border-transparent sm:bg-transparent sm:hover:bg-transparent',
        )}>
        {t.label}
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
        <h1 className="mb-0 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon sm:text-[34px]">Insights</h1>
        <Tabs />
      </header>
      <Body key={current.id} />
    </div>
  );
};

export default Insights;
