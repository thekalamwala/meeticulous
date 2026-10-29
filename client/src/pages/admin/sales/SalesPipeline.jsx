import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, Mail, MessageCircle } from 'lucide-react';
import { PageHeader, Card } from '../../../components/admin/ui';
import { crmListLeads, crmSetStatus, crmListFollowUps, adminListStaff } from '../../../services/api';
import { BOARDS, STATUS_LABEL, needsReason, relTime } from './salesConstants';
import ReasonModal from './ReasonModal';
import toast from 'react-hot-toast';

const PER_COL = 50;

// Where the card's Email / WhatsApp actions point — the team's shared inboxes,
// not a per-lead deep link (leads are worked from these two consoles).
const GMAIL_URL = 'https://mail.google.com/mail/u/1/#inbox';
const AISENSY_URL = 'https://www.app.aisensy.com/projects/6a1a56d8d44ba264bf5109a2/contacts';

const copyPhone = async (phone) => {
  if (!phone) return toast.error('No number on this lead');
  try { await navigator.clipboard.writeText(phone); toast.success(`Copied ${phone}`); }
  catch { toast.error('Copy failed'); }
};

// Compact action row on each lead card — Call (copies number) / Email / WhatsApp.
const ActionBtn = ({ icon: Icon, label, title, onClick, className = '' }) => (
  <button type="button" title={title} onClick={onClick}
    className={`flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium adm-t2 hover:adm-t1 hover:bg-black/[0.04] transition ${className}`}>
    <Icon size={13} strokeWidth={2} className="adm-t3" />
    {label}
  </button>
);

