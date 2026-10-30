// client/src/pages/admin/Host360Detail.jsx
// Admin "Host 360°" detail — a persistent host header + quick-action bar and
// seven ?tab=-driven panels (Overview, Usage, Billing, Timeline, Notes,
// Documents, Support). Each tab lazy-fetches its data on first activation and
// caches it in state so re-clicks don't refetch. Tab visibility + destructive
// actions are gated with sessionCan(). New api helpers (adminHost360*) are added
// separately in services/api.js.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  adminHost360Get, adminHost360Usage, adminHost360Billing, adminHost360Timeline,
  adminHost360Support, adminHost360Documents, adminHost360UploadDoc, adminHost360DeleteDoc,
  adminHost360RevealKyc,
  adminHost360Notes, adminHost360AddNote, adminHost360UpdateNote, adminHost360DeleteNote,
  adminHost360Suspend, adminHost360SetPlan, adminHost360AssignAm, adminHost360SendEmail,
  adminHost360Managers,
} from '../../services/api';
import toast from 'react-hot-toast';
import { PageHeader, Card, StatCard, Btn, Badge, Table, Skeleton } from '../../components/admin/ui';
import Ic from '../../components/admin/Ic';
import { sessionCan, IC } from '../../components/admin/adminNav';
import { normalizePlan, getPlanBorderLabel } from '../../utils/themeUtils';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const getSession = () => {
  try { return JSON.parse(localStorage.getItem('bas_admin') || 'null'); } catch { return null; }
};

// Tabs and the permission each needs. `key` is the ?tab= value.
const TABS = [
  { key: 'overview',  label: 'Overview',        perm: 'users.view' },
  { key: 'usage',     label: 'Usage & Adoption', perm: 'users.view' },
  { key: 'billing',   label: 'Billing & Revenue', perm: 'finance.view' },
  { key: 'timeline',  label: 'Timeline',        perm: 'users.view' },
  { key: 'notes',     label: 'Internal Notes',  perm: 'users.view' },
  { key: 'documents', label: 'Documents',       perm: 'kyc.view' },
  { key: 'support',   label: 'Support',         perm: 'support.view' },
];

// ── Small shared bits ────────────────────────────────────────────────────────
const AccessDenied = () => (
  <Card className="text-center py-10 adm-t3 text-sm">You don't have access to this section.</Card>
);
const EmptyText = ({ children }) => <p className="adm-t3 text-[13px] py-6 text-center">{children}</p>;
const TabSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-40 w-full" />
  </div>
);

// Generic modal shell (matches AdminProviders' edit-modal chrome).
const Modal = ({ title, onClose, children, footer }) => {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
};

const inputCls = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#960D32] focus:outline-none';

// ── Modals ───────────────────────────────────────────────────────────────────
const ChangePlanModal = ({ host, onClose, onDone }) => {
  const [plan, setPlan] = useState(normalizePlan(host.plan) || 'starter');
  const [expires, setExpires] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await adminHost360SetPlan(host.id, { plan_slug: plan, expires_at: expires || undefined });
      toast.success('Plan updated'); onDone(); onClose();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Change plan" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
        <Btn onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
      </>}>
      <label className="block">
        <span className="text-[12px] font-semibold text-gray-700">Plan</span>
        <select value={plan} onChange={e => setPlan(e.target.value)} className={inputCls}>
          <option value="starter">Starter</option>
          <option value="creator">Host+</option>
          <option value="professional">Studio</option>
          <option value="supreme">Supreme</option>
        </select>
      </label>
      <label className="block">
        <span className="text-[12px] font-semibold text-gray-700">Expires at</span>
        <span className="block text-[11px] text-gray-400">Optional — leave blank for no override.</span>
        <input type="date" value={expires} onChange={e => setExpires(e.target.value)} className={inputCls} />
      </label>
    </Modal>
  );
};

