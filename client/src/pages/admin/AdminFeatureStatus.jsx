import { useEffect, useMemo, useState } from 'react';
import { adminGetFeatures, adminToggleFeature, adminCreateFeature } from '../../services/api';
import toast from 'react-hot-toast';
import { PageHeader, Card, Btn } from '../../components/admin/ui';

const SCOPE_LABEL = { vendor: 'Host', customer: 'Customer', both: 'Shared' };
const SCOPE_ORDER = ['vendor', 'customer', 'both'];

const emptyNew = { key: '', label: '', description: '', category: '', scope: 'both' };

export default function AdminFeatureStatus() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyNew);
  const [creating, setCreating] = useState(false);

  const load = () =>
    adminGetFeatures()
      .then(({ data }) => setFlags(Array.isArray(data) ? data : []))
      .catch(() => setFlags([]))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const toggle = async (f) => {
    const next = !f.enabled;
    setBusy(f.key);
    setFlags((fs) => fs.map((x) => (x.key === f.key ? { ...x, enabled: next } : x)));
    try {
      await adminToggleFeature(f.key, next);
      toast.success(`${f.label} ${next ? 'enabled' : 'disabled'}`);
    } catch (e) {
      setFlags((fs) => fs.map((x) => (x.key === f.key ? { ...x, enabled: f.enabled } : x)));
      toast.error('Could not update');
    } finally {
      setBusy(null);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!form.key.trim() || !form.label.trim()) {
      toast.error('Key and label are required');
      return;
    }
    setCreating(true);
    try {
      const { data } = await adminCreateFeature(form);
      setFlags((fs) => [...fs, data].sort((a, b) => a.key.localeCompare(b.key)));
      toast.success(`Switch "${data.label}" created (ON)`);
      setForm(emptyNew);
      setShowNew(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create switch');
    } finally {
      setCreating(false);
    }
  };

  // Group flags by scope, then category, for a scannable layout.
  const groups = useMemo(() => {
    const byScope = {};
    for (const f of flags) {
      const s = SCOPE_ORDER.includes(f.scope) ? f.scope : 'both';
      (byScope[s] = byScope[s] || []).push(f);
    }
    return SCOPE_ORDER
      .filter((s) => byScope[s]?.length)
      .map((s) => ({ scope: s, items: byScope[s] }));
  }, [flags]);

  const Switch = ({ f }) => (
    <Card className="flex items-start justify-between gap-4 rounded-xl p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold adm-t1">{f.label}</p>
          {f.category && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full adm-chip">{f.category}</span>
          )}
          <code className="text-[10px] adm-t3">{f.key}</code>
        </div>
        <p className="text-sm adm-t2 mt-0.5">{f.description}</p>
      </div>
      <button
        role="switch"
        aria-checked={f.enabled}
        aria-label={f.label}
        disabled={busy === f.key}
        onClick={() => toggle(f)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${f.enabled ? 'bg-[#0079C1]' : 'bg-gray-300'} disabled:opacity-50`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${f.enabled ? 'translate-x-5' : ''}`} />
      </button>
    </Card>
  );

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title="Feature Status" subtitle="Turn platform features on or off. New switches always start ON."
        actions={<Btn variant="outline" size="sm" onClick={() => setShowNew((v) => !v)}>{showNew ? 'Close' : '+ New switch'}</Btn>} />

      {showNew && (
        <Card className="mb-6">
          <form onSubmit={create} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium adm-t2 mb-1">Key (a–z, 0–9, _)</label>
              <input className="fb-input text-sm font-mono" placeholder="e.g. live_chat" value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium adm-t2 mb-1">Label</label>
              <input className="fb-input text-sm" placeholder="e.g. Live Chat" value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium adm-t2 mb-1">Description</label>
            <input className="fb-input text-sm" placeholder="What this switch controls" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium adm-t2 mb-1">Category</label>
              <input className="fb-input text-sm" placeholder="e.g. Engagement" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium adm-t2 mb-1">Scope</label>
              <select className="fb-input text-sm" value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                <option value="vendor">Host</option>
                <option value="customer">Customer</option>
                <option value="both">Shared</option>
              </select>
            </div>
          </div>
          <p className="text-[11px] adm-t3">
            Heads up: a new switch only changes behaviour once a developer wires its key into the
            relevant route guard or <code>FeatureGate</code>. Until then it is a no-op toggle.
          </p>
          <Btn type="submit" size="sm" disabled={creating}>
            {creating ? 'Creating…' : 'Create switch'}
          </Btn>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="adm-t3">Loading…</p>
      ) : flags.length === 0 ? (
        <p className="adm-t3">No feature flags yet.</p>
      ) : (
        <div className="space-y-8">
          {groups.map(({ scope, items }) => (
            <div key={scope}>
              <h2 className="text-sm font-bold adm-t2 uppercase tracking-wide mb-3">
                {SCOPE_LABEL[scope]} <span className="adm-t3 font-normal">({items.length})</span>
              </h2>
              <div className="space-y-3">
                {items.map((f) => <Switch key={f.key} f={f} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
