import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Card, Btn, Badge } from '../../../components/admin/ui';
import {
  crmGetLead, crmLeadTimeline, crmLeadMessages, crmAddLeadNote, crmCreateFollowUp,
  crmCompleteFollowUp, crmAddTag, crmRemoveTag, crmSetDnc, crmLogCall, crmSendWhatsApp, crmSendEmail,
  crmListTemplates, crmListTags, crmCreateTag, crmUpdateLead,
  crmListSequences, crmEnroll, crmListLeads, crmMergeLead, crmListLists,
} from '../../../services/api';
import { FUNNEL, STATUS_LABEL, STATUS_TONE, PLAN_INTEREST, PLAN_INTEREST_LABEL, rupees, relTime, leadScore } from './salesConstants';
import { guardedSetStatus } from './statusMove';
import { colorMap } from './salesTagColors';
import TagChip from './TagChip';
import TagPicker from './TagPicker';
import {
  Check, CheckCircle2, ChevronDown, Mail, Phone, MessageCircle, FileText,
  CalendarClock, Clock, Plus, ArrowRight, ArrowLeft, IndianRupee, Tag, Activity, StickyNote, GitMerge, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

const MSG_TONE = { sent: 'ok', delivered: 'ok', read: 'ok', queued: 'neutral', processing: 'neutral', failed: 'danger', bounced: 'danger', skipped: 'warn' };
const TABS = [['activity', 'Timeline'], ['messages', 'Messages'], ['notes', 'Notes'], ['followups', 'Follow-ups']];

// Funnel stages shown as the visual stepper (everything up to "Activated").
// "Won" (paid), "Lost" and DNC are terminal states, offered as buttons below.
const STEP_STAGES = FUNNEL.filter((s) => s !== 'paid');

const initialsOf = (name) => (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
// Scraped URLs are admin-supplied but unsanitized — only render http(s) as a link (blocks javascript: etc).
const isHttpUrl = (u) => typeof u === 'string' && u.startsWith('http');

// Map a timeline entry to an icon + tint from its source/title (no new data).
function timelineIcon(item) {
  const s = `${item.source || ''} ${item.title || ''}`.toLowerCase();
  if (s.includes('whatsapp')) return { Icon: MessageCircle, cls: 'text-emerald-600 bg-emerald-50' };
  if (s.includes('email') || s.includes('mail')) return { Icon: Mail, cls: 'text-blue-600 bg-blue-50' };
  if (s.includes('call')) return { Icon: Phone, cls: 'text-slate-600 bg-slate-100' };
  if (s.includes('note')) return { Icon: FileText, cls: 'text-violet-600 bg-violet-50' };
  if (s.includes('status')) return { Icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' };
  if (s.includes('follow')) return { Icon: CalendarClock, cls: 'text-amber-600 bg-amber-50' };
  return { Icon: Clock, cls: 'text-slate-500 bg-slate-100' };
}

// Horizontal funnel stepper. Filled/checked up to the current stage; click any
// step to jump the lead there. When the lead is Won (paid — a terminal state that
// isn't one of the steps) the whole rail reads as complete instead of blank.
function Stepper({ status, onPick }) {
  const isWon = status === 'paid';
  const cur = isWon ? STEP_STAGES.length - 1 : STEP_STAGES.indexOf(status);
  return (
    <div className="flex items-start">
      {STEP_STAGES.map((s, i) => {
        const done = cur >= 0 && i <= cur;
        const isCur = !isWon && i === cur;
        return (
          <Fragment key={s}>
            <button type="button" onClick={() => onPick(s)} className="flex flex-col items-center gap-1 shrink-0 w-11 group" title={STATUS_LABEL[s]}>
              <span className={`w-6 h-6 rounded-full grid place-items-center border-2 transition
                ${done ? 'bg-[#2E1065] border-[#2E1065] text-white' : 'adm-card border-gray-300 group-hover:border-[#2E1065]'}
                ${isCur ? 'ring-2 ring-[#2E1065]/30' : ''}`}>
                {done ? <Check size={13} /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
              </span>
              <span className={`text-[9px] leading-tight text-center ${isCur ? 'font-semibold text-[#2E1065]' : 'adm-t3'}`}>{STATUS_LABEL[s]}</span>
            </button>
            {i < STEP_STAGES.length - 1 && <span className={`h-0.5 flex-1 mt-3 ${i < cur ? 'bg-[#2E1065]' : 'bg-gray-200'}`} />}
          </Fragment>
        );
      })}
    </div>
  );
}

// Enrol this lead into an active drip sequence. Loads the list on first open;
// enrolment is idempotent server-side (per sequence+lead). Sends stay gated by
// the CRM kill-switch, so this only schedules — nothing goes out until that's on.
function EnrollControl({ leadId, onDone }) {
  const [open, setOpen] = useState(false);
  const [seqs, setSeqs] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && seqs === null) {
      crmListSequences()
        .then(({ data }) => setSeqs((Array.isArray(data) ? data : []).filter((s) => s.is_active)))
        .catch(() => setSeqs([]));
    }
  }, [open, seqs]);
  const enroll = async (id) => {
    setBusy(true);
    try { await crmEnroll(leadId, id); toast.success('Enrolled in sequence'); setOpen(false); onDone?.(); }
    catch (e) { toast.error(e.response?.data?.message || 'Could not enrol'); }
    finally { setBusy(false); }
  };
  return (
    <div className="relative inline-block">
      <Btn variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>Enrol</Btn>
      {open && (
        <div className="absolute z-20 mt-1 w-60 rounded-xl adm-card shadow-lg max-h-60 overflow-auto">
          {seqs === null ? <p className="px-3 py-2 text-[12px] adm-t3">Loading…</p>
            : seqs.length === 0 ? <p className="px-3 py-2 text-[12px] adm-t3">No active sequences. <a href="/admin/sales/sequences" className="text-[#2E1065]">Create one</a>.</p>
            : seqs.map((s) => (
              <button key={s.id} type="button" disabled={busy} onClick={() => enroll(s.id)}
                className="w-full text-left px-3 py-2 adm-hoverable text-[13px] adm-t1 disabled:opacity-50">{s.name}</button>
            ))}
        </div>
      )}
    </div>
  );
}

// Stat tile with a coloured icon chip (Revenue / Deal value / Stage).
function StatCard({ icon: Icon, iconCls, label, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-3.5 flex items-start gap-3">
      <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${iconCls}`}><Icon size={18} /></span>
      <div className="min-w-0">
        <p className="text-[10px] adm-t3 uppercase tracking-wide font-semibold">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

// Click-to-set plan the lead is interested in. null = "—" (unset).
function PlanInterestPicker({ value, onPick }) {
  const [open, setOpen] = useState(false);
  const label = PLAN_INTEREST_LABEL[value] || '—';
  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="text-[13px] font-semibold adm-t1 hover:text-[#2E1065] inline-flex items-center gap-1">
        {label} <ChevronDown size={13} className="adm-t3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-44 rounded-xl adm-card shadow-lg overflow-hidden">
            <button type="button" onClick={() => { onPick(null); setOpen(false); }} className="w-full text-left px-3 py-2 adm-hoverable text-[13px] adm-t3">— (none)</button>
            {PLAN_INTEREST.map((p) => (
              <button key={p.value} type="button" onClick={() => { onPick(p.value); setOpen(false); }}
                className="w-full text-left px-3 py-2 adm-hoverable text-[13px] adm-t1">{p.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Shared lead workspace — rendered both in the right-side drawer (variant="drawer",
// compact, no tabs) and on the full-page /leads/:id route (variant="page", rich:
// stepper, About card, tabbed activity). `onChanged` lets the parent list refresh.
export default function LeadPanel({ leadId, onChanged, onClose, variant = 'page' }) {
  const isDrawer = variant === 'drawer';
  const [lead, setLead] = useState(null);
  const [notes, setNotes] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('activity');
  const [modal, setModal] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [tagCatalog, setTagCatalog] = useState([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [editVal, setEditVal] = useState(false);
  const [valInput, setValInput] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      crmGetLead(leadId).then(({ data }) => { setLead(data.lead); setNotes(data.notes || []); setFollowUps(data.followUps || []); }),
      crmLeadTimeline(leadId).then(({ data }) => setTimeline(Array.isArray(data) ? data : [])).catch(() => setTimeline([])),
      crmLeadMessages(leadId).then(({ data }) => setMessages(Array.isArray(data) ? data : [])).catch(() => setMessages([])),
    ]).catch(() => setLead(null)).finally(() => setLoading(false));
  }, [leadId]);

  const loadTags = useCallback(() => crmListTags().then(({ data }) => setTagCatalog(Array.isArray(data) ? data : [])).catch(() => setTagCatalog([])), []);
  const refresh = () => { load(); onChanged?.(); };

  useEffect(() => { load(); }, [load]);
  useEffect(() => { crmListTemplates().then(({ data }) => setTemplates(Array.isArray(data) ? data : [])).catch(() => setTemplates([])); loadTags(); }, [loadTags]);

  const setStatus = async (s) => {
    try {
      const ok = await guardedSetStatus(leadId, lead?.status, s);   // reason prompt on backward/exit
      if (ok) { toast.success(`Stage → ${STATUS_LABEL[s]}`); refresh(); }
    } catch { toast.error('Failed'); }
  };
  const toggleDnc = async () => { try { await crmSetDnc(leadId, !lead.do_not_contact); refresh(); } catch { toast.error('Failed'); } };
  const removeTag = async (t) => { try { await crmRemoveTag(leadId, t); refresh(); } catch { toast.error('Failed'); } };
  const pickTag = async (name) => { try { await crmAddTag(leadId, name); setShowTagPicker(false); refresh(); } catch { toast.error('Failed'); } };
  const createTag = async (name, color) => { try { await crmCreateTag({ name, color }); await crmAddTag(leadId, name); setShowTagPicker(false); loadTags(); refresh(); } catch { toast.error('Could not create tag'); } };
  const completeFollowUp = async (fid) => { try { await crmCompleteFollowUp(fid); refresh(); } catch { toast.error('Failed'); } };
  const setPlanInterest = async (v) => { try { await crmUpdateLead(leadId, { plan_interest: v }); refresh(); } catch { toast.error('Failed'); } };
  const saveValue = async () => {
    const rupeesNum = Math.max(0, Math.round(Number(valInput) || 0));
    try { await crmUpdateLead(leadId, { expected_value_paise: rupeesNum * 100 }); setEditVal(false); refresh(); }
    catch { toast.error('Failed'); }
  };

  // ── Cold-list actions (drawer, status='list') ──
  const [lists, setLists] = useState(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const loadLists = () => { if (lists === null) crmListLists().then(({ data }) => setLists(Array.isArray(data) ? data : [])).catch(() => setLists([])); };
  const moveToList = async (lid) => {
    try { await crmUpdateLead(leadId, { list_id: lid }); setMoveOpen(false); toast.success('Moved to list'); refresh(); }
    catch (e) { toast.error(e.response?.data?.message || 'Could not move'); }
  };
  // ── Edit contact details (drawer) ──
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const startEdit = () => { setForm({ name: lead.name || '', email: lead.email || '', phone: lead.phone || '', business_name: lead.business_name || '', website: lead.website || '', linkedin: lead.linkedin || '', instagram: lead.instagram || '', city: lead.city || '', profession: lead.profession || '' }); setEditing(true); };
  const saveDetails = async () => {
    try { await crmUpdateLead(leadId, form); setEditing(false); toast.success('Details saved'); refresh(); }
    catch (e) { toast.error(e.response?.data?.message || 'Save failed'); }
  };

  // Collapse runs of identical consecutive timeline rows (e.g. six "Status →
  // activated" re-syncs) into one row with a count, so the log stays readable.
  const dedupedTimeline = useMemo(() => {
    const out = [];
    for (const t of timeline) {
      const prev = out[out.length - 1];
      if (prev && prev.title === t.title && (prev.body || '') === (t.body || '')) prev._count = (prev._count || 1) + 1;
      else out.push({ ...t });
    }
    return out;
  }, [timeline]);

  if (loading && !lead) return <div className="p-6"><p className="adm-t3">Loading…</p></div>;
  if (!lead) return <div className="p-6"><p className="adm-t3">Lead not found. <Link to="/admin/sales/leads" className="text-[#2E1065]">Back</Link></p></div>;

  const tagColors = colorMap(tagCatalog);
  const { score, temp } = leadScore(lead);
  const scoreTone = temp === 'hot' ? 'text-red-500' : temp === 'warm' ? 'text-amber-600' : 'adm-t3';
  const nextFu = [...followUps].sort((a, b) => new Date(a.due_at) - new Date(b.due_at))[0];
  const detailLink = lead.profile_id ? `/admin/host360/${lead.profile_id}` : `/admin/customer/${lead.id}`;

  // ── Reusable blocks (shared between variants) ──
  const DealValue = editVal ? (
    <div className="flex items-center gap-1">
      <span className="text-[13px] adm-t3">₹</span>
      <input autoFocus type="number" className="fb-input text-sm w-24 py-0.5" value={valInput}
        onChange={(e) => setValInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveValue()} onBlur={saveValue} />
    </div>
  ) : (
    <button onClick={() => { setValInput(String(Math.round((lead.expected_value_paise || 0) / 100))); setEditVal(true); }}
      className="text-lg font-bold adm-t1 hover:text-[#2E1065] block">
      {lead.expected_value_paise ? rupees(lead.expected_value_paise) : 'Set ✎'}
    </button>
  );

  const QuickActions = (
    <div>
      <p className="text-[10px] adm-t3 uppercase tracking-wide font-semibold mb-2">Quick actions</p>
      <div className="grid grid-cols-3 gap-2">
        <QuickAction color="wa" icon={MessageCircle} label="WhatsApp" size={isDrawer ? 'sm' : 'lg'} onClick={() => setModal('wa')} />
        <QuickAction color="email" icon={Mail} label="Email" size={isDrawer ? 'sm' : 'lg'} onClick={() => setModal('email')} />
        <QuickAction color="call" icon={Phone} label="Call" size={isDrawer ? 'sm' : 'lg'} onClick={() => setModal('call')} />
      </div>
      <div className="flex gap-2 mt-2">
        <AddActivityMenu onPick={setModal} />
        <EnrollControl leadId={lead.id} onDone={refresh} />
      </div>
    </div>
  );

  const Identity = (
    <div className="flex items-start gap-3">
      <div className="w-14 h-14 rounded-full bg-[#2E1065]/10 text-[#2E1065] grid place-items-center font-bold text-lg shrink-0">
        {initialsOf(lead.name)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold adm-t1 truncate">{lead.name || 'Unnamed lead'}</h1>
          <Badge tone={STATUS_TONE[lead.status] || 'neutral'}>{STATUS_LABEL[lead.status] || lead.status}</Badge>
          {lead.do_not_contact && <Badge tone="danger">DNC</Badge>}
          <span className={`text-[13px] font-bold ${scoreTone}`} title={`Lead score (${temp})`}>{temp === 'hot' ? '🔥' : ''}{score}</span>
        </div>
        {lead.business_name && <p className="text-[13px] adm-t2 mt-0.5 truncate">{lead.business_name}{lead.profession ? ` · ${lead.profession}` : ''}</p>}
        <div className="mt-1.5 space-y-0.5 text-[12px] adm-t2">
          {lead.email && <p className="flex items-center gap-1.5 truncate"><Mail size={12} className="adm-t3" />{lead.email}</p>}
          {lead.phone && <p className="flex items-center gap-1.5"><Phone size={12} className="adm-t3" />{lead.phone}</p>}
          {(isHttpUrl(lead.website) || isHttpUrl(lead.linkedin) || isHttpUrl(lead.instagram)) && (
            <p className="flex items-center gap-2 flex-wrap">
              {isHttpUrl(lead.website) && <a className="text-[#2E1065]" href={lead.website} target="_blank" rel="noreferrer">Website ↗</a>}
              {isHttpUrl(lead.linkedin) && <a className="text-[#2E1065]" href={lead.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>}
              {isHttpUrl(lead.instagram) && <a className="text-[#2E1065]" href={lead.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>}
            </p>
          )}
          <p className="flex items-center gap-1.5 adm-t3"><Clock size={12} />Source: {lead.source}{lead.city ? ` · ${lead.city}` : ''}</p>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <Link to={`/admin/customer/${lead.id}`} className="inline-flex items-center gap-1 text-[12px] text-[#2E1065] font-semibold">Customer 360 <ArrowRight size={12} /></Link>
          {lead.profile_id && <Link to={`/admin/host360/${lead.profile_id}`} className="inline-flex items-center gap-1 text-[12px] adm-t3">Host 360 <ArrowRight size={12} /></Link>}
        </div>
      </div>
    </div>
  );

  const NextAction = (
    <div className="rounded-2xl border border-gray-200 p-3.5 flex items-start gap-3">
      <span className="w-9 h-9 rounded-lg bg-[#2E1065]/10 text-[#2E1065] grid place-items-center shrink-0"><CalendarClock size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-[#2E1065] uppercase tracking-wide font-semibold">Next action</p>
        {nextFu ? (
          <>
            <p className="text-[14px] font-semibold adm-t1 truncate">{nextFu.title || 'Follow up'}</p>
            <p className={`text-[12px] ${new Date(nextFu.due_at) < new Date() ? 'text-red-500' : 'adm-t3'}`}>{fmtDateTime(nextFu.due_at)}</p>
          </>
        ) : <p className="text-[13px] adm-t3 mt-0.5">Nothing scheduled.</p>}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
        <Btn variant="outline" size="sm" onClick={() => setModal('followup')}>{nextFu ? 'Edit' : 'Schedule'}</Btn>
        {nextFu && <Btn size="sm" onClick={() => completeFollowUp(nextFu.id)}><Check size={14} /> Mark done</Btn>}
      </div>
    </div>
  );

  const Tags = (
    <div>
      <p className="text-[10px] adm-t3 uppercase tracking-wide font-semibold mb-2">Tags</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {(lead.tags || []).map((t) => <TagChip key={t} name={t} color={tagColors[t]} onRemove={() => removeTag(t)} />)}
        <div className="relative">
          <button type="button" onClick={() => setShowTagPicker((v) => !v)}
            className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-gray-300 adm-t3 hover:border-[#2E1065]">+ Tag</button>
          {showTagPicker && <TagPicker tags={tagCatalog} exclude={lead.tags || []} onSelect={pickTag} onCreate={createTag} onClose={() => setShowTagPicker(false)} />}
        </div>
      </div>
    </div>
  );

  const NotesCard = (
    <div className="rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 grid place-items-center shrink-0"><StickyNote size={16} /></span>
        <p className="text-[11px] adm-t3 uppercase tracking-wide font-semibold flex-1">Notes</p>
        <Btn variant="outline" size="sm" onClick={() => setModal('note')}>Add note</Btn>
      </div>
      {notes.length === 0 ? <p className="text-[13px] adm-t3">No notes added yet.</p> : (
        <ul className="space-y-2.5">
          {notes.map((n) => (
            <li key={n.id} className="text-[13px] adm-t2"><p>{n.body}</p><p className="text-[11px] adm-t3 mt-0.5">{relTime(n.created_at)}</p></li>
          ))}
        </ul>
      )}
    </div>
  );

  const modalEl = modal === 'merge'
    ? <MergeModal lead={lead} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />
    : modal && <ActionModal type={modal} lead={lead} templates={templates} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />;
  const Footer = (
    <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-[11px] adm-t3">
      <span>Created {fmtDateTime(lead.created_at)}</span>
      <span>Last updated {relTime(lead.last_activity_at || lead.updated_at || lead.created_at)}</span>
    </div>
  );

  // ── DRAWER: compact, no tabs, notes card ──
  if (isDrawer) {
    return (
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          {Identity}
          {NextAction}
        </div>

        {/* Cold-list actions — only for a lead sitting in a list (status='list'). */}
        {lead.status === 'list' && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-2.5">
            <Btn size="sm" onClick={() => setStatus('new')}>Promote → New</Btn>
            <Btn variant="outline" size="sm" onClick={() => setStatus('disqualified')}>Disqualify</Btn>
            <Btn variant="outline" size="sm" onClick={toggleDnc}>{lead.do_not_contact ? 'Clear DNC' : 'Do Not Contact'}</Btn>
            <div className="relative">
              <Btn variant="outline" size="sm" onClick={() => { loadLists(); setMoveOpen((v) => !v); }}>Move to list ▾</Btn>
              {moveOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMoveOpen(false)} />
                  <div className="absolute z-20 mt-1 w-56 rounded-xl adm-card shadow-lg max-h-56 overflow-auto">
                    {lists === null ? <p className="px-3 py-2 text-[12px] adm-t3">Loading…</p>
                      : lists.filter((l) => l.id !== lead.list_id).length === 0 ? <p className="px-3 py-2 text-[12px] adm-t3">No other lists.</p>
                      : lists.filter((l) => l.id !== lead.list_id).map((l) => (
                        <button key={l.id} type="button" onClick={() => moveToList(l.id)} className="w-full text-left px-3 py-2 adm-hoverable text-[13px] adm-t1">{l.name}</button>
                      ))}
                  </div>
                </>
              )}
            </div>
            {editing
              ? <div className="ml-auto flex gap-2"><Btn size="sm" onClick={saveDetails}>Save</Btn><Btn variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Btn></div>
              : <Btn variant="outline" size="sm" className="ml-auto" onClick={startEdit}>Edit details</Btn>}
          </div>
        )}

        {editing && <EditDetails form={form} setForm={setForm} />}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <StatCard icon={IndianRupee} iconCls="bg-emerald-50 text-emerald-600" label="Revenue">
            <p className="text-lg font-bold adm-t1">{rupees(lead.revenue_paise)}</p>
          </StatCard>
          <StatCard icon={Tag} iconCls="bg-violet-50 text-violet-600" label="Deal value">{DealValue}</StatCard>
          <StatCard icon={Activity} iconCls="bg-blue-50 text-blue-600" label="Stage">
            <Badge tone={STATUS_TONE[lead.status] || 'neutral'}>{STATUS_LABEL[lead.status] || lead.status}</Badge>
          </StatCard>
        </div>
        {QuickActions}
        {Tags}
        {NotesCard}
        {Footer}
        {modalEl}
      </div>
    );
  }

  // ── PAGE: rich — stepper, About card, tabbed activity ──
  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        {Identity}
        {NextAction}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard icon={IndianRupee} iconCls="bg-emerald-50 text-emerald-600" label="Revenue">
          <p className="text-lg font-bold adm-t1">{rupees(lead.revenue_paise)}</p>
        </StatCard>
        <StatCard icon={Tag} iconCls="bg-violet-50 text-violet-600" label="Deal value">{DealValue}</StatCard>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* LEFT: stage + actions */}
        <div className="space-y-5">
          <div>
            <p className="text-[10px] adm-t3 uppercase tracking-wide font-semibold mb-2">Stage</p>
            <Stepper status={lead.status} onPick={setStatus} />
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => setStatus('paid')}
                className={`text-[12px] px-3 py-1.5 rounded-lg border transition ${lead.status === 'paid' ? 'bg-emerald-600 text-white border-emerald-600' : 'adm-t2 border-gray-200 hover:border-emerald-500'}`}>Subscribed</button>
              <button onClick={() => setStatus('lost')}
                className={`text-[12px] px-3 py-1.5 rounded-lg border transition ${lead.status === 'lost' ? 'bg-red-600 text-white border-red-600' : 'adm-t2 border-gray-200 hover:border-red-400'}`}>Lost</button>
              <button onClick={toggleDnc}
                className={`text-[12px] px-3 py-1.5 rounded-lg border transition ${lead.do_not_contact ? 'bg-red-600 text-white border-red-600' : 'adm-t2 border-gray-200 hover:border-red-400'}`}>{lead.do_not_contact ? 'Clear DNC' : 'Do Not Contact'}</button>
            </div>
          </div>
          {QuickActions}
          {Tags}
        </div>

        {/* RIGHT: about this lead */}
        <div className="rounded-2xl border border-gray-200 p-4 space-y-3 self-start">
          <p className="text-[10px] adm-t3 uppercase tracking-wide font-semibold">About this lead</p>
          <AboutRow label="Lead Source" value={lead.source || '—'} />
          <AboutRow label="Lead Score" value={<span className={`font-semibold ${scoreTone}`}>{temp === 'hot' ? '🔥 ' : ''}{score} ({temp})</span>} />
          <AboutRow label="Owner" value={lead.owner_name || '—'} />
          <div>
            <p className="text-[11px] adm-t3 mb-0.5">Primary Plan Interest</p>
            <PlanInterestPicker value={lead.plan_interest} onPick={setPlanInterest} />
          </div>
          <Link to={detailLink} className="inline-flex items-center gap-1 text-[12px] text-[#2E1065] font-semibold pt-1">View full details <ArrowRight size={12} /></Link>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-gray-100">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`text-[13px] px-3 py-2 -mb-px border-b-2 transition ${tab === k ? 'border-[#2E1065] text-[#2E1065] font-semibold' : 'border-transparent adm-t2 hover:adm-t1'}`}>
              {label}{k === 'notes' && notes.length ? ` (${notes.length})` : ''}{k === 'followups' && followUps.length ? ` (${followUps.length})` : ''}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {tab === 'activity' && (
            dedupedTimeline.length === 0 ? <p className="adm-t3 text-sm">No activity yet.</p> : (
              <ol className="space-y-1">
                {dedupedTimeline.map((t, i) => {
                  const { Icon, cls } = timelineIcon(t);
                  const last = i === dedupedTimeline.length - 1;
                  return (
                    <li key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${cls}`}><Icon size={14} /></span>
                        {!last && <span className="w-px flex-1 bg-gray-200 my-1" />}
                      </div>
                      <div className="min-w-0 flex-1 pb-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-semibold adm-t1">{t.title}{t._count > 1 && <span className="ml-1.5 text-[11px] font-normal adm-t3">×{t._count}</span>}</p>
                          <span className="text-[11px] adm-t3 flex-shrink-0 whitespace-nowrap">{relTime(t.at)}</span>
                        </div>
                        {t.body && <p className="text-[12px] adm-t2 mt-0.5">{t.body}</p>}
                        {t.status && <span className="text-[10px] adm-t3">{t.source} · {t.status}</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )
          )}

          {tab === 'messages' && (
            messages.length === 0 ? <p className="adm-t3 text-sm">No messages sent yet.</p> : (
              <ul className="space-y-2">
                {messages.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-2 py-2 border-b border-gray-50">
                    <div className="min-w-0">
                      <p className="text-[13px] adm-t1"><span className="uppercase text-[10px] adm-t3 mr-1">{m.channel}</span>{m.subject || m.template_key || m.body_preview || '—'}</p>
                      {m.error && <p className="text-[11px] text-red-500">{m.error}</p>}
                      <p className="text-[11px] adm-t3">{relTime(m.created_at)}</p>
                    </div>
                    <Badge tone={MSG_TONE[m.status] || 'neutral'}>{m.status}</Badge>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === 'notes' && (
            notes.length === 0 ? <p className="adm-t3 text-sm">No notes.</p> : (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="text-[13px] adm-t2"><p>{n.body}</p><p className="text-[11px] adm-t3 mt-0.5">{relTime(n.created_at)}</p></li>
                ))}
              </ul>
            )
          )}

          {tab === 'followups' && (
            followUps.length === 0 ? <p className="adm-t3 text-sm">None open.</p> : (
              <ul className="space-y-2">
                {followUps.map((f) => {
                  const overdue = new Date(f.due_at) < new Date();
                  return (
                    <li key={f.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0"><p className="text-[13px] adm-t2 truncate">{f.title}</p><p className={`text-[11px] ${overdue ? 'text-red-500' : 'adm-t3'}`}>{relTime(f.due_at)}</p></div>
                      <Btn variant="outline" size="sm" onClick={() => completeFollowUp(f.id)}>Done</Btn>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </div>
      </div>

      {Footer}
      {modalEl}
    </div>
  );
}

function AboutRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] adm-t3">{label}</span>
      <span className="text-[13px] adm-t1 text-right truncate">{value}</span>
    </div>
  );
}

// Inline edit form for a lead's core contact fields (server EDITABLE columns).
// Fields are mapped, not defined as a nested component, so inputs keep focus
// across keystrokes.
const EDIT_FIELDS = [['Name', 'name'], ['Business', 'business_name'], ['Email', 'email'], ['Phone', 'phone'], ['Website', 'website'], ['LinkedIn', 'linkedin'], ['Instagram', 'instagram'], ['City', 'city'], ['Profession', 'profession']];
function EditDetails({ form, setForm }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {EDIT_FIELDS.map(([label, k]) => (
        <div key={k}>
          <label className="block text-[10px] adm-t3 uppercase tracking-wide font-semibold mb-0.5">{label}</label>
          <input className="fb-input text-sm w-full" value={form[k] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [k]: e.target.value }))} />
        </div>
      ))}
    </div>
  );
}