const AssignAmModal = ({ host, onClose, onDone }) => {
  const [managers, setManagers] = useState([]);
  const [amId, setAmId] = useState(host.account_manager?.id || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    (async () => {
      try { const { data } = await adminHost360Managers(); setManagers(data.managers || []); }
      catch { /* non-fatal */ }
    })();
  }, []);
  const submit = async () => {
    setSaving(true);
    try {
      await adminHost360AssignAm(host.id, { account_manager_id: amId || null });
      toast.success('Account manager assigned'); onDone(); onClose();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Assign account manager" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
        <Btn onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
      </>}>
      <label className="block">
        <span className="text-[12px] font-semibold text-gray-700">Account manager</span>
        <select value={amId} onChange={e => setAmId(e.target.value)} className={inputCls}>
          <option value="">— Unassigned —</option>
          {managers.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
        </select>
      </label>
    </Modal>
  );
};

const SendEmailModal = ({ host, onClose }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!subject.trim() || !body.trim()) { toast.error('Subject and body required'); return; }
    setSaving(true);
    try {
      await adminHost360SendEmail(host.id, { subject, body });
      toast.success('Email sent'); onClose();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={`Email ${host.name || 'host'}`} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
        <Btn onClick={submit} disabled={saving}>{saving ? 'Sending…' : 'Send'}</Btn>
      </>}>
      <label className="block">
        <span className="text-[12px] font-semibold text-gray-700">Subject</span>
        <input value={subject} onChange={e => setSubject(e.target.value)} className={inputCls} />
      </label>
      <label className="block">
        <span className="text-[12px] font-semibold text-gray-700">Body</span>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} className={inputCls} />
      </label>
    </Modal>
  );
};

