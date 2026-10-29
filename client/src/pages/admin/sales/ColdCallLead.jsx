// Lead page — one lead at a time: call, update the details, log the outcome,
// send the follow-up, move to the next lead. Built to fit above the fold on a
// laptop: compact top bar, the lead + tabs in the centre, outcome on the right.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Card, Btn, Badge, Skeleton } from '../../../components/admin/ui';
import { crmGetLead, crmLeadTimeline, crmColdCallOutcome, crmColdCallRemind, crmColdCallDetails } from '../../../services/api';
import { TabBar, TodayStrip, HEADING } from './ccUi';
import ColdCallCommunicate from './ColdCallCommunicate';
import {
  OUTCOMES, OBJECTIONS, callbackPresets, formatPhone, fmtTimer, isTypingTarget, pendingPlan, nextLeadId,
  messageFor, preferTracked, fitReasons, safeUrl, outcomeLabel, NOTE_CHIPS, addChip, categoryPitch, ago,
} from './coldCallUtils';

const BASE = '/admin/sales/cold-calling';
const NO_FOLLOW_UP = new Set(['not_interested', 'wrong_number']);
const toLocalInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
// Next lead, fetched while you're on the call so Save → next opens instantly. Each
// entry is used once, so revisiting a lead always loads it fresh.
const prefetched = new Map();
const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const SCRIPT = [
  ['Open', '"Namaste, main Shubham, Meeticulous se." Ask for the owner or doctor.'],
  ['Hook', '"Abhi appointments kaise lete hain?" Then listen.'],
  ['Problem', 'Missed calls while working, no-shows, chasing advance payments.'],
  ['Offer', 'Their own booking page: online booking + payment + automatic reminders. Free to start, live in 3 minutes.'],
  ['Ask', '"WhatsApp pe link bhej doon?" Confirm the number and ask for an email.'],
];

const DETAIL_FIELDS = [
  ['business_name', 'Business name'], ['name', 'Contact person'], ['role', 'Role', 'Owner / Manager / Reception'],
  ['email', 'Email', 'Ask on the call'], ['alt_phone', 'Alternate number', 'If they give one'],
  ['website', 'Website'], ['instagram', 'Instagram'], ['hours', 'Business hours', 'e.g. 10 am – 8 pm'],
  ['address', 'Address'],
];
const EXTRAS = new Set(['role', 'alt_phone', 'hours', 'address']);
const detailsOf = (lead) => {
  const cc = lead.attributes?.cold_call || {};
  return Object.fromEntries(DETAIL_FIELDS.map(([k]) => [k, (EXTRAS.has(k) ? cc[k] : lead[k]) || '']));
};

