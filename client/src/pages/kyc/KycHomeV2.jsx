// Verification (Kept) — entered from Money's balance. Same data as KycHome
// (getMyKyc: status, review note, masked PAN / Aadhaar / bank / account,
// pending_earnings, payouts_ready) and the same way in to the flow
// (/dashboard/kyc/flow/start). Restyle only: nothing here collects or validates.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Landmark, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { getMyKyc } from '../../services/api';
import { Skeleton } from '../../components/dashboard/ui';
import { InsightBand, Panel, cn, inr } from '../../components/dashboard/ui/v2';
import { PinnedAction, ring, tappable } from '../money/MoneyV2';

const serif = 'font-serif font-normal italic text-pink';

// What the page says for each KYC state. Exported for tests.
export const kycCopy = (kyc) => {
  const status = kyc?.status || 'not_started';
  const waiting = Number(kyc?.pending_earnings) || 0;
  const money = waiting > 0 && !kyc?.payouts_ready ? inr(waiting) : null;
  switch (status) {
    case 'pending':
      return { eyebrow: 'Verification', title: ["We're checking", 'your details'], sub: money ? `${money} goes to your bank as soon as you're approved.` : "Payouts switch on as soon as you're approved." };
    case 'rejected':
      return { eyebrow: 'Verification', title: ['Your details', 'need a fix'], sub: kyc?.review_note ? `Why: ${kyc.review_note}` : 'Check your details and send them again.', action: 'Fix and re-submit' };
    case 'approved':
      return kyc?.payouts_ready === false
        ? { eyebrow: 'Almost there', title: ['Finish your', 'payout setup'], sub: `Add your registered address so Razorpay can pay you${money ? `. ${money} is waiting` : ''}.`, action: 'Finish setup' }
        : { eyebrow: 'Verification', title: ["You're verified.", 'Payouts are on.'], sub: 'Every paid booking goes to your bank on its own.', secondary: 'Update details' };
    default:
      return { eyebrow: 'Verification', title: money ? [`${money} is waiting.`, 'Verify to get it.'] : ['Verify once,', 'get paid every time'], sub: 'Three short steps: you, your bank, your address. Needed before your first payout.', action: 'Start verification' };
  }
};

const STEPS = [
  { Icon: UserRound, title: 'You', note: 'Name, email, phone and PAN' },
  { Icon: Landmark, title: 'Your bank', note: 'Where your payouts go' },
  { Icon: MapPin, title: 'Your address', note: 'Your registered address' },
];

const Row = ({ Icon, title, note, first }) => (
  <li className="flex items-center gap-3 pl-4 sm:pl-5">
    <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blush text-maroon"><Icon className="h-[18px] w-[18px]" strokeWidth={2} /></span>
    <span className={cn('flex min-h-[60px] min-w-0 flex-1 flex-col justify-center py-3 pr-4 sm:pr-5', !first && 'border-t border-neutral-200')}>
      <span className="block truncate text-[14px] font-semibold text-ink lg:text-[15px]">{title}</span>
      <span className="block truncate text-[12.5px] text-muted lg:text-[13.5px]">{note}</span>
    </span>
  </li>
);

const btnBase = cn('inline-flex h-11 items-center justify-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold transition-colors', tappable);

export default function KycHomeV2() {
  const [kyc, setKyc] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    getMyKyc().then(({ data }) => setKyc(data)).catch(() => setKyc({ status: 'not_started' }));
  }, []);
  const start = () => navigate('/dashboard/kyc/flow/start');

  const head = (
    <div className="flex flex-col gap-2">
      <Link to="/dashboard/payments/payouts" className={cn('inline-flex w-fit items-center gap-1 rounded-[8px] text-[14px] font-semibold text-maroon hover:underline', tappable, ring)}>
        <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />Money
      </Link>
      <h1 className="mb-0 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon lg:text-[34px]">Verification</h1>
    </div>
  );

  if (!kyc) return <div className="flex flex-col gap-5">{head}<Skeleton className="h-[220px] rounded-[28px]" /><Skeleton className="h-[200px] rounded-[24px]" /></div>;

  const status = kyc.status || 'not_started';
  const c = kycCopy(kyc);
  const details = [
    ['PAN', kyc.pan_number], ['Aadhaar', kyc.aadhaar_number], ['Bank', kyc.bank_name], ['Account', kyc.account_number],
  ];

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      {head}
      <InsightBand mascot="orange" compact className="sm:py-6" eyebrow={c.eyebrow}
        title={<>{c.title[0]} <em className={serif}>{c.title[1]}</em></>} sub={c.sub}
        actions={(c.action || c.secondary) ? (
          <span className={cn(c.action ? 'hidden lg:contents' : 'contents')}>
            <button type="button" onClick={start}
              className={cn(btnBase, 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink',
                c.action ? 'bg-white text-maroon hover:bg-pink-100' : 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60')}>
              {c.action && <ShieldCheck className="h-4 w-4" strokeWidth={2.4} />}{c.action || c.secondary}
            </button>
          </span>
        ) : null} />

      {status === 'not_started' ? (
        <Panel title="What you'll need" subtitle="Keep your PAN card and bank details handy" flush>
          <ul>{STEPS.map((s, i) => <Row key={s.title} {...s} first={i === 0} />)}</ul>
        </Panel>
      ) : (
        <Panel title="Your details" subtitle="Shown masked. Only the last digits are visible." flush>
          <dl className="mb-0">
            {details.map(([label, value], i) => (
              <div key={label} className={cn('flex min-h-[56px] items-center justify-between gap-4 px-4 py-3 sm:px-5', i > 0 && 'border-t border-neutral-200')}>
                <dt className="text-[14px] text-muted">{label}</dt>
                <dd className={cn('mb-0 min-w-0 truncate text-right text-[14px]', value ? 'font-semibold text-ink' : 'text-faint')}>{value || 'Not added'}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}

      {c.action && (
        <>
          {/* Main action in the thumb zone on a phone. */}
          <PinnedAction label={c.action} onClick={start} />
          <div aria-hidden="true" className="h-16 lg:hidden" />
        </>
      )}
    </div>
  );
}
