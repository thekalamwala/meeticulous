import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Clock, Link2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from './ui/cn';

/* Profile-completion panel. Rendered as a floating popover anchored to the
 * toolbar rocket (see OverviewLayout) — it never occupies dashboard layout
 * space. Styling (75% ring, four checklist rows, icons, colours) is unchanged
 * from the original inline panel; only the Hide button was removed. */

const PINK = '#F50069';

const Ring = ({ value = 75 }) => {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-[64px] w-[64px] shrink-0 place-items-center">
      <svg viewBox="0 0 44 44" className="h-[64px] w-[64px] -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#FFE1F1" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={PINK}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <span className="absolute font-heading text-[13px] font-extrabold text-[#17164A]">{value}%</span>
    </div>
  );
};

const ChecklistRow = ({ Icon, title, subtitle, onClick, to }) => {
  const inner = (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FFE1F1] text-[#F50069]">
        <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[12px] font-semibold text-[#17164A]">{title}</span>
        <span className="block truncate text-[10.5px] text-[#71639E]">{subtitle}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#F50069]" strokeWidth={2.2} />
    </>
  );
  const cls = 'flex w-full items-center gap-2.5 rounded-xl border border-[#FFE1F1] bg-white px-2.5 py-2 transition hover:border-[#F50069]/35 hover:bg-[#FFF7FB]';
  return to
    ? <Link to={to} onClick={onClick} className={cls}>{inner}</Link>
    : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
};

const ProfileCompletionPanel = ({ user, onNavigate, className }) => {
  const copyLink = async () => {
    if (!user?.username) {
      toast.error('Set your username first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${user.username}`);
      toast.success('Booking link copied!');
    } catch {
      toast.error('Could not copy your link.');
    }
  };

  return (
    <div className={cn('flex w-full flex-col rounded-[24px] border border-[#FFD8ED] bg-[#FFF7FB] p-4 shadow-[0_20px_44px_-24px_rgba(245,0,105,0.45)]', className)}>
      <div className="flex items-center gap-3">
        <Ring value={75} />
        <div className="min-w-0">
          <h2 className="mb-0 font-heading text-[15px] font-bold leading-tight text-[#17164A]">Complete Your Profile</h2>
          <p className="mt-0.5 text-[11px] text-[#71639E]">Get the most out of Meeticulous</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <ChecklistRow Icon={Users} title="Complete Profile" subtitle="Add your business details" to="/dashboard/profile" onClick={onNavigate} />
        <ChecklistRow Icon={Calendar} title="Add Services" subtitle="List the services you offer" to="/dashboard/services" onClick={onNavigate} />
        <ChecklistRow Icon={Clock} title="Set Availability" subtitle="Choose your available slots" to="/dashboard/availability" onClick={onNavigate} />
        <ChecklistRow Icon={Link2} title="Share Booking Link" subtitle="Let clients book with you" onClick={() => { copyLink(); onNavigate?.(); }} />
      </div>
    </div>
  );
};

export default ProfileCompletionPanel;