function LeadCall({ initial, plan, queue, reload }) {
  const navigate = useNavigate();
  const [lead, setLead] = useState(initial);
  const cc = lead.attributes?.cold_call || {};
  const [tab, setTab] = useState('details');
  const [form, setForm] = useState(() => detailsOf(initial));
  const [outcome, setOutcome] = useState(null);
  const [objection, setObjection] = useState('');
  const [note, setNote] = useState('');
  const [nextAt, setNextAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null);
  const [comm, setComm] = useState(null);   // { category, callbackAt, savedOutcome, afterSave }
  const saveRef = useRef(null);

  const dirty = useMemo(() => {
    const base = detailsOf(lead);
    return Object.keys(form).some((k) => (form[k] || '') !== (base[k] || ''));
  }, [form, lead]);

  const loadHistory = () => crmLeadTimeline(lead.id).then(({ data }) => setHistory(Array.isArray(data) ? data : [])).catch(() => setHistory([]));
  useEffect(() => { loadHistory(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const idx = plan.findIndex((p) => p.lead.id === lead.id);
  const planItem = plan[idx];
  const pick = (key) => { setOutcome(key); setRunning(false); };   // picking an outcome ends the call timer
  const goTo = (id) => navigate(id ? `${BASE}/lead/${id}` : `${BASE}/today`);
  const goNext = () => goTo(nextLeadId(plan, lead.id));
  const resetCall = () => { setOutcome(null); setNote(''); setObjection(''); setNextAt(null); loadHistory(); };

  const saveDetails = async () => {
    const base = detailsOf(lead);
    const changed = Object.fromEntries(Object.entries(form).filter(([k, v]) => (v || '') !== (base[k] || '')));
    if (!Object.keys(changed).length) return true;
    try {
      const { data } = await crmColdCallDetails(lead.id, changed);
      setLead((l) => ({ ...l, ...data }));
      toast.success('Details saved');
      return true;
    } catch (e) { toast.error(e.response?.data?.message || 'Could not save details'); return false; }
  };

  const save = async (thenNext = true) => {
    if (!outcome || busy) return;
    if (outcome === 'callback' && !nextAt) { toast.error('Pick when to call back'); return; }
    setBusy(true);
    try {
      if (dirty && !(await saveDetails())) return;
      const { data } = await crmColdCallOutcome(lead.id, {
        outcome, note, objection: objection || undefined, durationSec: elapsed || null,
        callbackAt: outcome === 'callback' ? nextAt : null,
      });
      if (nextAt && outcome !== 'callback' && !NO_FOLLOW_UP.has(outcome)) {
        await crmColdCallRemind(lead.id, { at: nextAt, note }).catch(() => toast.error('Call saved, but the follow-up could not be scheduled'));
      }
      for (const w of data?.warnings || []) toast(w);
      setRunning(false);
      reload();
      const category = preferTracked(messageFor(outcome, data?.coldCall || {}), queue.templates);
      if (category) setComm({ category, callbackAt: outcome === 'callback' ? nextAt : null, savedOutcome: outcome, afterSave: thenNext });
      else { toast.success('Call saved'); if (thenNext) goNext(); else resetCall(); }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not save the call');
    } finally { setBusy(false); }
  };
  saveRef.current = save;

  useEffect(() => {
    const onKey = (e) => {
      if (comm || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const o = OUTCOMES.find((x) => x.hotkey === e.key);
      if (o) { e.preventDefault(); pick(o.key); return; }
      if (e.key === 'Enter') { e.preventDefault(); saveRef.current?.(true); return; }
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); setRunning((r) => !r); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const closeComm = (thenNext) => { setComm(null); if (thenNext) goNext(); else resetCall(); };

  const digits = String(lead.phone || '').replace(/\D/g, '');
  const maps = safeUrl(cc.maps_url);
  const site = safeUrl(lead.website);
  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast.success('Copied')).catch(() => {});
  const status = cc.attempts > 0 ? `${outcomeLabel(cc.last_outcome)} · call ${cc.attempts + 1}` : 'Not called yet';
  const isCallback = outcome === 'callback';
  const hotAt = queue.hot?.[lead.id];
  const setup = (queue.setup || []).find((x) => x.lead.id === lead.id);
  const pitch = categoryPitch(lead.profession);
  const kindLabel = planItem ? ({ new: 'New', retry: 'Retry', callback: 'Callback', later: 'Callback', setup: 'Setup call' })[planItem.kind] : null;

  return (
    <div className="space-y-3">
      {/* Top bar: position in today's list · on-call timer · today's numbers */}
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`${BASE}/today`} className="text-[12.5px] font-semibold text-[#2E1065]">← Today's calls</Link>
        <Badge tone="warn">{idx >= 0 ? `Lead ${idx + 1} of ${plan.length}${kindLabel ? ` · ${kindLabel}` : ''}` : 'Opened from search'}</Badge>
        <span className="flex gap-1">
          <Btn size="sm" variant="outline" aria-label="Previous lead" disabled={idx <= 0} onClick={() => goTo(plan[idx - 1]?.lead.id)}>‹</Btn>
          <Btn size="sm" variant="outline" aria-label="Next lead" onClick={goNext}>›</Btn>
        </span>
        <div className="ml-auto flex items-center gap-3">
          {running && <Badge tone="ok">● On call</Badge>}
          <button type="button" onClick={() => setRunning((x) => !x)} title="Start / stop the call timer (T)"
            className={`!min-h-0 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 ${running ? 'border-emerald-500/40' : 'adm-border'} adm-hoverable`}>
            <span className="text-[18px] font-extrabold adm-t1 tabular-nums" style={HEADING}>{fmtTimer(elapsed)}</span>
            <span className="text-[11px] font-semibold adm-t3">{running ? 'Stop' : 'Start'} (T)</span>
          </button>
          <TodayStrip today={queue.today} totals={queue.totals} compact />
        </div>
      </div>

      <div className="flex flex-wrap lg:flex-nowrap gap-3 items-start">
        {/* Centre — the lead */}
        <div className="flex-1 min-w-0 space-y-3">
          <Card className="!p-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h2 className="text-[22px] font-extrabold adm-t1 leading-tight truncate" style={HEADING}>{lead.business_name || lead.name || 'Unnamed lead'}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] mt-0.5">
                  <span className="adm-t2">{[lead.profession, cc.locality, lead.city].filter(Boolean).join(' · ')}</span>
                  {cc.rating && <span className="adm-t1"><b>{cc.rating} ★</b> <span className="adm-t3">({cc.reviews || 0})</span></span>}
                  {maps && <a href={maps} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#2E1065] whitespace-nowrap">View on Maps ↗</a>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cc.fit && <Badge tone="ok">High fit · {cc.fit}</Badge>}
                {cc.priority && <Badge tone="warn">{/^p/i.test(cc.priority) ? cc.priority : `#${cc.priority}`}</Badge>}
                <Badge tone={cc.attempts > 0 ? 'info' : 'neutral'}>{status}</Badge>
                {hotAt && <Badge tone="danger">🔥 Clicked link {ago(hotAt)}</Badge>}
                {lead.profile_id && <Badge tone="ok">✓ Signed up</Badge>}
                {lead.do_not_contact && <Badge tone="danger">Do not contact</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t adm-border">
              <a href={`tel:+${digits}`} onClick={() => setRunning(true)} className="text-[24px] font-extrabold adm-t1 tracking-wide whitespace-nowrap mr-1" style={HEADING}>{formatPhone(lead.phone)}</a>
              <Btn size="sm" variant="ghost" onClick={() => copy(formatPhone(lead.phone).replace(/\s/g, ''))}>Copy</Btn>
              <span className="text-[12px] adm-t3 mr-auto">{form.alt_phone ? `Alt: ${form.alt_phone}` : ''}</span>
              <a href={`tel:+${digits}`} onClick={() => setRunning(true)} className="inline-flex items-center rounded-lg px-3 py-1.5 text-[13px] font-semibold bg-[#2E1065] text-white hover:bg-[#e54900]">Open in dialer</a>
              <Btn size="sm" variant="outline" onClick={() => setComm({ category: preferTracked(messageFor(cc.last_outcome, cc) || 'cold_call_interested', queue.templates), callbackAt: null, savedOutcome: null, afterSave: false })}>✉ Communicate</Btn>
            </div>
          </Card>

          <TabBar value={tab} onChange={setTab} tabs={[
            { value: 'details', label: 'Lead details' }, { value: 'pitch', label: 'Pitch & script' },
            { value: 'objections', label: `Objections${objection ? ' · 1' : ''}` }, { value: 'history', label: 'History' },
          ]} />

          {tab === 'details' && (
            <div className="grid gap-3 xl:grid-cols-[1fr_260px]">
              <Card className="!p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[14px] font-bold adm-t1" style={HEADING}>Business information</h3>
                  {dirty ? <Btn size="sm" onClick={saveDetails}>Save details</Btn> : <span className="text-[11.5px] adm-t3">Edit while you talk · saved with the call</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-x-3 gap-y-1.5">
                  {DETAIL_FIELDS.map(([k, label, ph]) => (
                    <label key={k} className="block min-w-0">
                      <span className="text-[10.5px] font-semibold uppercase tracking-wide adm-t3">{label}</span>
                      <input className="fb-input text-[13px] !w-full !min-h-0 !h-8 !py-1 mt-0.5" value={form[k]} placeholder={ph || ''} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
                    </label>
                  ))}
                </div>
                {site && <a href={site} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-[12px] font-semibold text-[#2E1065]">Open website ↗</a>}
              </Card>
              <div className="space-y-3">
                <Card className="!p-4">
                  <h3 className="text-[14px] font-bold adm-t1 mb-2" style={HEADING}>Recent activity</h3>
                  {history === null ? <Skeleton className="h-12" /> : history.length === 0 ? <div className="text-[12.5px] adm-t3">No previous calls.</div>
                    : history.slice(0, 3).map((h, i) => (
                      <div key={i} className="flex gap-2 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2E1065] mt-1.5 shrink-0" />
                        <div className="min-w-0"><div className="text-[12.5px] adm-t1 line-clamp-2">{h.title}{h.body ? ` — ${h.body}` : ''}</div><div className="text-[11px] adm-t3">{when(h.at)}</div></div>
                      </div>
                    ))}
                </Card>
                {setup ? (
                  <Card className="!p-4">
                    <h3 className="text-[14px] font-bold adm-t1 mb-2" style={HEADING}>Get them live · {setup.left} left</h3>
                    <ul className="space-y-1 text-[12.5px]">{setup.steps.map((x) => <li key={x.key} className={x.done ? 'adm-t3 line-through' : 'adm-t1 font-semibold'}>{x.done ? '✓' : '○'} {x.label}</li>)}</ul>
                    {setup.username && <a href={`/${setup.username}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-[12px] font-semibold text-[#2E1065]">Open their page ↗</a>}
                  </Card>
                ) : (
                  <Card className="!p-4">
                    <h3 className="text-[14px] font-bold adm-t1 mb-2" style={HEADING}>Why good fit</h3>
                    <ul className="space-y-1 text-[12.5px] adm-t2">{fitReasons(lead).map((r) => <li key={r}>✓ {r}</li>)}</ul>
                  </Card>
                )}
              </div>
            </div>
          )}

          {tab === 'pitch' && (
            <Card className="!p-4 space-y-3">
              {cc.pitch && <div className="rounded-xl bg-[#2E1065]/[0.07] p-3 text-[13px] adm-t1"><b>For this lead: </b>{cc.pitch}</div>}
              {pitch && (
                <div className="rounded-xl border adm-border p-3">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-[#2E1065] mb-1">{pitch.title} angle</div>
                  <ul className="space-y-1 text-[13px] adm-t1">{pitch.points.map((p) => <li key={p}>• {p}</li>)}</ul>
                </div>
              )}
              <ol className="space-y-2">
                {SCRIPT.map(([step, text], i) => (
                  <li key={step} className="flex gap-3 text-[13px]"><span className="w-6 h-6 rounded-lg bg-[#2E1065] text-white text-[12px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <div><b className="adm-t1">{step}.</b> <span className="adm-t2">{text}</span></div></li>
                ))}
              </ol>
            </Card>
          )}

          {tab === 'objections' && (
            <div className="grid gap-2 md:grid-cols-2">
              {OBJECTIONS.map((o) => {
                const on = objection === o.q;
                return (
                  <Card key={o.q} className={`!p-3 ${on ? '!border-[#2E1065]' : ''}`}>
                    <div className="font-semibold adm-t1 text-[13px]">“{o.q}”</div>
                    <div className="adm-t2 text-[12.5px] mt-1">{o.a}</div>
                    <Btn size="sm" variant={on ? 'primary' : 'outline'} className="mt-2" onClick={() => setObjection(on ? '' : o.q)}>{on ? '✓ They said this' : 'They said this'}</Btn>
                  </Card>
                );
              })}
            </div>
          )}

          {tab === 'history' && (
            <Card className="!p-4 max-h-[420px] overflow-y-auto">
              {history === null ? <Skeleton className="h-24" /> : history.length === 0 ? <div className="text-[13px] adm-t3">Nothing yet.</div>
                : history.map((h, i) => (
                  <div key={i} className="py-2 border-b adm-border last:border-0">
                    <div className="text-[13px] adm-t1">{h.title}</div>
                    {h.body && <div className="text-[12.5px] adm-t2 whitespace-pre-wrap">{h.body}</div>}
                    <div className="text-[11px] adm-t3">{when(h.at)}</div>
                  </div>
                ))}
            </Card>
          )}
        </div>

        {/* Right — outcome */}
        <div className="w-full lg:w-[300px] lg:shrink-0 space-y-3">
          <Card className="!p-3">
            <h3 className="text-[14px] font-bold adm-t1 mb-2" style={HEADING}>Call outcome</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {OUTCOMES.map((o) => {
                const on = outcome === o.key;
                return (
                  <button key={o.key} type="button" onClick={() => pick(o.key)}
                    className={`!min-h-0 flex items-center gap-2 h-8 px-2 rounded-lg border text-[12.5px] text-left transition-colors ${o.key === 'wrong_number' ? 'col-span-2' : ''} ${on ? 'border-[#2E1065] bg-[#2E1065]/[0.08] text-[#c2410c] font-semibold' : 'adm-border adm-t1 adm-hoverable'}`}>
                    <span className={`w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center shrink-0 ${on ? 'bg-[#2E1065] text-white' : 'adm-chip'}`}>{o.hotkey}</span>
                    <span className="truncate">{o.key === 'callback' ? 'Call back' : o.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="!p-3 space-y-2">
            <h3 className="text-[13.5px] font-bold adm-t1" style={HEADING}>{isCallback ? 'Call back at' : <>Next follow-up <span className="adm-t3 text-[11.5px] font-medium">(optional)</span></>}</h3>
            <div className="flex flex-wrap gap-1">
              {callbackPresets(new Date()).map((p) => (
                <button key={p.label} type="button" onClick={() => setNextAt(p.at.toISOString())}
                  className={`!min-h-0 px-1.5 py-0.5 rounded-md text-[11px] font-semibold border ${nextAt && +new Date(nextAt) === +p.at ? 'border-[#2E1065] text-[#c2410c] bg-[#2E1065]/[0.08]' : 'adm-border adm-t2 adm-hoverable'}`}>{p.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="datetime-local" className="fb-input text-[12px] !w-full !min-h-0 !h-8 !py-1" aria-label="Follow-up date and time"
                value={nextAt ? toLocalInput(nextAt) : ''} onChange={(e) => setNextAt(e.target.value ? new Date(e.target.value).toISOString() : null)} />
              {nextAt && <button type="button" className="!min-h-0 text-[11.5px] adm-t3" onClick={() => setNextAt(null)}>Clear</button>}
            </div>
            <textarea className="fb-input text-[13px] !w-full !min-h-0" rows={2} placeholder="Call notes…" aria-label="Call notes" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none]" aria-label="Quick notes">
              {NOTE_CHIPS.map((c) => (
                <button key={c} type="button" onClick={() => setNote((n) => addChip(n, c))}
                  className="!min-h-0 px-1.5 py-0.5 rounded-md text-[11px] font-semibold border adm-border adm-t2 adm-hoverable">+ {c}</button>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Btn className="justify-center" onClick={() => save(true)} disabled={!outcome || busy}>{busy ? 'Saving…' : 'Save call →'}</Btn>
            <Btn variant="outline" onClick={() => save(false)} disabled={!outcome || busy}>Save only</Btn>
          </div>
          <p className="text-[10.5px] adm-t3 text-center leading-snug">Keys 1–7 outcome · Enter save · T timer</p>
        </div>
      </div>

      {comm && (
        <ColdCallCommunicate lead={lead} templates={queue.templates || []} initialCategory={comm.category}
          callbackAt={comm.callbackAt} savedOutcome={comm.savedOutcome} afterSave={comm.afterSave}
          onClose={() => closeComm(false)} onDone={closeComm} onTemplatesChanged={reload} />
      )}
    </div>
  );
}

export default function ColdCallLead() {
  const { leadId } = useParams();
  const { queue, reload } = useOutletContext();
  const plan = useMemo(() => pendingPlan(queue), [queue]);
  const [lead, setLead] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    setLead(null); setMissing(false);
    // GET /leads/:id answers { lead, notes, followUps }.
    const hit = prefetched.get(leadId);
    prefetched.delete(leadId);
    (hit || crmGetLead(leadId)).then(({ data }) => { if (alive) setLead(data?.lead || null); if (alive && !data?.lead) setMissing(true); })
      .catch(() => { if (alive) setMissing(true); });
    return () => { alive = false; };
  }, [leadId]);

  // Fetch the next lead in the background while this call happens.
  const nextId = nextLeadId(plan, leadId);
  useEffect(() => {
    if (!nextId || nextId === leadId || prefetched.has(nextId)) return;
    const p = crmGetLead(nextId);
    p.catch(() => prefetched.delete(nextId));
    prefetched.set(nextId, p);
  }, [nextId, leadId]);

  if (missing) return <Card className="p-10 text-center adm-t3">Lead not found. <Link to={`${BASE}/today`} className="text-[#2E1065] font-semibold">Back to today's calls</Link></Card>;
  if (!lead) return <Skeleton className="h-96 rounded-2xl" />;
  return <LeadCall key={lead.id} initial={lead} plan={plan} queue={queue} reload={reload} />;
}
