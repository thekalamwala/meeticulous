import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  adminListPlans, adminCreatePlan, adminUpdatePlan, adminArchivePlan,
  adminRestorePlan, adminClonePlan, adminReorderPlans, adminAssignPlan, adminGetUsers,
} from '../../services/api';
import { PageHeader, Card, Btn, Badge } from '../../components/admin/ui';
import { normalizePlan, getPlanBorderLabel } from '../../utils/themeUtils';

const LIMIT_KEYS = [
  ['services', 'Services'],
  ['bookings_per_year', 'Bookings / year'],
  ['digital_products', 'Digital products'],
  ['categories', 'Service categories'],
  ['calendar_integrations', 'Calendar integrations'],
  ['profile_theme_colors', 'Theme colors'],
  ['reminder_flows', 'Reminder flows'],
  ['followup_flows', 'Follow-up flows'],
  ['free_services', 'Free services'],
];

const FEATURE_KEYS = [
  'booking_page', 'online_appointments', 'offline_appointments', 'payment_collection',
  'email_notifications', 'whatsapp_notifications', 'booking_confirmation', 'booking_cancellation',
  'booking_completion_notifications', 'client_records', 'booking_history', 'client_history',
  'auto_invoices', 'invoice_history', 'basic_reports', 'advanced_reports', 'client_notes', 'data_export',
  'multiple_schedules', 'priority_feature_access', 'custom_fields', 'recurring_clients',
];

const CALENDAR_APPS = ['google_calendar', 'zoom', 'ical'];

// RBI: auto-debit e-mandates run without per-charge re-auth only under ₹15,000.
// gross = price + 18% GST; warn admins when a cadence crosses the ceiling.
const AUTO_DEBIT_THRESHOLD = 15000;
const grossWithGst = (price) => Math.round((Number(price) || 0) * 1.18);

const EMPTY_PLAN = {
  name: '', annual_price: 0, monthly_price: 0, billing_cycle: 'yearly', commission_percentage: 0,
  support_type: 'standard',
  limits: Object.fromEntries(LIMIT_KEYS.map(([k]) => [k, 0])),
  features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, false])),
  integrations: { calendar_apps: ['google_calendar'] },
  active: true,
};

