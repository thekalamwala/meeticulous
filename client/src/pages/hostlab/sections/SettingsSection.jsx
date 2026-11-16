// Settings — account, plan, verification, notifications, help.
//
// Today the rail's Settings section mixes genuine settings (Account, Plan,
// Verification) with two things that are not settings at all: Refer & Earn
// (a growth tool) and Help & support. Refer moves to Grow; Help stays here but
// also gets a permanent button in the topbar, because a host looking for help
// should not have to guess which section it lives under.
//
// "Where things moved" is a real tab, not a footnote: it is the preservation
// checklist, rendered from the same table the shell routes from, so it cannot
// drift from the code.
import { useState } from 'react';
import {
  ArrowRight, Bell, CheckCircle2, CreditCard, HelpCircle, Mail, MessageSquare,
  Phone, Route, ShieldCheck, Smartphone, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Tabs, cn } from '../../../components/dashboard/ui';
import { Avatar, Field, LabInput, LabSelect, LabTextarea, Panel, StatusPill, Toggle, inr, useUrlTab } from '../labUi';
import { LIVE_PAGE_MAP } from '../pageMap';
import mock from '../mockData';

/* ── Account ───────────────────────────────────────────────────────────── */
const Account = () => {
  const [form, setForm] = useState({
    name: mock.host.name,
    username: mock.host.username,
    profession: mock.host.profession,
    city: mock.host.city,
    bio: 'Clinical nutritionist in Pune. I work with people who have tried every plan and want one that fits the way they actually eat.',
  });
  const [dirty, setDirty] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setDirty(true); };

  return (
    <div className="flex flex-col gap-3">
      <Panel title="You" subtitle="This is what guests see on your booking page">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={form.name} size="h-16 w-16 text-[16px]" />
            <div>
              <Button size="sm" variant="outline" onClick={() => toast.success('Opens the photo picker')}>Change photo</Button>
              <p className="mt-1.5 text-[11px] font-medium text-ink/45">Square, at least 400×400.</p>
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Name"><LabInput value={form.name} onChange={set('name')} /></Field>
            <Field label="Your link" hint="Changing this breaks links you have already shared.">
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-[11.5px] font-medium text-ink/45">meeticulous.com/</span>
                <LabInput value={form.username} onChange={set('username')} />
              </div>
            </Field>
            <Field label="What you do">
              <LabSelect value={form.profession} onChange={set('profession')}>
                {['Nutritionist', 'Life coach', 'Physiotherapist', 'Dentist', 'Lawyer', 'Astrologer'].map((p) => <option key={p}>{p}</option>)}
              </LabSelect>
            </Field>
            <Field label="City"><LabInput value={form.city} onChange={set('city')} /></Field>
          </div>
          <Field label="About you" hint="Two or three sentences. Say who you help and how.">
            <LabTextarea rows={4} value={form.bio} onChange={set('bio')} />
          </Field>
          {dirty && (
            <div className="flex items-center gap-2.5 rounded-lg bg-marigold-100 px-3 py-2">
              <span className="text-[11.5px] font-bold text-marigold-800">Unsaved changes</span>
              <Button size="sm" className="ml-auto" onClick={() => { toast.success('Profile saved'); setDirty(false); }}>Save</Button>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="How you sign in" subtitle="Hosts sign in with Google or LinkedIn — never a password">
        <ul className="flex flex-col gap-2">
          {[
            ['Google', 'ananya@gmail.com', true],
            ['LinkedIn', null, false],
          ].map(([name, acct, on]) => (
            <li key={name} className="flex items-center gap-2.5 rounded-lg border-2 border-neutral-200 p-2.5">
              <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', on ? 'bg-success-bg text-success-fg' : 'bg-neutral-100 text-ink/45')}>
                <User className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-bold text-ink">{name}</span>
                <span className="block text-[11.5px] font-medium text-ink/55">{acct || 'Not connected'}</span>
              </span>
              {on ? <StatusPill status="active">Connected</StatusPill> : <Button size="sm" variant="outline" onClick={() => toast.success(`Connect ${name}`)}>Connect</Button>}
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[11px] font-medium text-ink/50">
          Your guest side is the same account. Signing in by WhatsApp OTP at /login lands you in your guest space — one identity, two doors.
        </p>
      </Panel>
    </div>
  );
};

/* ── Plan ──────────────────────────────────────────────────────────────── */
const Plan = () => {
  const thisM = mock.revenueByMonth.at(-1);
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Your plan">
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border-2 border-maroon bg-maroon-50 p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-maroon text-white">
            <CreditCard className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[14px] font-bold text-maroon">Pro</p>
            <p className="text-[11.5px] font-medium text-ink/60">₹999 a month · 0% commission · renews 12 Dec</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toast.success('Opens the plan comparison')}>Compare plans</Button>
            <Button size="sm" variant="ghost" onClick={() => toast.success('Opens the cancellation flow')}>Cancel</Button>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-2 text-[12px]">
          {[
            ['Commission avoided this month', inr(Math.round(thisM.revenue * 0.05))],
            ['What Pro cost you', inr(999)],
            ['Net benefit', inr(Math.round(thisM.revenue * 0.05) - 999)],
          ].map(([k, v], i) => (
            <li key={k} className={cn('flex items-baseline justify-between gap-2.5', i === 2 && 'border-t-2 border-neutral-200 pt-2')}>
              <span className={cn(i === 2 ? 'font-bold text-ink' : 'font-medium text-ink/65')}>{k}</span>
              <span className={cn('font-bold tabular-nums', i === 2 ? 'text-success-fg' : 'text-ink')}>{v}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="What Pro unlocks" subtitle="All in use on this account" flush>
        <ul className="divide-y-2 divide-neutral-200">
          {[
            ['0% commission on every booking', true],
            ['The Clients book and win-back lists', true],
            ['Booking limits per day, week and guest', true],
            ['Unlimited testimonials', true],
            ['Conversion insights', true],
          ].map(([label, on]) => (
            <li key={label} className="flex items-center gap-2.5 px-3 py-2">
              <CheckCircle2 className={cn('h-[18px] w-[18px] shrink-0', on ? 'text-success-fg' : 'text-neutral-300')} strokeWidth={2.4} />
              <span className="text-[12px] font-semibold text-ink/80">{label}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
};

/* ── Verification ──────────────────────────────────────────────────────── */
const Verification = () => (
  <Panel title="Verification" subtitle="Required before any money can reach your bank">
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border-2 border-success-fg/30 bg-success-bg p-3">
      <ShieldCheck className="h-6 w-6 shrink-0 text-success-fg" strokeWidth={2.2} />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold text-success-fg">Verified</p>
        <p className="text-[11.5px] font-medium text-ink/60">PAN and bank account confirmed. Payouts are enabled.</p>
      </div>
      <Button size="sm" variant="outline" onClick={() => toast.success('Opens your submitted documents')}>View documents</Button>
    </div>
    <ul className="mt-3 flex flex-col gap-2">
      {[['PAN', 'Verified'], ['Bank account', 'Verified · HDFC ••4471'], ['GSTIN', 'Not provided — optional']].map(([k, v]) => (
        <li key={k} className="flex items-center gap-2.5 rounded-lg border-2 border-neutral-200 px-3 py-2">
          <span className="w-28 shrink-0 text-[10px] font-bold uppercase tracking-wide text-ink/45">{k}</span>
          <span className="text-[12px] font-semibold text-ink/75">{v}</span>
        </li>
      ))}
    </ul>
    <p className="mt-2.5 rounded-lg bg-marigold-100 p-2.5 text-[11.5px] font-medium text-marigold-800">
      Worth stating in the open: not one host is verified in production right now, so no paid booking can settle. The
      verification flow works — the funnel into it is the problem, which is why an unverified host sees this as the first
      card on Today, not as a settings tab they may never open.
    </p>
  </Panel>
);

/* ── Notifications ─────────────────────────────────────────────────────── */
const Notifications = () => {
  const [prefs, setPrefs] = useState({
    booking_email: true, booking_wa: true, booking_push: false,
    reminder_email: true, reminder_wa: true,
    payout_email: true, payout_wa: false,
    marketing_email: false,
  });
  const ROWS = [
    ['A new booking comes in', 'booking'],
    ['Reminder before a session', 'reminder'],
    ['A payout is sent', 'payout'],
  ];
  return (
    <Panel title="Notifications" subtitle="What reaches you, and where" flush>
      <div className="hidden grid-cols-[1fr_repeat(3,72px)] items-center gap-2 border-b-2 border-neutral-200 bg-cream px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-ink/45 sm:grid">
        <span>Event</span>
        <span className="text-center">Email</span>
        <span className="text-center">WhatsApp</span>
        <span className="text-center">Push</span>
      </div>
      <ul className="divide-y-2 divide-neutral-200">
        {ROWS.map(([label, key]) => (
          <li key={key} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_repeat(3,72px)] sm:items-center">
            <span className="text-[12px] font-semibold text-ink/80">{label}</span>
            {['email', 'wa', 'push'].map((ch) => {
              const k = `${key}_${ch}`;
              const exists = k in prefs;
              return (
                <span key={ch} className="flex items-center gap-2 sm:justify-center">
                  <span className="text-[11px] font-bold uppercase text-ink/40 sm:hidden">{ch === 'wa' ? 'WhatsApp' : ch}</span>
                  {exists ? (
                    <Toggle checked={prefs[k]} onChange={(v) => { setPrefs((p) => ({ ...p, [k]: v })); toast.success(v ? 'Turned on' : 'Turned off'); }} label={`${label} by ${ch}`} />
                  ) : (
                    <span className="text-[10px] font-semibold text-ink/25">—</span>
                  )}
                </span>
              );
            })}
          </li>
        ))}
      </ul>
      <div className="border-t-2 border-neutral-200 bg-cream p-3">
        <p className="flex items-start gap-2 text-[11.5px] font-medium text-ink/60">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
          WhatsApp runs through AiSensy. Templates are approved per event, so a channel can be switched on for bookings
          before it is switched on for payouts — which is exactly how production is configured today.
        </p>
      </div>
    </Panel>
  );
};

/* ── Help ──────────────────────────────────────────────────────────────── */
const Help = () => {
  const [msg, setMsg] = useState('');
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Talk to us" subtitle="Tithi answers first, a human picks up when she cannot">
        <Field label="What is going on?">
          <LabTextarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="A guest paid but the booking is not showing…" />
        </Field>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button disabled={!msg.trim()} onClick={() => { toast.success('Sent — Tithi usually replies in under a minute'); setMsg(''); }}>
            <MessageSquare className="h-4 w-4" strokeWidth={2.4} /> Send
          </Button>
          <Button variant="outline" onClick={() => toast.success('Opens your past conversations')}>Past conversations</Button>
        </div>
      </Panel>

      <Panel title="Quick answers" flush>
        <ul className="divide-y-2 divide-neutral-200">
          {[
            'When does my money actually reach my bank?',
            'A guest did not show up. What do I do?',
            'How do I refund someone?',
            'Why can a guest not see a slot I think is open?',
            'How do I change my booking link?',
          ].map((q) => (
            <li key={q}>
              <button type="button" onClick={() => toast.success('Opens the help article')} className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-cream">
                <HelpCircle className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={2.2} />
                <span className="flex-1 text-[12px] font-semibold text-ink/80">{q}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink/30" strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Other ways to reach us">
        <ul className="flex flex-col gap-2 text-[12px]">
          {[
            [Mail, 'team@meeticulous.com', 'Replies within a working day'],
            [Phone, '+91 90000 00000', 'Mon–Sat, 10am–7pm IST'],
            [Bell, 'Send feedback instead', 'For ideas and complaints that are not urgent'],
          ].map(([Icon, title, sub]) => (
            <li key={title} className="flex items-center gap-2.5">
              <Icon className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2.2} />
              <span className="min-w-0">
                <span className="block font-bold text-ink">{title}</span>
                <span className="block text-[11px] font-medium text-ink/50">{sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
};

/* ── Where things moved ────────────────────────────────────────────────── */
const Moved = () => (
  <Panel
    title="Where everything moved"
    subtitle={`All ${LIVE_PAGE_MAP.length} pages of today's dashboard, and where this redesign puts them. Nothing was dropped.`}
    flush
  >
    <ul className="divide-y-2 divide-neutral-200">
      {LIVE_PAGE_MAP.map(([from, to]) => (
        <li key={from} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
          <code className="shrink-0 font-mono text-[11px] font-semibold text-ink/55 sm:w-[260px]">{from}</code>
          <Route className="hidden h-3.5 w-3.5 shrink-0 text-maroon/40 sm:block" strokeWidth={2.4} />
          <span className="text-[12px] font-bold text-ink">{to}</span>
        </li>
      ))}
    </ul>
    <p className="border-t-2 border-neutral-200 bg-cream p-3 text-[11.5px] font-medium text-ink/60">
      The real URLs do not change. This redesign re-groups the navigation; a bookmark to
      {' '}<code className="rounded bg-white px-1 font-mono text-[11px]">/dashboard/payments/payouts</code> keeps working and simply
      lights up Money › Payouts instead of Money's second rail row.
    </p>
  </Panel>
);

/* ── Page ──────────────────────────────────────────────────────────────── */
const SettingsSection = () => {
  const [tab, setTab, TABS] = useUrlTab('settings');

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h1 className="mb-0 font-display text-[19px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[21px]">Settings</h1>
        <p className="mt-0.5 text-[12.5px] font-medium text-ink/55">
          {mock.host.name} · Pro · host since {new Date(mock.host.member_since).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
      </header>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'account' && <Account />}
      {tab === 'plan' && <Plan />}
      {tab === 'verification' && <Verification />}
      {tab === 'notifications' && <Notifications />}
      {tab === 'help' && <Help />}
      {tab === 'moved' && <Moved />}
    </div>
  );
};

export default SettingsSection;
