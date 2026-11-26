// Help (Kept) — one screen for getting unstuck, reached from the avatar menu, the
// top bar's lifebuoy and More. It lives at /dashboard/chat (founder call,
// 2026-11-26: the chat page becomes Help, the chat opens inside it), and absorbs
// /dashboard/feedback as one option.
//
//  • Desktop: the conversation with Tithi on the left; answers + feedback right.
//  • Phone: a list. "Chat with Tithi" pushes the conversation full screen
//    (?view=chat, so Back closes it); feedback and articles open as sheets.
//
// Tithi is the support lead and is never described as an AI or a bot here.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, MessageSquarePlus, Search } from 'lucide-react';
import SupportChat from '../../components/chat/SupportChat';
import Markdown from '../../components/common/Markdown';
import KeptSheet from '../../components/dashboard/ui/KeptSheet';
import { Panel } from '../../components/dashboard/ui/v2';
import { cn } from '../../components/dashboard/ui/cn';
import useSupportUnread from '../../hooks/useSupportUnread';
import { getHelpDoc, helpGroups } from '../../content/helpDocs';
import { EASE, useIsDesktop } from '../settings/SettingsShell';
import FeedbackSheet, { useMyFeedback } from './FeedbackSheet';

const TITHI_PHOTO = '/images/team/tithi.webp';
// What hosts ask most, first; the rest is reachable through search.
const TOP = ['getting-paid', 'kyc-and-verification', 'availability-and-google-calendar', 'why-am-i-not-getting-bookings', 'plans-and-upgrading'];
const focus = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-rose';

const hostDocs = () => helpGroups().filter((g) => g.category !== 'Guests').flatMap((g) => g.docs);

