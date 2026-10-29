import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { streamBot, sendBotFeedback, botEscalateSendOtp, botEscalateVerifyOtp, botEscalateRating } from '../../services/api';
import Markdown from './Markdown';

// Persisted across reloads: a stable anonymous visitor id (so support can recognise
// repeat visitors) and the current conversation id (so a refresh keeps the thread).
const VISITOR_KEY = 'bas_bot_visitor';
const CONVO_KEY = 'bas_bot_convo';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };
function getVisitorId() {
  let v = lsGet(VISITOR_KEY);
  if (!v) { v = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`); lsSet(VISITOR_KEY, v); }
  return v;
}

// Bolt only shows on these pages (home, help/support, privacy/policy, terms).
const isAllowedPath = (p) =>
  p === '/' || p === '/privacy' || p === '/terms' || p === '/help' || p.startsWith('/help/');

// Bolt — Meeticulous's floating support assistant. Mounted app-wide (App.jsx).
// Blended look: reference-widget layout + polish, on Meeticulous's brand (orange
// #2E1065 + ink #191919, Plus Jakarta headings / Poppins body, medium borders).
// The answer STREAMS in over SSE and renders through <Markdown>, so the model's
// **bold**/links render as formatting — raw HTML tags are never shown.

const PRIMARY = '#2E1065';
const INK = '#191919';

// Post-handoff satisfaction scale — 1..5, coloured worst→best. Click = auto-submit.
const FEEDBACK = [
  { n: 1, e: '😠', c: '#ef4444' },
  { n: 2, e: '😕', c: '#f97316' },
  { n: 3, e: '😐', c: '#eab308' },
  { n: 4, e: '🙂', c: '#84cc16' },
  { n: 5, e: '🤩', c: '#22c55e' },
];

// Brand icons cycled on the closed launcher — booking/host/support motifs.
const LAUNCHER_ICONS = [
  <path key="cal" d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />,
  <path key="clock" d="M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />,
  <path key="chat" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />,
  <path key="bolt" d="M13 2 3 14h8l-1 8 10-12h-8Z" />,
  <path key="spark" d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M18 18l-3-3M18 6l-3 3M6 18l3-3" />,
];

// Starter prompts on the welcome screen — one tap sends the question.
const SUGGESTIONS = [
  'How do I book a service?',
  'Payments & refunds',
  'Plans & pricing',
  'Become a host',
  'Reschedule or cancel',
  'Calendar sync',
];

const sourceLabel = (s) => {
  const file = (s.source_file || '').replace(/^docs\/(help\/)?/, '').replace(/\.md$/, '').replace(/-/g, ' ');
  return s.heading ? `${s.heading}` : file;
};

// A cited KB doc maps 1:1 to its public help article: docs/help/<slug>.md → /help/docs/<slug>
// (same slug convention as client/src/content/helpDocs.js). So the citation renders as a
// real link the guest can open, not a dead label. Section anchors aren't supported yet —
// Markdown.jsx emits no heading ids — so we link the page, not the #heading.
const sourceHref = (s) => {
  const slug = (s.source_file || '').split('/').pop().replace(/\.md$/, '').trim();
  return slug ? `/help/docs/${slug}` : null;
};

// Should a wheel gesture over the chat be swallowed (preventDefault) so the page
// behind doesn't scroll? Only when the list can't consume it: not scrollable at all
// (short conversation) or already at the boundary in the scroll direction. When the
// list can scroll mid-content, we return false and let native scrolling run untouched.
// Exported for unit test.
export const shouldSwallowScroll = (deltaY, { scrollTop, scrollHeight, clientHeight }) => {
  const canScroll = scrollHeight > clientHeight;
  const atTop = scrollTop <= 0;
  const atBottom = scrollHeight - scrollTop - clientHeight <= 0;
  return !canScroll || (deltaY < 0 && atTop) || (deltaY > 0 && atBottom);
};

// Apply fn to the last assistant message (the one currently streaming).
const patchLastAssistant = (msgs, fn) => {
  let idx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'assistant') { idx = i; break; }
  if (idx === -1) return msgs;
  return msgs.map((m, i) => (i === idx ? fn(m) : m));
};

function Avatar({ size = 28, ring = false }) {
  return (
    <span
      className="grid place-items-center overflow-hidden rounded-lg bg-white"
      style={{ width: size, height: size, border: ring ? `2px solid ${INK}` : 'none' }}
    >
      <img src="/favicon.svg" alt="" className="h-full w-full object-contain p-0.5" />
    </span>
  );
}

export default function BotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState(() => lsGet(CONVO_KEY) || null);
  const [messages, setMessages] = useState([]); // empty → welcome screen
  const [iconIdx, setIconIdx] = useState(0);
  // Active human-handoff. null = none. { step, reason, question, channel, contact,
  // otp, busy, error, reference }. step: 'choose'|'form'|'otp'|'done'.
  const [escalation, setEscalation] = useState(null);
  const [visitorId] = useState(getVisitorId);
  const listRef = useRef(null);
  const panelRef = useRef(null);
  const { pathname } = useLocation();

  // Auto-stick to the newest message, but ONLY when the user is already near the
  // bottom. Streaming mutates `messages` every token; an unconditional re-pin here
  // yanks the list back down on each delta, making it impossible to scroll up and
  // re-read while Bolt is answering. Track "was near bottom" before React repaints.
  const stickRef = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, open, escalation]);

  const onListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  // Stop the page behind from scrolling when the wheel gesture is over the chat but
  // the list can't take it — short conversations (list not scrollable) or at a scroll
  // boundary. `overscroll-contain` alone only covers an *overflowing* list, so a short
  // chat still leaked scroll to the page. Native listener with passive:false because
  // React attaches onWheel as passive (preventDefault would be a no-op there).
  useEffect(() => {
    const panel = panelRef.current;
    const list = listRef.current;
    if (!open || !panel || !list) return;
    const onWheel = (e) => { if (shouldSwallowScroll(e.deltaY, list)) e.preventDefault(); };
    panel.addEventListener('wheel', onWheel, { passive: false });
    // ponytail: wheel-only. Touch chaining on an *overflowing* list is covered by
    // `overscroll-contain`; a short list on touch can still leak — add a touchmove
    // handler (track startY) if mobile users report it.
    return () => panel.removeEventListener('wheel', onWheel);
  }, [open]);

  // Cycle the launcher's brand icons while the chat is closed.
  useEffect(() => {
    if (open) return;
    const id = setInterval(() => setIconIdx((i) => (i + 1) % LAUNCHER_ICONS.length), 1200);
    return () => clearInterval(id);
  }, [open]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    // Cool-off / IP lockout from the abuse gate freezes the composer for this convo.
    if (messages[messages.length - 1]?.locked) return;
    if (!question || streaming) return;
    setInput('');
    setMessages((m) => [
      ...m,
      { role: 'user', content: question },
      { role: 'assistant', content: '', streaming: true, cited_sources: [], followups: [], escalate: false, messageId: null, feedback: null },
    ]);
    setStreaming(true);
    await streamBot(
      { question, conversationId, visitorId, pageUrl: window.location.href },
      {
        onDelta: (t) => setMessages((m) => patchLastAssistant(m, (a) => ({ ...a, content: a.content + t }))),
        onDone: (d) => {
          if (d.conversationId) { setConversationId(d.conversationId); lsSet(CONVO_KEY, d.conversationId); }
          setMessages((m) => patchLastAssistant(m, (a) => ({
            ...a, streaming: false, cited_sources: d.cited_sources || [], followups: d.followups || [],
            escalate: !!d.escalate, messageId: d.messageId || null,
            pills: Array.isArray(d.pills) ? d.pills : [], locked: !!d.locked,
          })));
          // Escalation handoff. Logged-in users are escalated server-side already
          // (reference returned) → show the confirmation. Anonymous visitors must
          // first choose a verified contact channel.
          if (d.escalate && d.reference) {
            setEscalation({ step: 'done', reference: d.reference, escalationId: d.escalationId || null, channel: d.channel || null, contact: d.contact || null });
          } else if (d.escalate && d.needsContact) {
            setEscalation({ step: 'choose', reason: d.escalateReason || 'model_unsure', question, conversationId: d.conversationId || conversationId });
          }
        },
        onError: () => setMessages((m) => patchLastAssistant(m, (a) => ({
          ...a, streaming: false, escalate: true,
          content: a.content || "Something went wrong reaching support just now. Email bolt@meeticulous.in and a human will jump in.",
        }))),
      },
    );
    setStreaming(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const restart = () => { setMessages([]); setConversationId(null); setInput(''); setEscalation(null); lsDel(CONVO_KEY); };

  // Let other surfaces open Bolt (e.g. the Help page's "Chat with Bolt" card).
  useEffect(() => {
    const openBolt = () => setOpen(true);
    window.addEventListener('bolt:open', openBolt);
    return () => window.removeEventListener('bolt:open', openBolt);
  }, []);

  // Manual "talk to a human" — routes into the same contact-capture flow the model
  // triggers, instead of a dead link. Uses the last question for context.
  const startHandoff = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    setEscalation({ step: 'choose', reason: 'manual', question: lastUser?.content || 'Manual support request', conversationId });
    setOpen(true);
  };

  // ---- Anonymous escalation contact flow --------------------------------
  const chooseChannel = (channel) => {
    if (channel === 'browsing') { setEscalation(null); return; } // "just browsing" → keep chatting, no escalation
    setEscalation((e) => ({ ...e, channel, step: 'form', contact: '', otp: '', error: '', busy: false }));
  };
  const patchEsc = (patch) => setEscalation((e) => (e ? { ...e, ...patch } : e));

  const sendContactOtp = async () => {
    const e = escalation;
    if (!e?.contact?.trim() || e.busy) return;
    patchEsc({ busy: true, error: '' });
    try {
      await botEscalateSendOtp({ channel: e.channel, contact: e.contact.trim(), conversationId: e.conversationId });
      patchEsc({ step: 'otp', busy: false, otp: '' });
    } catch (err) {
      patchEsc({ busy: false, error: err?.response?.data?.message || "Couldn't send the code. Try again." });
    }
  };

  const verifyContactOtp = async () => {
    const e = escalation;
    if (!/^\d{6}$/.test(String(e?.otp || '')) || e.busy) return;
    patchEsc({ busy: true, error: '' });
    try {
      const { data } = await botEscalateVerifyOtp({
        channel: e.channel, contact: e.contact.trim(), otp: e.otp, conversationId: e.conversationId,
        visitorId, pageUrl: window.location.href, reason: e.reason, question: e.question,
      });
      patchEsc({ step: 'done', busy: false, reference: data?.reference || null, escalationId: data?.escalationId || null });
    } catch (err) {
      patchEsc({ busy: false, error: err?.response?.data?.message || 'Incorrect code. Try again.' });
    }
  };

  // Satisfaction rating — one click auto-submits, then we offer ticket tracking.
  const rateEscalation = async (n) => {
    if (escalation?.ratingBusy || escalation?.rated) return;
    patchEsc({ ratingBusy: true });
    try { if (escalation.escalationId) await botEscalateRating({ escalationId: escalation.escalationId, rating: n }); }
    catch (_) { /* non-fatal — still advance the UI */ }
    patchEsc({ rated: n, ratingBusy: false });
  };

  const rate = async (idx, value) => {
    const msg = messages[idx];
    if (!msg?.messageId || msg.feedback) return;
    setMessages((m) => m.map((x, i) => (i === idx ? { ...x, feedback: value } : x)));
    try { await sendBotFeedback({ messageId: msg.messageId, feedback: value }); } catch (_) { /* non-fatal */ }
  };

  const copy = (content) => { try { navigator.clipboard?.writeText(content); } catch (_) { /* ignore */ } };

  // Composer freezes when the last turn locked the conversation (5-strike cool-off
  // or threat IP lockout from the abuse gate). Refresh/restart clears it.
  const locked = messages.length > 0 && !!messages[messages.length - 1]?.locked;

  if (!isAllowedPath(pathname)) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] font-sans">
      {/* ponytail: approximated genie (scale+translate from launcher corner), not a real mesh warp */}
      {/* ponytail: clean emerge from launcher corner — mild scale + slight stretch, no extreme pinch (pixel-faithful genie smears live DOM). */}
      <style>{`@keyframes boltGenie{0%{opacity:0;transform:translateY(28px) scale(.82) scaleY(.9)}60%{opacity:1}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes boltIconIn{0%{opacity:0;transform:scale(.5) rotate(-12deg)}100%{opacity:1;transform:scale(1) rotate(0)}}`}</style>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Bolt support chat"
          // Lenis smooth-scroll hijacks wheel at the window level and preventDefaults it,
          // which ate the chat's native scroll. data-lenis-prevent exempts this whole
          // subtree so the messages list scrolls normally (our own wheel handler +
          // overscroll-contain still stop page chaining at the boundaries).
          data-lenis-prevent=""
          className="mb-3 flex h-[34rem] w-[23rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          style={{ border: `2px solid ${INK}`, transformOrigin: 'bottom right', animation: 'boltGenie .3s cubic-bezier(.2,.8,.3,1) both' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-3.5 py-3 text-white" style={{ background: PRIMARY, borderBottom: `2px solid ${INK}` }}>
            <div className="relative">
              <Avatar size={30} ring />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#22c55e]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading text-sm font-extrabold leading-tight">Bolt 958</h3>
              <p className="text-[11px] leading-tight text-white/90">Fastest Support Bot Alive · Running</p>
            </div>
            <button
              type="button" onClick={restart} aria-label="Restart chat" title="Restart"
              className="grid h-7 w-7 place-items-center rounded-lg text-white/90 hover:bg-white/15"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
            </button>
            <button
              type="button" onClick={() => setOpen(false)} aria-label="Close support chat" title="Close"
              className="grid h-7 w-7 place-items-center rounded-lg text-white/90 hover:bg-white/15"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          {/* Messages / Welcome */}
          <div ref={listRef} onScroll={onListScroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#F8FAFC] px-3.5 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-2 text-center">
                <Avatar size={52} ring />
                <h2 className="mt-3 font-heading text-lg font-extrabold" style={{ color: INK }}>Hey, I'm Bolt 👋</h2>
                <p className="mt-1 max-w-[16rem] text-[13px] text-ink/70">
                  Ask me about bookings, payments, plans, or hosting. If I can't crack it, I'll grab a human.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s} type="button" onClick={() => send(s)}
                      className="rounded-md border border-primary/70 bg-transparent px-2 py-px text-[10px] font-medium text-primary transition-colors hover:bg-primary-light hover:border-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={'max-w-[86%] ' + (m.role === 'user' ? '' : 'w-full')}>
                    <div
                      className={
                        'rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed ' +
                        (m.role === 'user'
                          ? 'text-white'
                          : 'border-2 border-ink/10 bg-white text-ink shadow-sm')
                      }
                      style={m.role === 'user' ? { background: PRIMARY } : undefined}
                    >
                      {m.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : m.content ? (
                        <div className="bolt-md [&>div]:text-[12px]"><Markdown source={m.content} externalLinks="strip" /></div>
                      ) : (
                        <div className="flex gap-1 py-1" aria-label="Bolt is typing">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40 [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40 [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40 [animation-delay:300ms]" />
                        </div>
                      )}

                      {/* One inline closing suggestion instead of a row of chips: link the
                          single most-relevant help page (when we can derive its slug) and
                          always offer a human handoff. Deterministic — built from the top
                          cited source, so no hallucinated links. */}
                      {m.role === 'assistant' && !m.escalate && !m.streaming && m.content && (() => {
                        const top = (m.cited_sources || []).find((s) => sourceHref(s));
                        const href = top && sourceHref(top);
                        return (
                          <div className="mt-2.5 border-t border-dashed border-ink/15 pt-2 text-[11px] leading-snug text-ink/60">
                            {href ? <>Want the full details? Read{' '}
                              <a href={href} target="_blank" rel="noopener noreferrer"
                                className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:text-primary/80">
                                {sourceLabel(top)}
                              </a>{' or '}</> : <>Still stuck? </>}
                            <button type="button" onClick={startHandoff}
                              className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:text-primary/80">
                              talk to a human
                            </button>.
                          </div>
                        );
                      })()}
                    </div>

                    {/* The escalation handoff (contact choice / confirmation) renders once
                        below the whole thread — see the escalation panel after the list. */}

                    {/* Actions */}
                    {m.role === 'assistant' && !m.streaming && m.content && (
                      <div className="mt-1.5 flex items-center gap-1.5 pl-1">
                        <button type="button" onClick={() => copy(m.content)} aria-label="Copy" title="Copy"
                          className="grid h-6 w-6 place-items-center rounded-md text-ink/40 hover:bg-ink/5 hover:text-ink/70">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        </button>
                        {m.messageId && (
                          <>
                            <button type="button" disabled={!!m.feedback} onClick={() => rate(i, 'up')} aria-label="Helpful" title="Helpful"
                              className={'grid h-6 w-6 place-items-center rounded-md ' + (m.feedback === 'up' ? 'text-[#22c55e]' : 'text-ink/40 hover:bg-ink/5 hover:text-ink/70')}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill={m.feedback === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>
                            </button>
                            <button type="button" disabled={!!m.feedback} onClick={() => rate(i, 'down')} aria-label="Not helpful" title="Not helpful"
                              className={'grid h-6 w-6 place-items-center rounded-md ' + (m.feedback === 'down' ? 'text-[#ef4444]' : 'text-ink/40 hover:bg-ink/5 hover:text-ink/70')}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill={m.feedback === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" /></svg>
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Context pills — short next actions. 'route' navigates, 'send' asks it. */}
                    {m.role === 'assistant' && !m.streaming && Array.isArray(m.pills) && m.pills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
                        {m.pills.map((p, pi) => (
                          p.action?.type === 'route' ? (
                            <a key={pi} href={p.action.value}
                              className="rounded-md border border-primary/70 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary-light">
                              {p.label}
                            </a>
                          ) : (
                            <button key={pi} type="button" disabled={streaming} onClick={() => send(p.action?.value || p.label)}
                              className="rounded-md border border-primary/70 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary-light disabled:opacity-50">
                              {p.label}
                            </button>
                          )
                        ))}
                      </div>
                    )}

                  </div>
                </div>
              ))
            )}

            {/* Human handoff — contact choice → OTP verify → confirmation. Shown once,
                below the thread. Anonymous visitors pick a channel; logged-in users
                land straight on the confirmation (escalated server-side already). */}
            {escalation && (
              <div className="rounded-xl border-2 border-ink/10 bg-white p-3 shadow-sm">
                {escalation.step === 'done' ? (
                  <div>
                    <div className="flex items-start gap-2.5">
                      <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-[#DCFCE7] text-base">✅</span>
                      <div className="text-[12px] leading-relaxed text-ink/80">
                        <strong className="text-ink">Support Request Sent</strong><br />
                        {escalation.channel === 'whatsapp' || escalation.channel === 'email' ? (
                          <>We'll contact you on {escalation.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}{escalation.contact ? <> at <span className="font-semibold text-ink">{escalation.contact}</span></> : ''}.</>
                        ) : (
                          "We'll contact you via WhatsApp or Email."
                        )}
                        {escalation.reference && (
                          <><br />Reference: <span className="font-mono font-semibold text-ink">{escalation.reference}</span></>
                        )}
                      </div>
                    </div>

                    {!escalation.rated ? (
                      <div className="mt-3 border-t border-ink/10 pt-2.5">
                        <p className="mb-1.5 text-[12px] text-ink/70">How was your experience?</p>
                        <div className="flex justify-between gap-1">
                          {FEEDBACK.map((f) => (
                            <button key={f.n} type="button" onClick={() => rateEscalation(f.n)} disabled={escalation.ratingBusy}
                              aria-label={`Rate ${f.n} of 5`} title={`${f.n}/5`}
                              className="grid h-9 w-9 place-items-center rounded-full border-2 text-lg transition-transform hover:scale-110 disabled:opacity-50"
                              style={{ borderColor: f.c, background: `${f.c}14` }}>
                              {f.e}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 border-t border-ink/10 pt-2.5">
                        <p className="text-[12px] text-ink/80">
                          Thanks for the feedback! Our team will reply
                          {escalation.channel === 'whatsapp' ? ' on WhatsApp' : escalation.channel === 'email' ? ' by email' : ' soon'}
                          {escalation.reference ? <> — your reference is <span className="font-semibold">{escalation.reference}</span></> : ''}.
                        </p>
                      </div>
                    )}
                  </div>
                ) : escalation.step === 'choose' ? (
                  <div>
                    <p className="mb-2 text-[12px] leading-snug text-ink/80">
                      Before I send this to our support team, how would you like us to contact you?
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <button type="button" onClick={() => chooseChannel('whatsapp')}
                        className="rounded-lg border-2 border-primary/70 px-3 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary-light">
                        Continue with WhatsApp
                      </button>
                      <button type="button" onClick={() => chooseChannel('email')}
                        className="rounded-lg border-2 border-primary/70 px-3 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary-light">
                        Continue with Email
                      </button>
                      <button type="button" onClick={() => chooseChannel('browsing')}
                        className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink/50 transition-colors hover:bg-ink/5">
                        I'm just browsing
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="mb-1.5 text-[12px] font-semibold text-ink">
                      {escalation.channel === 'whatsapp' ? 'Your WhatsApp number' : 'Your email'}
                    </p>
                    {escalation.step === 'form' ? (
                      <div className="flex gap-1.5">
                        <input
                          value={escalation.contact || ''}
                          onChange={(e) => patchEsc({ contact: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendContactOtp(); } }}
                          type={escalation.channel === 'email' ? 'email' : 'tel'}
                          inputMode={escalation.channel === 'email' ? 'email' : 'tel'}
                          placeholder={escalation.channel === 'whatsapp' ? '9876543210' : 'you@email.com'}
                          className="min-w-0 flex-1 rounded-lg border-2 border-ink/12 px-2.5 py-1.5 text-[12px] outline-none focus:!border-primary"
                        />
                        <button type="button" onClick={sendContactOtp} disabled={escalation.busy || !(escalation.contact || '').trim()}
                          className="flex-shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:bg-ink/15 disabled:text-ink/40">
                          {escalation.busy ? '…' : 'Send code'}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-1.5 text-[11px] text-ink/60">Enter the 6-digit code sent to {escalation.contact}.</p>
                        <div className="flex gap-1.5">
                          <input
                            value={escalation.otp || ''}
                            onChange={(e) => patchEsc({ otp: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); verifyContactOtp(); } }}
                            inputMode="numeric" placeholder="123456"
                            className="min-w-0 flex-1 rounded-lg border-2 border-ink/12 px-2.5 py-1.5 text-[12px] tracking-widest outline-none focus:!border-primary"
                          />
                          <button type="button" onClick={verifyContactOtp} disabled={escalation.busy || !/^\d{6}$/.test(escalation.otp || '')}
                            className="flex-shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:bg-ink/15 disabled:text-ink/40">
                            {escalation.busy ? '…' : 'Verify'}
                          </button>
                        </div>
                        <button type="button" onClick={sendContactOtp} disabled={escalation.busy}
                          className="mt-1 text-[10px] font-medium text-primary hover:underline disabled:opacity-50">
                          Resend code
                        </button>
                      </div>
                    )}
                    {escalation.error && <p className="mt-1 text-[10px] text-[#ef4444]">{escalation.error}</p>}
                    <button type="button" onClick={() => chooseChannel('browsing')}
                      className="mt-1.5 text-[10px] font-medium text-ink/40 hover:text-ink/70">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="flex items-end gap-2 bg-white px-3 py-2.5" style={{ borderTop: `2px solid ${INK}` }}>
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={locked}
              placeholder={locked ? 'Chat paused — email bolt@meeticulous.in' : 'Ask anything…'}
              aria-label="Type your question"
              className="h-10 min-h-10 max-h-24 flex-1 resize-none rounded-xl border-2 border-ink/12 px-3 pt-[11px] pb-[5px] text-[13px] leading-tight outline-none focus:!border-primary focus:!shadow-none focus:!ring-0 focus:!outline-none disabled:cursor-not-allowed disabled:bg-ink/5"
            />
            <button
              type="button" onClick={() => send()} disabled={locked || streaming || !input.trim()} aria-label="Send"
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink/40"
              style={!streaming && input.trim() ? { background: PRIMARY } : undefined}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close support chat' : 'Open Bolt support chat'}
        className="ml-auto grid h-14 w-14 place-items-center rounded-full bg-white transition-transform hover:scale-105 active:scale-95"
        style={{ border: `1.5px solid ${PRIMARY}`, color: PRIMARY }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        ) : (
          <svg key={iconIdx} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'boltIconIn .4s ease' }}>
            {LAUNCHER_ICONS[iconIdx]}
          </svg>
        )}
      </button>
    </div>
  );
}