// The pipeline — four team-owned boards over one lead record. Switch boards with
// the tabs; drag a card between the active board's stages to move it. Guests are
// excluded (lead_type=host). A backward or exit drag opens the reason modal.
export default function SalesPipeline() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const boardKey = BOARDS.some((b) => b.key === sp.get('board')) ? sp.get('board') : 'presale';
  const board = BOARDS.find((b) => b.key === boardKey);

  const [cols, setCols] = useState({});          // status -> { rows, total }
  const [followMap, setFollowMap] = useState({});
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(null);
  const [reason, setReason] = useState(null);    // { id, from, to, name } | null
  const [reasonBusy, setReasonBusy] = useState(false);

  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);

  const load = () => {
    setLoading(true);
    Promise.all([
      // Each column may gather more than one status (e.g. Contacted also holds
      // Responded/replied) — fetch them all and merge into the column's bucket.
      Promise.all(board.columns.map(async (c) => {
        const parts = await Promise.all(c.statuses.map((s) =>
          crmListLeads({ status: s, leadType: 'host', pageSize: PER_COL })
            .then(({ data }) => data).catch(() => ({ rows: [], total: 0 }))));
        return [c.key, { rows: parts.flatMap((p) => p.rows || []), total: parts.reduce((a, p) => a + (p.total || 0), 0) }];
      })),
      crmListFollowUps({}).then(({ data }) => data).catch(() => []),
    ]).then(([pairs, fu]) => {
      setCols(Object.fromEntries(pairs));
      const m = {}; (Array.isArray(fu) ? fu : []).forEach((f) => { if (!m[f.lead_id] || f.due_at < m[f.lead_id]) m[f.lead_id] = f.due_at; });
      setFollowMap(m);
    }).finally(() => setLoading(false));
  };
  // Reload whenever the active board changes.
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [boardKey]);
  // Staff list once, for owner display + assignment.
  useEffect(() => {
    adminListStaff().then(({ data }) => setStaff((Array.isArray(data) ? data : data?.staff || []).filter((s) => s.is_active !== false)))
      .catch(() => setStaff([]));
  }, []);

  // Optimistically move a card between columns, then persist. Returns a revert fn.
  const applyMove = (id, from, to) => {
    const lead = (cols[from]?.rows || []).find((r) => r.id === id);
    if (!lead) return null;
    setCols((c) => ({
      ...c,
      [from]: { rows: c[from].rows.filter((r) => r.id !== id), total: Math.max(0, (c[from].total || 1) - 1) },
      [to]: { rows: [{ ...lead, status: to }, ...(c[to]?.rows || [])], total: (c[to]?.total || 0) + 1 },
    }));
    return lead;
  };

  const commitMove = async (id, to, lead, moveReason) => {
    try { await crmSetStatus(id, to, moveReason); toast.success(`${lead.name || 'Lead'} → ${STATUS_LABEL[to]}`); }
    catch (e) { toast.error(e?.response?.data?.message || 'Move failed'); load(); }
  };

  const onDrop = async (toKey) => {
    setDragOver(null);
    const raw = window.__crmDrag; window.__crmDrag = null;
    if (!raw || raw.fromCol === toKey) return;            // dropped on its own column
    const { id, from, fromCol } = raw;                    // from = the lead's real status; fromCol = the column it sat in
    const lead = applyMove(id, fromCol, toKey);
    if (!lead) return;
    if (needsReason(from, toKey)) {
      setReason({ id, from, to: toKey, name: lead.name, _lead: lead });   // hold for the modal
    } else {
      commitMove(id, toKey, lead);
    }
  };

  const confirmReason = async (text) => {
    if (!reason) return;
    setReasonBusy(true);
    await commitMove(reason.id, reason.to, reason._lead, text);
    setReasonBusy(false);
    setReason(null);
  };
  const cancelReason = () => { setReason(null); load(); };   // revert the optimistic move

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Pipeline" subtitle={`${board.label} · owned by ${board.owner}. Drag a lead between stages to move it; a backward or exit move asks for a reason.`} />

      {/* Board switcher */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {BOARDS.map((b) => {
          const active = b.key === boardKey;
          return (
            <button key={b.key} type="button"
              onClick={() => setSp({ board: b.key }, { replace: true })}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition ${active ? 'text-white border-transparent' : 'adm-t2 border-[var(--adm-line,#e5e7eb)] hover:bg-black/5'}`}
              style={active ? { background: b.accent } : { borderLeft: `3px solid ${b.accent}` }}>
              {b.label}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] adm-t3 mb-3 md:hidden">On mobile, open a lead to change its stage (drag-drop needs a mouse).</p>

      {loading ? <p className="adm-t3">Loading…</p> : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {/* Columns stretch (flex-1) to fill the width so 4–5 boards fit a wide
              screen with no horizontal scroll; the min-width only bites (and
              re-enables scroll) on narrow viewports. */}
          {board.columns.map((c) => {
            const col = cols[c.key] || { rows: [], total: 0 };
            const isOver = dragOver === c.key;
            return (
              <div key={c.key} className={`flex-1 min-w-[220px] max-w-[270px] rounded-xl p-1 transition ${isOver ? 'ring-1' : ''}`}
                style={isOver ? { background: `${board.accent}14`, boxShadow: `inset 0 0 0 1px ${board.accent}66` } : undefined}
                onDragOver={(e) => { e.preventDefault(); setDragOver(c.key); }}
                onDragLeave={() => setDragOver((d) => (d === c.key ? null : d))}
                onDrop={() => onDrop(c.key)}>
                <div className="flex items-center justify-between mb-2 px-2 pt-1">
                  <h3 className="text-[12px] font-bold adm-t1 uppercase tracking-wide flex items-center gap-1">
                    {c.label}{c.handoff && <span title="Shared handoff column" className="adm-t3 font-normal">↗</span>}
                  </h3>
                  <span className="text-[11px] adm-t3">{col.total}</span>
                </div>
                <div className="space-y-2 min-h-[40px]">
                  {col.rows.length === 0 && <p className="text-[11px] adm-t3 px-2">—</p>}
                  {col.rows.map((r) => {
                    const due = followMap[r.id]; const overdue = due && new Date(due) < new Date();
                    const owner = r.owner_admin_id ? staffById[r.owner_admin_id] : null;
                    return (
                      <Card key={r.id} className="rounded p-1.5 overflow-hidden cursor-grab active:cursor-grabbing adm-hoverable"
                        draggable
                        onDragStart={() => { window.__crmDrag = { id: r.id, from: r.status, fromCol: c.key }; }}
                        onClick={() => nav(`/admin/sales/leads/${r.id}`)}>
                        {/* Name (primary) + recency */}
                        <div className="flex items-baseline gap-2">
                          <p className="text-[13px] font-semibold adm-t1 truncate flex-1 leading-tight">{r.name || 'Unnamed'}</p>
                          <span className="text-[10px] adm-t3 shrink-0">{relTime(r.last_activity_at || r.created_at)}</span>
                        </div>
                        {/* Status (secondary) — only when the card sits outside its own stage */}
                        {r.status !== c.key && (
                          <span className="inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${board.accent}1a`, color: board.accent }}>{STATUS_LABEL[r.status]}</span>
                        )}
                        {/* Last activity + owner — quiet, scannable */}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className={`text-[10px] truncate ${overdue ? 'text-red-500 font-medium' : 'adm-t3'}`}>
                            {due ? `Follow-up ${relTime(due)}` : `Last activity · ${relTime(r.last_activity_at || r.created_at)}`}
                          </span>
                          {owner && <span title={owner.name} className="text-[10px] adm-t3 shrink-0 truncate max-w-[84px]">{(owner.name || '').split(' ')[0]}</span>}
                        </div>
                        {/* Actions — flush to the card edges */}
                        <div className="mt-1.5 -mx-1.5 -mb-1.5 grid grid-cols-3 border-t border-[var(--adm-line,#eef0f3)]" onClick={(e) => e.stopPropagation()}>
                          <ActionBtn icon={Phone} label="Call" title="Copy number" onClick={() => copyPhone(r.phone)} />
                          <ActionBtn icon={Mail} label="Email" title="Open Gmail" className="border-x border-[var(--adm-line,#eef0f3)]" onClick={() => window.open(GMAIL_URL, '_blank', 'noopener,noreferrer')} />
                          <ActionBtn icon={MessageCircle} label="WhatsApp" title="Open AiSensy" onClick={() => window.open(AISENSY_URL, '_blank', 'noopener,noreferrer')} />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ReasonModal open={reason} onConfirm={confirmReason} onCancel={cancelReason} busy={reasonBusy} />
    </div>
  );
}
