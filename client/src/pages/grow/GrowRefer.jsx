// Grow → Refer & earn. Same data and rules as before (GET /referrals/mine; the
// reward lifecycle and payouts are untouched): the host's invite link, what it
// has earned, and every referral with its status in words.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, ChevronRight, Copy, Gift, Link2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMyReferrals } from '../../services/api';
import { planLabel } from '../../utils/themeUtils';
import { ErrorState, Skeleton } from '../../components/dashboard/ui';
import { useRegisterRefresh } from '../../components/dashboard/ui/refreshContext';
import { Tile, WhatsAppIcon, cn, inr } from '../../components/dashboard/ui/v2';
import GrowShell, {
  CardHead, Empty, btnPrimary, btnSoft, card, rowBase, tappable,
} from './GrowShell';
import { waShare } from './growModel';

// The reward lifecycle, in words (same labels the old page used).
export const REFERRAL_STATUS = {
  pending: { word: 'Signed up', cls: 'bg-neutral-100 text-ink/60' },
  qualified: { word: 'In review', cls: 'bg-warning-bg text-warning-fg' },
  rewarded: { word: 'Rewarded', cls: 'bg-success-bg text-success-fg' },
  rejected: { word: 'Not eligible', cls: 'bg-error-bg text-error-fg' },
};
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const STEPS = [
  { icon: Link2, text: 'Another creator signs up as a host with your link.' },
  { icon: UserPlus, text: 'They pay for a plan.' },
  { icon: Gift, text: 'After a short review, your cash reward lands in your payout balance.' },
];

export default function GrowRefer() {
  const [data, setData] = useState(undefined); // undefined = loading, null = failed

  const load = useCallback(() => getMyReferrals()
    .then(({ data: d }) => setData(d || {}))
    .catch(() => setData(null)), []);
  useEffect(() => { load(); }, [load]);
  useRegisterRefresh(load);

  const link = data?.username ? `${window.location.origin}/?ref=${data.username}` : '';
  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); toast.success('Invite link copied'); }
    catch { toast.error('Could not copy the link'); }
  };
  const wa = link ? waShare(link, 'Run your bookings on Meeticulous. Join with my link:') : null;

  const sub = 'Invite other creators. Earn cash when they subscribe.';
  if (data === undefined) {
    return (
      <GrowShell sub={sub}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[120px] rounded-[20px]" />)}</div>
        <Skeleton className="h-[220px] rounded-[24px]" />
      </GrowShell>
    );
  }
  if (data === null) {
    return <GrowShell sub={sub}><ErrorState message="Couldn't load your referrals." onRetry={load} /></GrowShell>;
  }

  const s = data.stats || {};
  const list = data.referrals || [];
  const total = Number(s.total) || 0;

  return (
    <GrowShell sub={sub}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <Tile label="Earned" value={total ? inr(s.earned || 0) : null} note="Nothing yet" hint={total ? 'Paid to your balance' : 'Your first invite starts it'} />
        <Tile label="In review" value={Number(s.pendingValue) > 0 ? inr(s.pendingValue) : null} note="Nothing waiting" hint="Released after review" />
        <div className="col-span-2 lg:col-span-1">
          <Tile label="Creators you invited" value={total || null} note="No one yet" hint={total ? `${total === 1 ? 'Has' : 'Have'} signed up with your link` : 'Share your link below'} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <section aria-labelledby="rf-link" className={cn(card, 'pb-5 sm:pb-6')}>
          <CardHead id="rf-link" title="Your invite link" />
          <div className="px-5 sm:px-6">
            {link ? (
              <>
                <p className="mb-0 mt-2 truncate rounded-[12px] bg-cream px-3.5 py-3 font-mono text-[13.5px] text-ink" title={link}>{link.replace(/^https?:\/\//, '')}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={copy} className={btnPrimary}><Copy className="h-4 w-4" strokeWidth={2.2} /> Copy</button>
                  <a href={wa} target="_blank" rel="noreferrer" className={cn(btnSoft, tappable)}><WhatsAppIcon className="h-4 w-4" /> WhatsApp</a>
                </div>
              </>
            ) : (
              <p className="mb-0 mt-2 text-[14px] text-muted">Pick your page link in <Link to="/dashboard/grow/page" className="font-semibold text-maroon underline">Your page</Link> to get an invite link.</p>
            )}
            <ol className="mb-0 mt-5 flex list-none flex-col gap-3 p-0">
              {STEPS.map(({ icon: Icon, text }, i) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-pink-100 text-maroon"><Icon className="h-4 w-4" strokeWidth={2.2} /></span>
                  <span className="pt-1.5 text-[14px] text-ink/80"><span className="sr-only">Step {i + 1}: </span>{text}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="rf-list" className={cn(card, 'overflow-hidden')}>
          <CardHead id="rf-list" title="Your referrals" sub={list.length ? 'Newest first. Names stay private.' : null} />
          <div className="mt-3 border-t border-neutral-200">
            {list.length === 0 ? (
              <Empty compact title="No referrals yet" body="Share your link with a creator friend. Each one who joins shows here with their status." />
            ) : (
              <ul className="divide-y divide-neutral-200">
                {list.map((r) => {
                  const st = REFERRAL_STATUS[r.status] || { word: r.status || 'Unknown', cls: 'bg-neutral-100 text-ink/60' };
                  const reward = Number(r.reward_value) > 0;
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold text-ink">
                          {r.referred_plan ? `${planLabel(r.referred_plan) || r.referred_plan}${r.cadence ? `, ${r.cadence}` : ''}` : 'Signed up, no plan yet'}
                        </span>
                        <span className="block truncate text-[12.5px] text-muted">Joined {fmtDate(r.created_at)}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {reward && <span className="text-[14px] font-semibold tabular-nums text-ink">{inr(r.reward_value)}</span>}
                        <span className={cn('rounded-[8px] px-2 py-0.5 text-[12px] font-semibold', st.cls)}>{st.word}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link to="/dashboard/payments/payouts" className={cn(rowBase, 'border-t border-neutral-200')}>
              <Banknote className="h-5 w-5 shrink-0 text-faint" strokeWidth={2} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">Rewards go to your payout balance</span>
                <span className="block truncate text-[12.5px] text-muted">Verify your PAN and bank to withdraw</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-faint" strokeWidth={2} />
            </Link>
          </div>
        </section>
      </div>

    </GrowShell>
  );
}