// Small dropdown for lower-frequency activities (note / follow-up) so the quick
// actions row stays to the three primary channels.
// Merge a duplicate lead INTO the currently-open one. The open lead (survivor) is kept;
// the picked duplicate is folded in and removed server-side via merge_lead_rows.
function MergeModal({ lead, onClose, onDone }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setRows([]); return; }
    let live = true;
    setSearching(true);
    const t = setTimeout(() => {
      crmListLeads({ q: s, pageSize: 8 })
        .then(({ data }) => { if (live) setRows((data?.rows || []).filter((r) => r.id !== lead.id)); })
        .catch(() => { if (live) setRows([]); })
        .finally(() => { if (live) setSearching(false); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, lead.id]);

  const doMerge = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await crmMergeLead(picked.id, lead.id);   // picked = loser, current lead = survivor (kept)
      toast.success('Duplicate merged in');
      onDone();
    } catch (e) { toast.error(e?.response?.data?.message || 'Merge failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl adm-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1"><GitMerge size={18} className="text-[#2E1065]" /><h3 className="text-base font-bold adm-t1">Merge duplicate</h3></div>
        <p className="text-[12.5px] adm-t2 mb-3">
          Find the duplicate lead. It gets folded into <span className="font-semibold adm-t1">{lead.name || lead.email || 'this lead'}</span> (kept) and removed. Its notes, tags, timeline and messages move over.
        </p>
        <div className="relative mb-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 adm-t3" />
          <input autoFocus className="fb-input text-sm w-full pl-8" placeholder="Search name, email or phone…" value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} />
        </div>
        <div className="max-h-56 overflow-auto rounded-xl border border-gray-100">
          {searching && <p className="px-3 py-2 text-[12px] adm-t3">Searching…</p>}
          {!searching && q.trim().length >= 2 && rows.length === 0 && <p className="px-3 py-2 text-[12px] adm-t3">No other leads match.</p>}
          {rows.map((r) => (
            <button key={r.id} type="button" onClick={() => setPicked(r)}
              className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 ${picked?.id === r.id ? 'bg-[#2E1065]/10' : 'adm-hoverable'}`}>
              <span className="min-w-0">
                <span className="block text-[13px] adm-t1 truncate">{r.name || 'Unnamed'}</span>
                <span className="block text-[11px] adm-t3 truncate">{r.email || r.phone || '—'} · {STATUS_LABEL[r.status] || r.status}</span>
              </span>
              {picked?.id === r.id && <Check size={15} className="text-[#2E1065] shrink-0" />}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="outline" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" disabled={!picked || busy} onClick={doMerge}>{busy ? 'Merging…' : 'Merge in'}</Btn>
        </div>
      </div>
    </div>
  );
}

function AddActivityMenu({ onPick }) {
  const [open, setOpen] = useState(false);
  const pick = (t) => { setOpen(false); onPick(t); };
  return (
    <div className="relative flex-1">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium adm-card adm-t2 adm-hoverable rounded-lg px-3 py-1.5">
        <Plus size={13} /> Add activity <ChevronDown size={13} className="adm-t3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-44 rounded-xl adm-card shadow-lg overflow-hidden">
            <button type="button" onClick={() => pick('note')} className="w-full text-left px-3 py-2 adm-hoverable text-[13px] adm-t1 flex items-center gap-2"><FileText size={14} className="adm-t3" /> Add note</button>
            <button type="button" onClick={() => pick('followup')} className="w-full text-left px-3 py-2 adm-hoverable text-[13px] adm-t1 flex items-center gap-2"><CalendarClock size={14} className="adm-t3" /> Schedule follow-up</button>
            <button type="button" onClick={() => pick('call')} className="w-full text-left px-3 py-2 adm-hoverable text-[13px] adm-t1 flex items-center gap-2"><Phone size={14} className="adm-t3" /> Log call</button>
            <button type="button" onClick={() => pick('merge')} className="w-full text-left px-3 py-2 adm-hoverable text-[13px] adm-t1 flex items-center gap-2"><GitMerge size={14} className="adm-t3" /> Merge duplicate</button>
          </div>
        </>
      )}
    </div>
  );
}

// Prominent single-channel action tile used in the "Quick actions" grid.
// color: wa/email/call = filled brand colour; size: sm (drawer) | lg (page).
function QuickAction({ icon: Icon, label, onClick, color = 'card', size = 'lg' }) {
  const palettes = {
    wa: 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600',
    email: 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600',
    call: 'bg-violet-500 text-white border-violet-500 hover:bg-violet-600',
    card: 'adm-card adm-t2 border-gray-200 hover:border-[#2E1065]',
  };
  const pad = size === 'sm' ? 'py-2 gap-1.5 text-[12px]' : 'py-3 gap-2 text-[13px]';
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center justify-center rounded-xl border font-semibold transition ${palettes[color] || palettes.card} ${pad}`}>
      <Icon size={size === 'sm' ? 15 : 18} />
      <span>{label}</span>
    </button>
  );
}

// ── Composer bits (shared) ────────────────────────────────────
function leadValueFor(key, lead) {
  const first = (lead.name || '').trim().split(/\s+/)[0] || '';
  const map = { first_name: first, name: lead.name || '', business_name: lead.business_name || '', profession: lead.profession || '', city: lead.city || '', email: lead.email || '', phone: lead.phone || '' };
  return map[key] ?? '';
}

function Combobox({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q ? options : options.filter((o) => (o.label + ' ' + (o.hint || '')).toLowerCase().includes(q));
  }, [options, query]);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="fb-input text-sm w-full text-left flex items-center justify-between">
        <span className={selected ? 'adm-t1' : 'adm-t3'}>{selected ? selected.label : (placeholder || 'Select…')}</span><span className="adm-t3">▾</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-xl adm-card shadow-lg max-h-64 overflow-auto">
          <div className="p-2 sticky top-0 adm-card"><input autoFocus className="fb-input text-sm w-full" placeholder="Search templates…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          {filtered.length === 0 ? <p className="px-3 py-2 text-[12px] adm-t3">No templates. Add some in Templates.</p> :
            filtered.map((o) => (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }} className="w-full text-left px-3 py-2 adm-hoverable">
                <p className="text-[13px] adm-t1">{o.label}</p>{o.hint && <p className="text-[11px] adm-t3">{o.hint}</p>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// note / call / follow-up keep the simple form. WhatsApp + Email now share ONE
// "Send message" flow: a template card grid (green = WhatsApp, blue = Email, told
// by the icon + colour) → click a card → a live preview with the lead's details
// already filled in → one Send. The send routes by the picked template's OWN
// channel, so the two entry points open the same unified picker.
function ActionModal({ type, lead, templates = [], onClose, onDone }) {
  const id = lead.id;
  const isMsg = type === 'wa' || type === 'email';
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState({ body: '', title: '', dueAt: '', outcome: '', durationMin: '', subject: '', html: '' });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  // message-mode state
  const [mView, setMView] = useState('grid');                                  // 'grid' | 'compose'
  const [chFilter, setChFilter] = useState(type === 'email' ? 'email' : 'wa'); // 'all' | 'wa' | 'email'
  const [q, setQ] = useState('');
  const [tplId, setTplId] = useState('');
  const [vars, setVars] = useState({});
  const tpl = templates.find((t) => t.id === tplId) || null;

  const gridTemplates = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return templates.filter((t) => {
      const okCh = chFilter === 'all' || t.channel === (chFilter === 'wa' ? 'whatsapp' : 'email');
      const okQ = !ql || `${t.label || ''} ${t.name || ''} ${t.subject || ''}`.toLowerCase().includes(ql);
      return okCh && okQ;
    });
  }, [templates, chFilter, q]);

  const openTpl = (t) => {
    setTplId(t.id);
    if (t.channel === 'whatsapp') { const seed = {}; (t.variables || []).forEach((d) => { seed[d.key] = leadValueFor(d.key, lead); }); setVars(seed); }
    else setV((s) => ({ ...s, subject: t.subject || '', html: t.body || '' }));
    setMView('compose');
  };

  // WhatsApp body preview with {{token}} filled from the (editable) vars.
  const waPreview = useMemo(() => {
    if (!tpl || tpl.channel !== 'whatsapp') return '';
    return String(tpl.body || tpl.label || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || `{{${k}}}`);
  }, [tpl, vars]);

  const sendMessage = async () => {
    if (!tpl) return;
    setBusy(true);
    try {
      if (tpl.channel === 'whatsapp') {
        const params = (tpl.variables || []).map((d) => vars[d.key] ?? '');
        const r = await crmSendWhatsApp(id, { templateKey: tpl.name, params });
        toast[r.data?.status === 'skipped' ? 'error' : 'success'](r.data?.status === 'skipped' ? `Skipped: ${r.data.error}` : 'WhatsApp queued');
      } else {
        if (!v.subject || !v.html) { toast.error('Subject and body required'); setBusy(false); return; }
        const r = await crmSendEmail(id, { subject: v.subject, html: v.html });
        toast[r.data?.status === 'skipped' ? 'error' : 'success'](r.data?.status === 'skipped' ? `Skipped: ${r.data.error}` : 'Email queued');
      }
      onDone();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); } finally { setBusy(false); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (type === 'note') await crmAddLeadNote(id, v.body);
      else if (type === 'call') await crmLogCall(id, { outcome: v.outcome, durationMin: Number(v.durationMin) || null, body: v.body });
      else if (type === 'followup') await crmCreateFollowUp(id, { title: v.title, dueAt: v.dueAt || new Date(Date.now() + 864e5).toISOString(), remind: true });
      toast.success('Saved'); onDone();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); } finally { setBusy(false); }
  };

  // ── WhatsApp + Email: unified template grid → preview → send ──
  if (isMsg) {
    const CH = [{ id: 'all', label: 'All' }, { id: 'wa', label: 'WhatsApp' }, { id: 'email', label: 'Email' }];
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <Card className="rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {mView === 'grid' ? (
            <>
              <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
                <div className="min-w-0">
                  <h2 className="font-bold adm-t1 text-[17px]">Send message</h2>
                  <p className="text-[12px] adm-t3 truncate">to <span className="adm-t2 font-medium">{lead.name || 'lead'}</span>{lead.phone ? ` · ${lead.phone}` : ''}{lead.email ? ` · ${lead.email}` : ''}</p>
                </div>
                <button onClick={onClose} className="ml-auto adm-t3 text-xl leading-none">×</button>
              </div>
              <div className="flex flex-wrap items-center gap-2 px-5 py-3">
                <div className="inline-flex bg-gray-50 border border-gray-200 rounded-lg p-0.5 gap-0.5">
                  {CH.map((c) => (
                    <button key={c.id} onClick={() => setChFilter(c.id)}
                      className={`text-[12px] font-medium px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 ${chFilter === c.id ? 'bg-white shadow-sm adm-t1' : 'adm-t2'}`}>
                      {c.id !== 'all' && <span className={`w-2 h-2 rounded-full ${c.id === 'wa' ? 'bg-emerald-500' : 'bg-blue-500'}`} />}{c.label}
                    </button>
                  ))}
                </div>
                <input className="fb-input text-sm flex-1 min-w-[160px]" placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-5 pb-5 overflow-auto">
                {gridTemplates.length === 0 ? (
                  <p className="col-span-full text-[13px] adm-t2 py-6 text-center">No templates{q ? ' match' : ''}. Add them in <a href="/admin/sales/templates" className="text-[#2E1065]">Templates</a>.</p>
                ) : gridTemplates.map((t) => {
                  const wa = t.channel === 'whatsapp';
                  const Icon = wa ? MessageCircle : Mail;
                  const nVar = (t.variables || []).length;
                  return (
                    <button key={t.id} type="button" onClick={() => openTpl(t)}
                      className="text-left rounded-xl border border-gray-200 bg-white p-3 transition hover:shadow-md hover:-translate-y-0.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-8 h-8 min-h-0 shrink-0 rounded-lg grid place-items-center ${wa ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}><Icon size={16} /></span>
                        <h3 className="text-[13.5px] font-bold adm-t1 leading-tight">{t.label || t.name}</h3>
                      </div>
                      <p className="mt-2 text-[11.5px] adm-t3 line-clamp-2">{wa ? (t.body || t.name || '') : (t.subject || t.body || '')}</p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="text-[10px] adm-t3 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">{wa ? `${nVar} var${nVar === 1 ? '' : 's'}` : 'Email'}</span>
                        <span className={`ml-auto inline-flex items-center gap-1 text-white text-[12px] font-bold px-3 py-1.5 rounded-lg ${wa ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                          Send <ArrowRight size={13} strokeWidth={2.5} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
                <button onClick={() => setMView('grid')} className="w-8 h-8 min-h-0 rounded-lg border border-gray-200 bg-gray-50 grid place-items-center adm-t2"><ArrowLeft size={16} /></button>
                <div className="min-w-0">
                  <h2 className="font-bold adm-t1 text-[16px] truncate">{tpl?.label || tpl?.name}</h2>
                  <p className="text-[12px] adm-t3">Preview exactly what the lead receives</p>
                </div>
                <button onClick={onClose} className="ml-auto adm-t3 text-xl leading-none">×</button>
              </div>
              <div className="px-5 py-4 overflow-auto space-y-4">
                {tpl && (() => {
                  const wa = tpl.channel === 'whatsapp';
                  return (
                    <>
                      <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${wa ? 'bg-emerald-50 border border-emerald-100' : 'bg-blue-50 border border-blue-100'}`}>
                        <span className={`w-8 h-8 rounded-lg grid place-items-center text-white ${wa ? 'bg-emerald-600' : 'bg-blue-600'}`}>{wa ? <MessageCircle size={16} /> : <Mail size={16} />}</span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold adm-t1">{wa ? 'WhatsApp' : 'Email'}</p>
                          <p className="text-[11px] adm-t3 truncate">to {wa ? (lead.phone || '—') : (lead.email || '—')}</p>
                        </div>
                      </div>

                      {wa ? (
                        <>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide adm-t3 mb-1.5">Message preview</p>
                            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-3 text-[13.5px] adm-t1 whitespace-pre-wrap leading-relaxed">{waPreview}</div>
                          </div>
                          {(tpl.variables || []).length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide adm-t3 mb-1.5">Filled from the lead — edit if needed</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {tpl.variables.map((d, i) => (
                                  <div key={d.key || i}>
                                    <label className="block text-[11px] font-medium adm-t2 mb-0.5">{d.label || d.key}</label>
                                    <input className="fb-input text-sm w-full" value={vars[d.key] ?? ''} placeholder={d.example || ''} onChange={(e) => setVars({ ...vars, [d.key]: e.target.value })} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide adm-t3 mb-1.5">Subject</p>
                            <input className="fb-input text-sm w-full" placeholder="Subject" value={v.subject} onChange={set('subject')} />
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide adm-t3 mb-1.5">Message</p>
                            <textarea className="fb-input text-sm w-full" rows={6} placeholder="Body — {{first_name}}, {{business_name}} supported" value={v.html} onChange={set('html')} />
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5 border-t border-gray-100">
                <p className="text-[11.5px] adm-t3">Queued through the send gate — off = recorded, not sent.</p>
                <button onClick={sendMessage} disabled={busy}
                  className={`ml-auto inline-flex items-center gap-2 text-white text-[13.5px] font-bold px-5 py-2.5 rounded-xl disabled:opacity-50 ${tpl?.channel === 'whatsapp' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {busy ? 'Sending…' : <>Send {tpl?.channel === 'whatsapp' ? 'WhatsApp' : 'email'} <ArrowRight size={15} strokeWidth={2.5} /></>}
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
    );
  }

  // ── note / call / follow-up (unchanged) ──
  const T = { note: 'Add note', call: 'Log call', followup: 'Add follow-up' }[type];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-auto">
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4"><h2 className="font-bold adm-t1">{T}</h2><button onClick={onClose} className="adm-t3 text-xl leading-none">×</button></div>
          <div className="space-y-3">
            {type === 'note' && <textarea className="fb-input text-sm w-full" rows={4} placeholder="Internal note…" value={v.body} onChange={set('body')} />}
            {type === 'call' && <>
              <input className="fb-input text-sm w-full" placeholder="Outcome (e.g. Interested)" value={v.outcome} onChange={set('outcome')} />
              <input className="fb-input text-sm w-full" placeholder="Duration (min)" value={v.durationMin} onChange={set('durationMin')} />
              <textarea className="fb-input text-sm w-full" rows={2} placeholder="Notes" value={v.body} onChange={set('body')} />
            </>}
            {type === 'followup' && <>
              <input className="fb-input text-sm w-full" placeholder="What to do" value={v.title} onChange={set('title')} />
              <input type="datetime-local" className="fb-input text-sm w-full" value={v.dueAt} onChange={set('dueAt')} />
            </>}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Btn variant="outline" size="sm" onClick={onClose}>Cancel</Btn>
            <Btn size="sm" onClick={submit} disabled={busy}>{busy ? 'Working…' : 'Confirm'}</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}