const ListRow = ({ icon: Icon, title, sub, onClick, to, trailing, last }) => {
  const Tag = to ? Link : 'button';
  return (
    <Tag {...(to ? { to } : { type: 'button', onClick })}
      className={cn('relative flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-pink-50 active:bg-blush', focus)}>
      {Icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-blush text-maroon"><Icon className="h-[18px] w-[18px]" strokeWidth={1.9} /></span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-ink lg:text-[14px]">{title}</span>
        {sub && <span className="block truncate text-[12.5px] text-muted lg:text-[13px]">{sub}</span>}
      </span>
      {trailing}
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-faint" strokeWidth={2} aria-hidden="true" />
      {!last && <span aria-hidden="true" className={cn('absolute bottom-0 right-0 h-px bg-neutral-200/70', Icon ? 'left-[64px]' : 'left-4')} />}
    </Tag>
  );
};

/* Search + top articles. An article opens in a sheet, so the host never leaves. */
const Answers = ({ onOpen }) => {
  const [q, setQ] = useState('');
  const all = useMemo(hostDocs, []);
  const term = q.trim().toLowerCase();
  const shown = term
    ? all.filter((d) => `${d.title} ${d.excerpt}`.toLowerCase().includes(term)).slice(0, 8)
    : TOP.map((s) => all.find((d) => d.slug === s)).filter(Boolean);
  return (
    <Panel title="Quick answers" flush bodyClassName="pb-1">
      <div className="px-4 pb-2 pt-3">
        <label className="mt-input" htmlFor="help-search">
          <Search className="h-[18px] w-[18px] shrink-0 text-faint" strokeWidth={2} aria-hidden="true" />
          <input id="help-search" type="search" inputMode="search" enterKeyHint="search" placeholder="Search help articles"
            value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search help articles" />
        </label>
      </div>
      {shown.length ? (
        <ul className="mb-0 list-none p-0">
          {shown.map((d, i) => (
            <li key={d.slug}><ListRow title={d.title} sub={d.excerpt} onClick={() => onOpen(d.slug)} last={i === shown.length - 1} /></li>
          ))}
        </ul>
      ) : (
        <p className="mb-0 px-4 pb-4 pt-1 text-[13.5px] text-muted">No article matches &ldquo;{q.trim()}&rdquo;. Ask Tithi instead; she&apos;ll know.</p>
      )}
      <a href="/help/docs" target="_blank" rel="noreferrer"
        className={cn('flex min-h-[48px] items-center gap-2 border-t border-neutral-200/70 px-4 text-[13.5px] font-semibold text-maroon hover:bg-pink-50', focus)}>
        Browse every article <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      </a>
    </Panel>
  );
};

const FeedbackCard = ({ onOpen, feedback }) => {
  const n = feedback.items.length;
  return (
    <Panel flush>
      <ul className="mb-0 list-none p-0">
        <li><ListRow icon={MessageSquarePlus} title="Send feedback" sub="Ideas, bugs, praise. We read every one." onClick={onOpen}
          last={!n} /></li>
        {n > 0 && (
          <li><ListRow icon={BookOpen} title="What you've sent" onClick={onOpen} last
            sub={`${n} message${n > 1 ? 's' : ''}${feedback.items.some((f) => f.admin_response) ? ', with replies' : ''}`} /></li>
        )}
      </ul>
    </Panel>
  );
};

const TithiCard = ({ onOpen, unread }) => (
  <button type="button" onClick={onOpen}
    className={cn('flex w-full items-center gap-3.5 rounded-[24px] bg-white p-4 text-left transition-colors hover:bg-pink-50 active:bg-blush', focus)}>
    <span className="relative shrink-0">
      <img src={TITHI_PHOTO} alt="" className="h-14 w-14 rounded-full object-cover" />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-rose ring-2 ring-white" aria-hidden="true" />}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate font-display text-[18px] font-bold tracking-[-0.02em] text-ink">Chat with Tithi</span>
      <span className="block truncate text-[13px] text-muted">{unread > 0 ? `${unread} new repl${unread > 1 ? 'ies' : 'y'} waiting` : 'Bookings, payouts, your page: ask anything'}</span>
    </span>
    <ChevronRight className="h-5 w-5 shrink-0 text-faint" strokeWidth={2} aria-hidden="true" />
  </button>
);

export default function HelpHub() {
  const desktop = useIsDesktop();
  const reduce = useReducedMotion();
  const unread = useSupportUnread();
  const [params, setParams] = useSearchParams();
  const feedback = useMyFeedback();
  const view = params.get('view');
  const feedbackOpen = params.get('feedback') === '1';
  const docSlug = params.get('doc');
  const doc = docSlug ? getHelpDoc(docSlug) : null;

  // The pushed chat covers the page: keep the page behind it from scrolling.
  useEffect(() => {
    if (desktop || view !== 'chat') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [desktop, view]);

  // URL state, so the phone's Back button closes what it opened.
  const set = (key, value) => setParams((p) => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); return n; }, { replace: !value });

  const sheets = (
    <>
      <FeedbackSheet open={feedbackOpen} onClose={() => set('feedback')} feedback={feedback} />
      <KeptSheet open={!!doc} onClose={() => set('doc')} title={doc?.title || ''}
        footer={(
          <button type="button" onClick={() => { set('doc'); set('view', 'chat'); }}
            className="min-h-[44px] w-full rounded-[12px] bg-cream text-[14px] font-semibold text-maroon transition-colors hover:bg-blush">
            Still stuck? Chat with Tithi
          </button>
        )}>
        {doc && <div className="prose-help text-[14.5px] leading-relaxed text-ink [&_a]:font-semibold [&_a]:text-maroon [&_h1]:hidden [&_h2]:mt-5 [&_h2]:font-display [&_h2]:text-[17px] [&_li]:my-1 [&_p]:my-2.5"><Markdown source={doc.body} /></div>}
      </KeptSheet>
    </>
  );

  if (desktop) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="mb-0 font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon">Help</h1>
          <p className="mb-0 mt-1.5 text-[15px] text-muted">Talk to Tithi, find an answer, or tell us what to fix.</p>
        </header>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(300px,360px)] items-start gap-6">
          <SupportChat frame="flex h-[calc(100dvh-210px)] min-h-[520px] flex-col overflow-hidden rounded-[24px] bg-white" />
          <div className="flex flex-col gap-4">
            <Answers onOpen={(s) => set('doc', s)} />
            <FeedbackCard onOpen={() => set('feedback', '1')} feedback={feedback} />
          </div>
        </div>
        {sheets}
      </div>
    );
  }

  if (view === 'chat') {
    // Pushed full-screen conversation, pinned between the top bar and the tab bar
    // so the composer is always above the tab bar, whatever sits above the page.
    // The bottom padding clears KeptTabBar's raised Grow button (28px above the bar).
    // Portaled: PullToRefresh's transform would otherwise trap position:fixed.
    return createPortal(
      <motion.div initial={reduce ? false : { x: 28, opacity: 0.6 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.22, ease: EASE }}
        className="dash fixed inset-x-0 bottom-[calc(77px+env(safe-area-inset-bottom,0px))] top-[calc(56px+env(safe-area-inset-top,0px))] z-30 flex flex-col gap-1 bg-cream px-4 pb-8">
        <button type="button" onClick={() => set('view')}
          className={cn('-ml-2 inline-flex min-h-[44px] w-fit shrink-0 items-center gap-0.5 rounded-[12px] pl-1 pr-3 text-[15px] font-semibold text-maroon active:bg-blush', focus)}>
          <ChevronLeft className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" /> Help
        </button>
        <SupportChat frame="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-white" />
      </motion.div>,
      document.body,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="mb-1">
        <h1 className="mb-0 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon">Help</h1>
        <p className="mb-0 mt-1.5 text-[14px] text-muted">Talk to Tithi, find an answer, or tell us what to fix.</p>
      </header>
      <TithiCard onOpen={() => set('view', 'chat')} unread={unread} />
      <Answers onOpen={(s) => set('doc', s)} />
      <FeedbackCard onOpen={() => set('feedback', '1')} feedback={feedback} />
      {sheets}
    </div>
  );
}