// ── Tab panels ───────────────────────────────────────────────────────────────
// Each panel receives a `load` fn returning the payload; useTabData caches it.
const useTabData = (loadFn, active) => {
  const [state, setState] = useState({ loading: false, data: null, denied: false, error: false, done: false });
  useEffect(() => {
    if (!active || state.done) return;
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));
    loadFn()
      .then(({ data }) => { if (!cancelled) setState({ loading: false, data, denied: false, error: false, done: true }); })
      .catch((e) => {
        if (cancelled) return;
        const denied = e.response?.status === 403;
        if (!denied) toast.error('Failed to load');
        setState({ loading: false, data: null, denied, error: !denied, done: true });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return [state, setState];
};

const OverviewTab = ({ overview, goTab }) => {
  // Overview reuses the header's `overview` payload (counts/revenue/timeline/red_flags)
  // from adminHost360Get — no extra fetch needed.
  const counts = overview?.counts || {};
  const revenue = overview?.revenue || {};
  const timeline = overview?.recent_timeline || overview?.timeline || [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCard compact label="Services" value={counts.services ?? '—'} icon="layers" iconColor="bg-blue-500" to="?tab=usage" />
        <StatCard compact label="Bookings" value={counts.bookings ?? '—'} icon="calCheck" iconColor="bg-emerald-500" to="?tab=usage" />
        <StatCard compact label="Customers" value={counts.customers ?? '—'} icon="users" iconColor="bg-purple-500" to="?tab=usage" />
        <StatCard compact label="Revenue" value={inr(revenue.total ?? overview?.revenue_total)} icon="rupee" iconColor="bg-amber-500" to="?tab=billing" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold adm-t1">Recent activity</h3>
            <button onClick={() => goTab('timeline')} className="text-[11px] font-medium text-[#960D32]">View all</button>
          </div>
          {timeline.length === 0 ? <EmptyText>No recent events.</EmptyText> : (
            <ul className="space-y-2.5">
              {timeline.slice(0, 5).map((ev, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px]">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#960D32] flex-shrink-0" />
                  <div>
                    <p className="adm-t1">{ev.label || ev.type}</p>
                    <p className="adm-t3 text-[11px]">{fmtDateTime(ev.ts)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="text-[13px] font-bold adm-t1 mb-3">Health</h3>
          <div className="flex items-center justify-between mb-3 text-[13px]">
            <span className="adm-t2">Open support tickets</span>
            <Badge tone={(overview?.open_tickets || 0) > 0 ? 'warn' : 'ok'}>{overview?.open_tickets ?? 0}</Badge>
          </div>
          <p className="text-[12px] font-semibold adm-t3 uppercase tracking-wide mb-2">Red flags</p>
          {(!overview?.red_flags || overview.red_flags.length === 0) ? (
            <p className="adm-t3 text-[12.5px]">None.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {overview.red_flags.map((f, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-600">{f.label || f}</span>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const UsageTab = ({ hostId, active }) => {
  const [s] = useTabData(() => adminHost360Usage(hostId), active);
  if (s.loading) return <TabSkeleton />;
  if (s.denied) return <AccessDenied />;
  if (!s.data) return <EmptyText>Nothing to show.</EmptyText>;
  const { services = [], counts = {}, integrations = {} } = s.data;
  const intBadge = (on) => <Badge tone={on ? 'ok' : 'neutral'}>{on ? 'Connected' : 'Off'}</Badge>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Services" value={counts.services ?? services.length} icon="layers" iconColor="bg-blue-500" />
        <StatCard label="Bookings" value={counts.bookings ?? '—'} icon="calCheck" iconColor="bg-emerald-500" />
        <StatCard label="Customers" value={counts.customers ?? '—'} icon="users" iconColor="bg-purple-500" />
        <StatCard label="Reviews" value={counts.reviews ?? '—'} icon="star" iconColor="bg-amber-500" />
      </div>
      <Card>
        <h3 className="text-[13px] font-bold adm-t1 mb-3">Integrations</h3>
        <div className="flex flex-wrap gap-4 text-[13px]">
          <div className="flex items-center gap-2"><span className="adm-t2">Calendar</span>{intBadge(integrations.calendar)}</div>
          <div className="flex items-center gap-2"><span className="adm-t2">WhatsApp</span>{intBadge(integrations.whatsapp)}</div>
          <div className="flex items-center gap-2"><span className="adm-t2">Map link</span>{intBadge(integrations.map)}</div>
        </div>
      </Card>
      <Table
        columns={[
          { key: 'name', label: 'Service' },
          { key: 'price', label: 'Price', render: r => inr(r.price) },
          { key: 'bookings', label: 'Bookings', render: r => r.bookings ?? '—' },
          { key: 'status', label: 'Status', render: r => <Badge tone={r.is_active === false ? 'neutral' : 'ok'}>{r.is_active === false ? 'Inactive' : 'Active'}</Badge> },
        ]}
        rows={services}
        rowKey={r => r.id}
        empty={<EmptyText>No services yet.</EmptyText>}
      />
    </div>
  );
};

const BillingTab = ({ hostId, active }) => {
  const [s] = useTabData(() => adminHost360Billing(hostId), active);
  if (s.loading) return <TabSkeleton />;
  if (s.denied) return <AccessDenied />;
  if (!s.data) return <EmptyText>Nothing to show.</EmptyText>;
  const { plan, subscription, revenue = {}, payments = [], invoices = [], payouts = [] } = s.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Lifetime revenue" value={inr(revenue.total)} icon="rupee" iconColor="bg-amber-500" />
        <StatCard label="Collected" value={inr(revenue.collected)} icon="wallet" iconColor="bg-emerald-500" />
        <StatCard label="Refunded" value={inr(revenue.refunded)} icon="refresh" iconColor="bg-red-500" />
        <StatCard label="Payouts" value={inr(revenue.payouts)} icon="card" iconColor="bg-blue-500" />
      </div>
      <Card>
        <h3 className="text-[13px] font-bold adm-t1 mb-2">Plan & subscription</h3>
        <div className="grid sm:grid-cols-2 gap-y-1.5 text-[13px]">
          <div className="flex justify-between sm:pr-6"><span className="adm-t3">Plan</span><span className="adm-t1 font-medium">{getPlanBorderLabel(normalizePlan(plan))}</span></div>
          <div className="flex justify-between sm:pr-6"><span className="adm-t3">Status</span><span className="adm-t1">{subscription?.status || '—'}</span></div>
          <div className="flex justify-between sm:pr-6"><span className="adm-t3">Cadence</span><span className="adm-t1">{subscription?.cadence || '—'}</span></div>
          <div className="flex justify-between sm:pr-6"><span className="adm-t3">Renews</span><span className="adm-t1">{fmtDate(subscription?.current_period_end)}</span></div>
        </div>
      </Card>
      <div>
        <h3 className="text-[13px] font-bold adm-t1 mb-2">Payments</h3>
        <Table
          columns={[
            { key: 'created_at', label: 'Date', render: r => fmtDate(r.created_at) },
            { key: 'amount', label: 'Amount', render: r => inr(r.amount) },
            { key: 'type', label: 'Type' },
            { key: 'status', label: 'Status', render: r => <Badge tone={r.status === 'captured' || r.status === 'paid' ? 'ok' : 'neutral'}>{r.status}</Badge> },
          ]}
          rows={payments} rowKey={r => r.id} empty={<EmptyText>No payments.</EmptyText>} />
      </div>
      <div>
        <h3 className="text-[13px] font-bold adm-t1 mb-2">Invoices</h3>
        <Table
          columns={[
            { key: 'number', label: 'Number' },
            { key: 'created_at', label: 'Date', render: r => fmtDate(r.created_at) },
            { key: 'amount', label: 'Amount', render: r => inr(r.amount) },
            { key: 'url', label: '', render: r => r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-[#960D32] font-medium">Download</a> : '—' },
          ]}
          rows={invoices} rowKey={r => r.id} empty={<EmptyText>No invoices.</EmptyText>} />
      </div>
      <div>
        <h3 className="text-[13px] font-bold adm-t1 mb-2">Payouts</h3>
        <Table
          columns={[
            { key: 'created_at', label: 'Date', render: r => fmtDate(r.created_at) },
            { key: 'amount', label: 'Amount', render: r => inr(r.amount) },
            { key: 'status', label: 'Status', render: r => <Badge tone={r.status === 'processed' || r.status === 'paid' ? 'ok' : 'neutral'}>{r.status}</Badge> },
          ]}
          rows={payouts} rowKey={r => r.id} empty={<EmptyText>No payouts.</EmptyText>} />
      </div>
    </div>
  );
};

const TimelineTab = ({ hostId, active }) => {
  const [s, setS] = useTabData(() => adminHost360Timeline(hostId), active);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const { data } = await adminHost360Timeline(hostId, { before: s.data.nextBefore });
      setS(prev => ({ ...prev, data: { events: [...(prev.data.events || []), ...(data.events || [])], nextBefore: data.nextBefore } }));
    } catch { toast.error('Failed to load more'); }
    finally { setLoadingMore(false); }
  };
  if (s.loading) return <TabSkeleton />;
  if (s.denied) return <AccessDenied />;
  const events = s.data?.events || [];
  if (events.length === 0) return <EmptyText>No timeline events.</EmptyText>;
  return (
    <Card>
      <ul className="space-y-3">
        {events.map((ev, i) => (
          <li key={i} className="flex items-start gap-3 text-[13px]">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-[#960D32] flex-shrink-0" />
            <div className="min-w-0">
              <p className="adm-t1">{ev.label || ev.type}</p>
              <p className="adm-t3 text-[11px]">{fmtDateTime(ev.ts)}</p>
            </div>
          </li>
        ))}
      </ul>
      {s.data?.nextBefore && (
        <div className="mt-4 text-center">
          <Btn variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</Btn>
        </div>
      )}
    </Card>
  );
};

const NotesTab = ({ hostId, active }) => {
  const [s, setS] = useTabData(() => adminHost360Notes(hostId), active);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editBody, setEditBody] = useState('');

  const refetch = async () => {
    try { const { data } = await adminHost360Notes(hostId); setS(prev => ({ ...prev, data })); }
    catch { /* keep old list */ }
  };
  const add = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try { await adminHost360AddNote(hostId, { body: draft.trim() }); setDraft(''); await refetch(); toast.success('Note added'); }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };
  const saveEdit = async (id) => {
    try { await adminHost360UpdateNote(hostId, id, { body: editBody }); setEditId(null); await refetch(); toast.success('Saved'); }
    catch { toast.error('Failed'); }
  };
  const del = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try { await adminHost360DeleteNote(hostId, id); await refetch(); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  if (s.loading) return <TabSkeleton />;
  if (s.denied) return <AccessDenied />;
  const notes = s.data?.notes || [];
  return (
    <div className="space-y-4">
      <Card>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} placeholder="Add an internal note (never shown to the host)…"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#960D32] focus:outline-none" />
        <div className="mt-2 flex justify-end">
          <Btn size="sm" onClick={add} disabled={busy || !draft.trim()}>{busy ? 'Saving…' : 'Add note'}</Btn>
        </div>
      </Card>
      {notes.length === 0 ? <EmptyText>No notes yet.</EmptyText> : (
        <div className="space-y-2.5">
          {notes.map(n => (
            <Card key={n.id} className="!p-4">
              {editId === n.id ? (
                <>
                  <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={3}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#960D32] focus:outline-none" />
                  <div className="mt-2 flex justify-end gap-2">
                    <button onClick={() => setEditId(null)} className="text-[12px] font-medium text-gray-500">Cancel</button>
                    <Btn size="sm" onClick={() => saveEdit(n.id)}>Save</Btn>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] adm-t1 whitespace-pre-wrap">{n.body}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[11px] adm-t3">{n.admin_email || 'admin'} · {fmtDateTime(n.created_at)}</p>
                    <div className="flex gap-3">
                      <button onClick={() => { setEditId(n.id); setEditBody(n.body); }} className="text-[11px] font-medium text-gray-500 hover:text-gray-700">Edit</button>
                      <button onClick={() => del(n.id)} className="text-[11px] font-medium text-red-500 hover:text-red-600">Delete</button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// KYC identity block as a field/value table, with an eye toggle that swaps the
// masked values for the real ones.
//
// Revealing is a real de-masking: it calls a kyc.decide-gated endpoint that
// decrypts server-side and writes an audit row naming this admin. So it is an
// explicit click, never on mount, and the values are dropped from state on hide.
const KycCard = ({ hostId, kyc }) => {
  const canReveal = sessionCan(getSession(), 'kyc.decide');
  const [real, setReal] = useState(null);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (real) { setReal(null); return; }
    setBusy(true);
    try {
      const { data } = await adminHost360RevealKyc(hostId);
      setReal(data);
    } catch (e) { toast.error(e.response?.data?.message || 'Could not reveal'); }
    finally { setBusy(false); }
  };

  if (!kyc) {
    return (
      <Card>
        <h3 className="text-[13px] font-bold adm-t1 mb-3">KYC</h3>
        <EmptyText>No KYC submitted.</EmptyText>
      </Card>
    );
  }

  const rows = [
    ['Status', <Badge key="s" tone={kyc.status === 'approved' ? 'ok' : kyc.status === 'rejected' ? 'danger' : 'warn'}>{kyc.status}</Badge>],
    ['Full name', kyc.full_name || '—'],
    ['Phone', real?.phone || kyc.phone || '—'],
    ['PAN', real?.pan_number || kyc.pan_masked || '—'],
    ['Aadhaar', real?.aadhaar_number || kyc.aadhaar_masked || '—'],
    ['Bank account', real?.account_number || kyc.bank_masked || '—'],
    ['IFSC', real?.ifsc || kyc.ifsc || '—'],
    ['Submitted', fmtDate(kyc.created_at)],
    ['Reviewed', kyc.reviewed_at ? fmtDate(kyc.reviewed_at) : '—'],
  ];

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-bold adm-t1">KYC</h3>
        {canReveal && (
          <button onClick={toggle} disabled={busy}
            title={real ? 'Hide the full numbers' : 'Reveal the full numbers — this is recorded in the audit log'}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#960D32] disabled:opacity-50">
            <Ic d={IC.eye} size={13} />
            {busy ? 'Revealing…' : real ? 'Hide' : 'Reveal'}
          </button>
        )}
      </div>
      <table className="w-full text-[13px]">
        <tbody className="divide-y adm-border">
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="py-1.5 pr-4 adm-t3 whitespace-nowrap w-px">{label}</td>
              <td className={`py-1.5 adm-t1 text-right ${real ? 'font-mono' : ''}`}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {real && (
        <p className="mt-2 text-[10.5px] adm-t3">Full details shown. This reveal was recorded in the audit log.</p>
      )}
      {Array.isArray(kyc.documents) && kyc.documents.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 border-t adm-border pt-3">
          {kyc.documents.map((d, i) => (
            <a key={i} href={d.url} target="_blank" rel="noreferrer" className="text-[#960D32] text-[12px] font-medium">{d.label || `Document ${i + 1}`}</a>
          ))}
        </div>
      )}
    </Card>
  );
};

const DocumentsTab = ({ hostId, active }) => {
  const [s, setS] = useTabData(() => adminHost360Documents(hostId), active);
  const session = getSession();
  const canManage = sessionCan(session, 'documents.manage');
  const [busy, setBusy] = useState(false);

  const refetch = async () => {
    try { const { data } = await adminHost360Documents(hostId); setS(prev => ({ ...prev, data })); }
    catch { /* keep the old list */ }
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked after an error
    if (!file) return;
    setBusy(true);
    try { await adminHost360UploadDoc(hostId, file); await refetch(); toast.success('Document uploaded'); }
    catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    finally { setBusy(false); }
  };
  const remove = async (doc) => {
    if (!window.confirm(`Delete ${doc.name || 'this document'}? This cannot be undone.`)) return;
    try { await adminHost360DeleteDoc(hostId, doc.id); await refetch(); toast.success('Document deleted'); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  if (s.loading) return <TabSkeleton />;
  if (s.denied) return <AccessDenied />;
  if (!s.data) return <EmptyText>Nothing to show.</EmptyText>;
  const { kyc, documents = [], documents_locked } = s.data;
  return (
    <div className="space-y-4">
      <KycCard hostId={hostId} kyc={kyc} />
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-bold adm-t1">Documents</h3>
          {canManage && !documents_locked && (
            <label className={`text-[12px] font-medium ${busy ? 'adm-t3' : 'text-[#960D32] cursor-pointer'}`}>
              {busy ? 'Uploading…' : '+ Upload'}
              <input type="file" className="hidden" disabled={busy} onChange={upload}
                accept=".pdf,.jpg,.jpeg,.png,.webp" />
            </label>
          )}
        </div>
        {documents_locked ? (
          <Card className="text-center py-6 adm-t3 text-[13px]">
            You don't have access to this host's uploaded documents.
          </Card>
        ) : (
          <Table
            columns={[
              { key: 'name', label: 'Name', render: r => r.name || r.label || 'Document' },
              { key: 'doc_type', label: 'Type', render: r => r.doc_type || '—' },
              { key: 'created_at', label: 'Uploaded', render: r => fmtDate(r.created_at) },
              {
                key: 'url',
                label: '',
                render: r => (
                  <div className="flex justify-end gap-3">
                    {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-[#960D32] font-medium">Download</a>}
                    {canManage && <button onClick={() => remove(r)} className="font-medium text-red-500 hover:text-red-600">Delete</button>}
                  </div>
                ),
              },
            ]}
            rows={documents} rowKey={r => r.id}
            empty={<EmptyText>{canManage ? 'No documents yet. Upload contracts or signed agreements here.' : 'No documents.'}</EmptyText>} />
        )}
      </div>
    </div>
  );
};

const SupportTab = ({ hostId, active }) => {
  const [s] = useTabData(() => adminHost360Support(hostId), active);
  if (s.loading) return <TabSkeleton />;
  if (s.denied) return <AccessDenied />;
  const tickets = s.data?.tickets || [];
  return (
    <Table
      columns={[
        { key: 'created_at', label: 'Date', render: r => fmtDate(r.created_at) },
        { key: 'type', label: 'Type' },
        { key: 'area', label: 'Area' },
        { key: 'subject', label: 'Subject', render: r => r.id ? <a href={`/admin/feedback`} className="text-[#960D32] font-medium">{r.subject || '—'}</a> : (r.subject || '—') },
        { key: 'rating', label: 'Rating', render: r => r.rating ?? '—' },
        { key: 'status', label: 'Status', render: r => <Badge tone={r.status === 'open' ? 'warn' : r.status === 'resolved' ? 'ok' : 'neutral'}>{r.status}</Badge> },
      ]}
      rows={tickets} rowKey={r => r.id} empty={<EmptyText>No support tickets.</EmptyText>} />
  );
};

// ── Detail shell ─────────────────────────────────────────────────────────────
const Host360Detail = () => {
  const { hostId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const session = getSession();

  const visibleTabs = TABS.filter(t => sessionCan(session, t.perm));
  const requested = params.get('tab') || 'overview';
  // Fall back to overview if the requested tab is hidden for this admin.
  const activeTab = visibleTabs.some(t => t.key === requested) ? requested : 'overview';

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'plan' | 'am' | 'email'

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminHost360Get(hostId);
      // Flatten counts/revenue/etc alongside the host row for the header + overview tab.
      setOverview({ ...data.host, ...data, host: undefined });
    } catch (e) {
      toast.error('Failed to load host');
    } finally { setLoading(false); }
  }, [hostId]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const goTab = (key) => setParams(prev => { const p = new URLSearchParams(prev); p.set('tab', key); return p; });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!overview) return <Card className="text-center py-10 adm-t3 text-sm">Host not found.</Card>;

  const host = overview; // header fields live on the flattened object
  const status = host.is_banned ? <Badge tone="danger">Banned</Badge>
    : !host.is_verified ? <Badge tone="warn">Unverified</Badge>
    : <Badge tone="ok">Active</Badge>;

  const handleSuspend = async () => {
    const next = !host.is_banned;
    if (!window.confirm(`${next ? 'Suspend' : 'Reactivate'} ${host.name}?`)) return;
    try { await adminHost360Suspend(hostId, { suspend: next }); toast.success(next ? 'Suspended' : 'Reactivated'); loadOverview(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div>
      <PageHeader
        title={host.name || 'Host'}
        subtitle={host.email}
        actions={
          <div className="flex items-center gap-2">
            <Btn variant="ghost" size="sm" onClick={() => navigate('/admin/host360')}>← All hosts</Btn>
            {/* Seeing what the host's guests see is the most common jump off this
                page, so it sits in the header rather than in the action row. */}
            {host.username ? (
              <a href={`/${host.username}`} target="_blank" rel="noreferrer">
                <Btn size="sm" icon="external">View profile</Btn>
              </a>
            ) : (
              <Btn size="sm" icon="external" disabled title="This host hasn't claimed a username yet">View profile</Btn>
            )}
          </div>
        }
      />

      {/* Persistent header — metadata, so compact cards: small heading with the
          icon and value side by side rather than a full metric card each. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
        <StatCard compact label="Username" value={host.username ? `@${host.username}` : '—'} icon="userCheck" iconColor="bg-blue-500" />
        <StatCard compact label="Plan" value={getPlanBorderLabel(normalizePlan(host.plan))} icon="tag" iconColor="bg-purple-500" />
        <StatCard compact label="Joined" value={fmtDate(host.created_at)} icon="calendar" iconColor="bg-emerald-500" />
        <StatCard compact label="Renewal" value={fmtDate(host.plan_expires_at || host.current_period_end)} icon="clock" iconColor="bg-amber-500" />
      </div>
      {/* Label-over-value pairs read as a table, not a run-on sentence. */}
      <Card className="mb-4">
        <table className="w-full text-[13px]">
          <tbody>
            <tr>
              {['Status', 'Verification', 'Account manager'].map(h => (
                <th key={h} className="w-1/3 pb-1 text-left text-[10px] font-semibold adm-t3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
            <tr>
              <td className="pt-0.5">{status}</td>
              <td className="pt-0.5">
                <Badge tone={host.is_verified ? 'ok' : 'warn'}>{host.is_verified ? 'Verified' : 'Unverified'}</Badge>
              </td>
              <td className="pt-0.5 adm-t1 font-medium">
                {host.account_manager?.name || overview.account_manager?.name || '—'}
              </td>
            </tr>
          </tbody>
        </table>
        {Array.isArray(host.red_flags) && host.red_flags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {host.red_flags.map((f, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-600">{f.label || f}</span>
            ))}
          </div>
        )}
      </Card>

      {/* Quick actions */}
      <div className="mb-5 flex flex-wrap gap-2">
        {sessionCan(session, 'users.edit') && (
          <Btn variant="outline" size="sm" icon="ban" onClick={handleSuspend}>{host.is_banned ? 'Reactivate' : 'Suspend'}</Btn>
        )}
        {sessionCan(session, 'plans.manage') && (
          <Btn variant="outline" size="sm" icon="tag" onClick={() => setModal('plan')}>Change plan</Btn>
        )}
        {sessionCan(session, 'users.edit') && (
          <Btn variant="outline" size="sm" icon="userCheck" onClick={() => setModal('am')}>Assign manager</Btn>
        )}
        {sessionCan(session, 'email.manage') && (
          <Btn variant="outline" size="sm" icon="mail" onClick={() => setModal('email')}>Send email</Btn>
        )}
        <Btn variant="outline" size="sm" icon="pencil" onClick={() => goTab('notes')}>Add note</Btn>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 adm-card rounded-xl p-1 w-fit">
        {visibleTabs.map(t => (
          <button key={t.key} onClick={() => goTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all
              ${activeTab === t.key ? 'bg-[#960D32] text-white' : 'adm-t2 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Panels — each mounts only when its tab is active; useTabData lazy-fetches once. */}
      {activeTab === 'overview'  && <OverviewTab overview={overview} goTab={goTab} />}
      {activeTab === 'usage'     && <UsageTab hostId={hostId} active />}
      {activeTab === 'billing'   && <BillingTab hostId={hostId} active />}
      {activeTab === 'timeline'  && <TimelineTab hostId={hostId} active />}
      {activeTab === 'notes'     && <NotesTab hostId={hostId} active />}
      {activeTab === 'documents' && <DocumentsTab hostId={hostId} active />}
      {activeTab === 'support'   && <SupportTab hostId={hostId} active />}

      {modal === 'plan'  && <ChangePlanModal host={host} onClose={() => setModal(null)} onDone={loadOverview} />}
      {modal === 'am'    && <AssignAmModal host={host} onClose={() => setModal(null)} onDone={loadOverview} />}
      {modal === 'email' && <SendEmailModal host={host} onClose={() => setModal(null)} />}
    </div>
  );
};

export default Host360Detail;