const AdminPlans = () => {
  const [plans, setPlans] = useState([]);
  const [rules, setRules] = useState({ min_active_plans: 2, max_active_plans: 3 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // plan object or 'new'
  const [form, setForm] = useState(EMPTY_PLAN);
  const [saving, setSaving] = useState(false);

  // assignment
  const [assignQuery, setAssignQuery] = useState('');
  const [assignResults, setAssignResults] = useState([]);
  const [assignPlanSlug, setAssignPlanSlug] = useState('');
  const [assignReason, setAssignReason] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adminListPlans()
      .then((r) => { setPlans(r.data.plans); setRules(r.data.rules); })
      .catch(() => toast.error('Failed to load plans'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (plan) => {
    setEditing(plan);
    setForm(plan === 'new' ? EMPTY_PLAN : {
      name: plan.name,
      annual_price: Number(plan.annual_price),
      monthly_price: Number(plan.monthly_price) || 0,
      billing_cycle: plan.billing_cycle || 'yearly',
      commission_percentage: Number(plan.commission_percentage),
      support_type: plan.support_type || 'standard',
      limits: { ...EMPTY_PLAN.limits, ...(plan.limits || {}) },
      features: { ...EMPTY_PLAN.features, ...(plan.features || {}) },
      integrations: { calendar_apps: plan.integrations?.calendar_apps || [], ...(plan.integrations || {}) },
      active: plan.active,
    });
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Plan name is required');
    setSaving(true);
    try {
      if (editing === 'new') {
        await adminCreatePlan(form);
        toast.success('Plan created');
      } else {
        await adminUpdatePlan(editing.id, form);
        toast.success('Plan updated — applies to all checks immediately');
      }
      setEditing(null); load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const archive = async (plan) => {
    try {
      await (plan.active ? adminArchivePlan(plan.id) : adminRestorePlan(plan.id));
      toast.success(plan.active ? 'Plan archived' : 'Plan restored');
      load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Action failed'); }
  };

  const clone = async (plan) => {
    try {
      await adminClonePlan(plan.id);
      toast.success('Plan cloned (inactive — edit and activate it)');
      load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Clone failed'); }
  };

  const move = async (index, dir) => {
    const next = [...plans];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setPlans(next);
    try { await adminReorderPlans(next.map((p) => p.id)); } catch { toast.error('Reorder failed'); load(); }
  };

  const searchVendors = async () => {
    if (!assignQuery.trim()) return;
    try {
      const r = await adminGetUsers({ search: assignQuery });
      const rows = Array.isArray(r.data) ? r.data : r.data?.users || [];
      setAssignResults(rows.filter((u) => u.role === 'host').slice(0, 6));
    } catch { toast.error('Search failed'); }
  };

  const assign = async (vendor) => {
    if (!assignPlanSlug) return toast.error('Select a plan first');
    if (!window.confirm(`Move ${vendor.name} to "${assignPlanSlug}"?`)) return;
    try {
      const r = await adminAssignPlan({ vendor_id: vendor.id, plan_slug: assignPlanSlug, reason: assignReason.trim() || undefined });
      toast.success(r.data.message);
      setAssignReason('');
      load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Assignment failed'); }
  };

  const activeCount = plans.filter((p) => p.active).length;

  return (
    <div>
      <PageHeader title="Subscription Plans"
        subtitle={`Database-driven — changes apply without deployment · ${activeCount} active (min ${rules.min_active_plans}, max ${rules.max_active_plans})`}
        actions={<Btn size="sm" onClick={() => openEdit('new')}>+ New Plan</Btn>} />

      {loading ? <p className="text-center text-sm adm-t3 py-10">Loading…</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {plans.map((plan, i) => (
            <Card key={plan.id} className={!plan.active ? 'opacity-60' : ''}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-base font-bold adm-t1">{plan.name}</p>
                  <p className="text-xs adm-t3 font-mono">{plan.slug}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={plan.active ? 'ok' : 'warn'}>{plan.active ? 'ACTIVE' : 'ARCHIVED'}</Badge>
                  <div className="flex gap-0.5">
                    <button onClick={() => move(i, -1)} title="Move up" className="adm-t3 hover:text-[color:var(--adm-text-2)] px-1">↑</button>
                    <button onClick={() => move(i, 1)} title="Move down" className="adm-t3 hover:text-[color:var(--adm-text-2)] px-1">↓</button>
                  </div>
                </div>
              </div>
              <p className="text-2xl font-extrabold adm-t1 mb-0.5">₹{Number(plan.annual_price).toLocaleString('en-IN')}<span className="text-xs font-medium adm-t3"> / year</span></p>
              <p className="text-sm font-bold adm-t2 mb-1">{Number(plan.monthly_price) > 0 ? <>₹{Number(plan.monthly_price).toLocaleString('en-IN')}<span className="text-xs font-medium adm-t3"> / month</span></> : <span className="text-xs font-medium adm-t3">no monthly price set</span>}</p>
              <p className="text-xs adm-t2 mb-3">Commission: <strong>{Number(plan.commission_percentage)}%</strong> · {plan.subscriber_count} subscriber{plan.subscriber_count === 1 ? '' : 's'}</p>
              <div className="text-xs adm-t2 space-y-1 border-t adm-border pt-3 mb-4">
                {LIMIT_KEYS.map(([k, label]) => (
                  <div key={k} className="flex justify-between">
                    <span className="adm-t3">{label}</span>
                    <span className="font-semibold">{plan.limits?.[k] === -1 ? 'Unlimited' : (plan.limits?.[k] ?? 0)}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <span className="adm-t3">Calendars</span>
                  <span className="font-semibold">{(plan.integrations?.calendar_apps || []).join(', ') || '—'}</span>
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <Btn variant="outline" size="sm" className="flex-1" onClick={() => openEdit(plan)}>Edit</Btn>
                <Btn variant="outline" size="sm" className="flex-1" onClick={() => clone(plan)}>Clone</Btn>
                <Btn variant="outline" size="sm" className={`flex-1 ${plan.active ? '!text-amber-600' : '!text-emerald-600'}`} onClick={() => archive(plan)}>
                  {plan.active ? 'Archive' : 'Restore'}
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Manual assignment */}
      <Card className="max-w-2xl">
        <h2 className="text-sm font-bold adm-t1 mb-1">Assign Plan to Host</h2>
        <p className="text-xs adm-t3 mb-3">Manual override for comp plans and support resolutions — activates immediately, 1-year expiry for paid plans.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <input className="fb-input text-sm flex-1 min-w-[200px]" placeholder="Search host by name/email…"
            value={assignQuery} onChange={(e) => setAssignQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchVendors()} />
          <select className="fb-input text-sm w-44" value={assignPlanSlug} onChange={(e) => setAssignPlanSlug(e.target.value)}>
            <option value="">Target plan…</option>
            {/* Active plans + hidden bypass tiers (Supreme): assignable here only.
                Supreme stays active=false so it's invisible everywhere else. */}
            {plans.filter((p) => p.active || p.bypasses_kill_switches).map((p) => <option key={p.id} value={p.slug}>{p.name}{p.bypasses_kill_switches ? ' (hidden)' : ''}</option>)}
          </select>
          <Btn variant="outline" size="sm" onClick={searchVendors}>Search</Btn>
        </div>
        <input className="fb-input text-sm w-full mb-3" placeholder="Reason (optional) — saved to the audit log"
          value={assignReason} onChange={(e) => setAssignReason(e.target.value)} />
        <div className="space-y-1.5">
          {assignResults.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-[var(--adm-hover)]">
              <span className="adm-t2">{v.name} <span className="text-xs adm-t3">({v.email}) — current: {getPlanBorderLabel(normalizePlan(v.plan))}</span></span>
              <button onClick={() => assign(v)} className="text-xs font-bold text-indigo-600 hover:underline">Assign</button>
            </div>
          ))}
        </div>
      </Card>

      {/* Edit / create modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8" onClick={() => setEditing(null)}>
          <div className="adm-card rounded-2xl w-full max-w-2xl p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold adm-t1 mb-4">{editing === 'new' ? 'Create Plan' : `Edit — ${editing.name}`}</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="col-span-2"><label className="block text-xs font-semibold adm-t3 mb-1">Name</label>
                <input className="fb-input text-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="block text-xs font-semibold adm-t3 mb-1">Price (₹/yr)</label>
                <input type="number" min="0" className="fb-input text-sm" value={form.annual_price}
                  onChange={(e) => setForm((f) => ({ ...f, annual_price: Number(e.target.value) }))} /></div>
              <div><label className="block text-xs font-semibold adm-t3 mb-1">Price (₹/mo)</label>
                <input type="number" min="0" className="fb-input text-sm" value={form.monthly_price}
                  onChange={(e) => setForm((f) => ({ ...f, monthly_price: Number(e.target.value) }))} /></div>
              <div><label className="block text-xs font-semibold adm-t3 mb-1">Commission %</label>
                <input type="number" min="0" max="100" step="0.5" className="fb-input text-sm" value={form.commission_percentage}
                  onChange={(e) => setForm((f) => ({ ...f, commission_percentage: Number(e.target.value) }))} /></div>
            </div>

            {(grossWithGst(form.annual_price) > AUTO_DEBIT_THRESHOLD || grossWithGst(form.monthly_price) > AUTO_DEBIT_THRESHOLD) && (
              <div className="mb-4 -mt-1 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠ A cadence gross (price + 18% GST) exceeds ₹{AUTO_DEBIT_THRESHOLD.toLocaleString('en-IN')}.
                Above this, RBI requires the host to approve <strong>every</strong> auto-debit — auto-renew won't be frictionless for that cadence.
              </div>
            )}

            <p className="text-xs font-bold adm-t3 uppercase tracking-wider mb-2">Limits <span className="normal-case font-normal">(-1 = unlimited)</span></p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {LIMIT_KEYS.map(([k, label]) => (
                <div key={k}><label className="block text-[10px] font-semibold adm-t3 mb-1">{label}</label>
                  <input type="number" min="-1" className="fb-input text-sm" value={form.limits[k] ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, limits: { ...f.limits, [k]: Number(e.target.value) } }))} /></div>
              ))}
            </div>

            <p className="text-xs font-bold adm-t3 uppercase tracking-wider mb-2">Calendar integrations</p>
            <div className="flex gap-4 mb-4">
              {CALENDAR_APPS.map((app) => (
                <label key={app} className="flex items-center gap-1.5 text-sm adm-t2">
                  <input type="checkbox" checked={(form.integrations.calendar_apps || []).includes(app)}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      integrations: {
                        ...f.integrations,
                        calendar_apps: e.target.checked
                          ? [...(f.integrations.calendar_apps || []), app]
                          : (f.integrations.calendar_apps || []).filter((a) => a !== app),
                      },
                    }))} />
                  {app.replace('_', ' ')}
                </label>
              ))}
            </div>

            <p className="text-xs font-bold adm-t3 uppercase tracking-wider mb-2">Feature toggles</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 mb-4 text-[12px] adm-t2">
              {FEATURE_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={!!form.features[k]}
                    onChange={(e) => setForm((f) => ({ ...f, features: { ...f.features, [k]: e.target.checked } }))} />
                  {k.replace(/_/g, ' ')}
                </label>
              ))}
            </div>

            <div className="mb-4"><label className="block text-xs font-semibold adm-t3 mb-1">Support type</label>
              <select className="fb-input text-sm w-56" value={form.support_type} onChange={(e) => setForm((f) => ({ ...f, support_type: e.target.value }))}>
                <option value="standard">Standard</option>
                <option value="priority_email">Priority email</option>
                <option value="priority">Priority</option>
              </select></div>

            <div className="flex justify-end gap-2 pt-4 border-t adm-border">
              <Btn variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Btn>
              <Btn size="sm" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save Plan'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPlans;
