import { Link, useNavigate } from "react-router-dom";
import { Check, Lock } from "lucide-react";
import { InsightBand, Panel, PageHeading, cn, inr } from "../components/dashboard/ui/v2";
import { KeptError } from "./catalog/KeptKit";
import { TIERS, spendOf, tierProgress } from "./guest/guestModel";
import { BandPrimary, serif, useGuestBookings } from "./guest/GuestKit";

// /user/loyalty — Rewards (Kept). Founder call 2026-11-27 (option A): show the
// guest's REAL spend and tier progress; perks are listed but none is applied yet
// ("Unlocking soon"). Spend-only model: tiers come purely from lifetime spend on
// Meeticulous. Day one counts paid bookings only — course and membership amounts
// aren't in a guest feed yet, and the page says so. Perks are discounts, never
// stored credits (no-wallet rule).

const Loyalty = () => {
  const navigate = useNavigate();
  const { bookings, error, load } = useGuestBookings();

  if (error && !bookings) {
    return <div className="flex flex-col gap-6"><PageHeading title="Rewards" /><KeptError what="bookings" onRetry={load} /></div>;
  }
  const ready = !!bookings;
  const spent = spendOf(bookings || []);
  const { tier, next, gap, pct, index } = tierProgress(spent);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <PageHeading title="Rewards" sub="Climb tiers as you book. There's nothing to claim or apply for." />
        {!ready ? <div aria-hidden="true" className="h-[188px] animate-pulse rounded-[28px] bg-white sm:rounded-[32px]" /> : (
          <InsightBand mascot="purple" compact eyebrow={`You're ${tier.name}`}
            title={next
              ? <>You&apos;ve spent {inr(spent)}. <em className={serif}>{inr(gap)} to {next.name}.</em></>
              : <>You&apos;ve spent {inr(spent)}. <em className={serif}>Top tier.</em></>}
            sub="Based on your paid bookings. Courses and memberships will count soon."
            actions={next && <BandPrimary onClick={() => navigate("/explore")}>Book a session</BandPrimary>}
            aside={next && (
              <div className="max-w-[320px]">
                <div className="h-2.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label={`Progress to ${next.name}`}
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
                  <div className="h-full rounded-full bg-pink" style={{ width: `${Math.max(4, pct * 100)}%` }} />
                </div>
                <p className="mb-0 mt-2 flex justify-between text-[13px] text-white/80"><span>{tier.name}</span><span>{next.name} at {inr(next.spend)}</span></p>
              </div>
            )} />
        )}
      </div>

      <Panel title="Tiers" subtitle="Tiers are based only on your lifetime spend on Meeticulous. Every paid booking counts.">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t, i) => {
            const reached = ready && i <= index;
            const current = ready && i === index;
            return (
              <li key={t.name} className={cn("flex flex-col gap-2 rounded-[20px] p-4", current ? "bg-pink-50 ring-2 ring-inset ring-maroon" : "bg-cream")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="mb-0 font-display text-[18px] font-bold tracking-[-0.02em] text-ink">{t.name}</p>
                  {reached
                    ? <span className="grid h-6 w-6 place-items-center rounded-full bg-maroon text-white" aria-label="Reached"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                    : <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-faint" aria-label="Not reached yet"><Lock className="h-3.5 w-3.5" strokeWidth={2.4} /></span>}
                </div>
                <p className="mb-0 text-[14px] font-semibold tabular-nums text-maroon">{t.spend === 0 ? "Everyone starts here" : `${inr(t.spend)} spent`}</p>
                <ul className="flex flex-col gap-1">
                  {t.perks.map((p) => <li key={p} className="text-[13px] text-muted">{p}</li>)}
                </ul>
                <span className="mt-auto w-fit rounded-[6px] bg-white px-2 py-0.5 text-[12px] font-semibold text-muted">Unlocking soon</span>
              </li>
            );
          })}
        </ol>
      </Panel>

      <p className="mb-0 text-center text-[14px] text-muted">
        Perks switch on soon. Your spend already counts toward your tier.{" "}
        <Link to="/explore" className="font-semibold text-maroon hover:underline">Explore creators</Link>
      </p>
    </div>
  );
};

export default Loyalty;
