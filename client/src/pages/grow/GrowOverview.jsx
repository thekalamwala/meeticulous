// Grow → Overview — what the raised centre tab opens on (founder pick, 2026-11-26).
// One band that says the single most useful thing about getting found, then one
// card per Grow tab with its real headline figure. Every figure is fetched; a card
// whose read failed says so in words, never a zero.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Copy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getAvailability, getMyKyc, getMyProfileViews, getMyReferrals, getMyServices,
  getMyTestimonials, getReceivedReviews,
} from '../../services/api';
import { buildSetupSteps } from '../../components/dashboard/SetupGuide';
import { Skeleton } from '../../components/dashboard/ui';
import { useRegisterRefresh } from '../../components/dashboard/ui/refreshContext';
import { InsightBand, Tile, WhatsAppIcon, inr } from '../../components/dashboard/ui/v2';
import GrowShell, { BandGhost, BandPrimary, readShared, serif, useCopyPageLink, useIsDesktop } from './GrowShell';
import { GROW_PAGE, growBand, pageUrl, waShare } from './growModel';

const settle = (p, pick) => p.then((r) => pick(r)).catch(() => null);

export default function GrowOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [d, setD] = useState(null); // null = loading
  const [linkShared, setLinkShared] = useState(readShared);

  const load = useCallback(() => Promise.all([
    settle(getMyProfileViews(), (r) => Number(r?.data?.views) || 0),
    settle(getReceivedReviews('guest_to_host'), (r) => ({ count: Number(r?.data?.count) || 0, avg: Number(r?.data?.avg) || 0 })),
    settle(getMyTestimonials(), (r) => (Array.isArray(r?.data) ? r.data.length : 0)),
    settle(getMyReferrals(), (r) => r?.data?.stats || {}),
    settle(getMyServices(), (r) => (Array.isArray(r?.data) ? r.data.length > 0 : true)),
    getAvailability().then((r) => !!r?.data).catch(() => true), // failed read: don't nag
    settle(getMyKyc(), (r) => r?.data ?? null),
  ]).then(([views, reviews, quotes, referrals, hasService, availabilitySet, kyc]) => {
    setD({ views, reviews, quotes, referrals, hasService: hasService ?? true, availabilitySet, kyc });
  }), []);
  useEffect(() => { load(); }, [load]);
  useRegisterRefresh(load);

  const copy = useCopyPageLink(user?.username, () => setLinkShared(true));
  const steps = useMemo(() => (d ? buildSetupSteps({ ...d, user, linkShared }) : []), [d, user, linkShared]);
  const go = (to) => navigate(to);

  if (!d) {
    return (
      <GrowShell sub="More people to your page, and more proof on it.">
        <Skeleton className="h-[220px] rounded-[28px] sm:rounded-[32px]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className={`h-[132px] rounded-[20px] ${i === 2 ? 'col-span-2 lg:col-span-1' : ''}`} />)}
        </div>
      </GrowShell>
    );
  }

  const band = growBand({ steps, views: d.views, reviews: d.reviews });
  const url = pageUrl(user?.username);
  const setupLeft = steps.filter((s) => !s.done).length;

  // One card per tab, each with its one real figure (or a sentence when there is none).
  const r = d.reviews;
  const ref = d.referrals;
  const cards = [
    { key: 'page', label: 'Your page', onClick: () => go(GROW_PAGE), more: 'Edit',
      ...(setupLeft
        ? { value: null, note: `${steps.length - setupLeft} of ${steps.length} setup steps done`, hint: 'Finish to go live' }
        : d.views == null ? { value: null, note: 'Visits not counted yet', hint: 'Live' }
          : { value: d.views.toLocaleString('en-IN'), hint: d.views === 1 ? 'Visit so far' : 'Visits so far' }) },
    { key: 'reviews', label: 'Reviews', onClick: () => go('/dashboard/testimonials'), more: 'Open',
      ...(r == null ? { value: null, note: 'Could not load reviews' }
        : r.count ? { value: `${r.avg.toFixed(1)}★`, hint: `${r.count} guest ${r.count === 1 ? 'review' : 'reviews'}` }
          : { value: null, note: 'No guest reviews yet', hint: d.quotes ? `${d.quotes} ${d.quotes === 1 ? 'quote' : 'quotes'} on your page` : 'Add a quote you have' }) },
    { key: 'refer', label: 'Refer & earn', onClick: () => go('/dashboard/referrals'), more: 'Invite',
      ...(ref == null ? { value: null, note: 'Could not load referrals' }
        : (ref.total || 0) > 0 ? { value: inr(ref.earned || 0), hint: `Earned from ${ref.total} ${ref.total === 1 ? 'host' : 'hosts'}` }
          : { value: null, note: 'Invite a fellow creator', hint: 'Earn cash when they subscribe' }) },
  ].filter(Boolean);

  const actions = band.kind === 'setup' ? (
    <>
      <BandPrimary to={GROW_PAGE}>Finish your page <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandPrimary>
      {url && <BandGhost onClick={copy}><Copy className="h-4 w-4" strokeWidth={2.4} /> Copy link</BandGhost>}
    </>
  ) : (
    <>
      <BandPrimary onClick={copy}><Copy className="h-4 w-4" strokeWidth={2.4} /> Copy booking link</BandPrimary>
      {url && <BandGhost href={waShare(url)}><WhatsAppIcon className="h-4 w-4" /> WhatsApp</BandGhost>}
    </>
  );

  return (
    <GrowShell sub="More people to your page, and more proof on it.">
      <InsightBand mascot="green" compact className="sm:py-5" eyebrow="Grow"
        title={<>{band.title[0]} <em className={serif}>{band.title[1]}</em></>}
        sub={band.sub} actions={actions} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        {/* Phone tiles are half-width: the whole tile is the tap target, so the
            "Open →" word would only crowd out the hint. */}
        {/* Three cards: the last runs full width on a phone so the grid has no hole. */}
        {cards.map(({ key, more, ...c }, i) => (
          <div key={key} className={i === 2 ? 'col-span-2 grid lg:col-span-1' : 'grid'}>
            <Tile {...c} more={isDesktop ? more : undefined} />
          </div>
        ))}
      </div>
    </GrowShell>
  );
}
