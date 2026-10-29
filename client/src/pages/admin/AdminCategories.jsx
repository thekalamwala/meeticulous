import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Plus, Clock, Check } from 'lucide-react';
import {
  adminListCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory,
} from '../../services/api';
import { groupCategories } from '../../utils/categoryUtils';

const fmtDate = (s) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminListCategories()
      .then(({ data }) => setCategories(data || []))
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const live = categories.filter((c) => c.status === 'active' || c.status === 'disabled');
  const pending = categories.filter((c) => c.status === 'pending');
  const groups = useMemo(() => groupCategories(live), [live]);
  const knownGroups = useMemo(
    () => [...new Set(categories.map((c) => c.group_label).filter(Boolean))],
    [categories]
  );

  const totals = useMemo(() => ({
    active: live.filter((c) => c.status === 'active').length,
    hosts: live.reduce((n, c) => n + (c.registered_hosts || 0), 0),
    top: [...live].sort((a, b) => (b.registered_hosts || 0) - (a.registered_hosts || 0))[0],
  }), [live]);

  const create = async () => {
    const label = newLabel.trim();
    if (label.length < 2) return toast.error('Enter a category name');
    setCreating(true);
    try {
      await adminCreateCategory({ label, group_label: newGroup.trim() || null, status: 'active' });
      setNewLabel(''); setNewGroup('');
      toast.success('Category created');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not create');
    } finally { setCreating(false); }
  };

  const setStatus = async (cat, status) => {
    try {
      await adminUpdateCategory(cat.id, { status });
      toast.success(status === 'active' ? 'Set live' : status === 'disabled' ? 'Turned off' : 'Updated');
      load();
    } catch { toast.error('Update failed'); }
  };

  const setAllowSuggest = async (cat, value) => {
    try {
      await adminUpdateCategory(cat.id, { allow_subcategory_suggestions: value });
      toast.success(value ? 'Suggestions on' : 'Suggestions off');
      load();
    } catch { toast.error('Update failed'); }
  };

  const remove = async (cat) => {
    if ((cat.registered_hosts || 0) > 0) return;
    if (!window.confirm(`Delete "${cat.label}"? This cannot be undone.`)) return;
    try {
      await adminDeleteCategory(cat.id);
      toast.success('Deleted');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const StatusCell = (cat) => (
    <select
      value={cat.status}
      onChange={(e) => setStatus(cat, e.target.value)}
      aria-label={`Status: ${cat.label}`}
      className={`text-xs font-medium rounded border px-2 py-1 ${
        cat.status === 'active'
          ? 'border-green-300 bg-green-50 text-green-700'
          : 'border-red-300 bg-red-50 text-red-700'
      }`}
    >
      <option value="active">🟢 Active</option>
      <option value="disabled">🔴 Off</option>
    </select>
  );

  const Row = (cat) => {
    const locked = (cat.registered_hosts || 0) > 0;
    return (
      <tr key={cat.id} className="border-b border-gray-100 last:border-0">
        <td className="px-3 py-2.5">
          <div className="font-medium text-gray-900">{cat.label}</div>
          <div className="text-[11px] text-gray-400">/{cat.slug}</div>
        </td>
        <td className="px-3 py-2.5">{StatusCell(cat)}</td>
        <td className="px-3 py-2.5 text-center tabular-nums">{cat.registered_hosts || 0}</td>
        <td className="px-3 py-2.5 text-center tabular-nums">{cat.active_services || 0}</td>
        <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(cat.created_at)}</td>
        <td className="px-3 py-2.5 text-center">
          <button
            onClick={() => setAllowSuggest(cat, !cat.allow_subcategory_suggestions)}
            className={`text-xs font-medium rounded px-2 py-1 border ${
              cat.allow_subcategory_suggestions
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-gray-200 bg-gray-50 text-gray-500'
            }`}
          >
            {cat.allow_subcategory_suggestions ? 'On' : 'Off'}
          </button>
        </td>
        <td className="px-3 py-2.5 text-right">
          <button
            onClick={() => remove(cat)}
            disabled={locked}
            title={locked ? `${cat.registered_hosts} hosts registered — set to Off instead` : 'Delete'}
            className="text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Industry Categories</h1>
      <p className="text-sm text-gray-500 mb-5">
        Switch categories on/off to control what hosts can pick at onboarding. Phased rollout: turn the next set 🟢 Active when ready.
      </p>

      {!loading && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded border border-gray-200 p-3">
            <div className="text-2xl font-bold text-gray-900">{totals.active}</div>
            <div className="text-xs text-gray-500">Active categories</div>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <div className="text-2xl font-bold text-gray-900">{totals.hosts}</div>
            <div className="text-xs text-gray-500">Hosts categorised</div>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <div className="text-sm font-bold text-gray-900 truncate">{totals.top?.label || '—'}</div>
            <div className="text-xs text-gray-500">Top category</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <input className="fb-input flex-1 min-w-[180px]" placeholder="New category name"
          value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()} />
        <input className="fb-input flex-1 min-w-[160px]" placeholder="Group (e.g. Technology & Product)"
          value={newGroup} onChange={(e) => setNewGroup(e.target.value)} list="cat-groups" />
        <datalist id="cat-groups">{knownGroups.map((g) => <option key={g} value={g} />)}</datalist>
        <button onClick={create} disabled={creating}
          className="btn flex items-center gap-1.5 bg-primary text-white px-4 text-sm font-medium hover:bg-primary-dark disabled:opacity-50 shrink-0">
          <Plus className="w-4 h-4" strokeWidth={3} /> Add
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm py-10 text-center">Loading…</p>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-6 border border-amber-200 rounded overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 text-sm font-medium">
                <Clock className="w-4 h-4" /> Pending suggestions ({pending.length})
              </div>
              {pending.map((cat) => (
                <div key={cat.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-amber-100">
                  <span className="flex-1 font-medium text-gray-900">{cat.label} <span className="text-xs text-gray-400">/{cat.slug}</span></span>
                  <button onClick={() => setStatus(cat, 'active')}
                    className="btn flex items-center gap-1 text-xs bg-green-600 text-white px-2 py-1 hover:bg-green-700">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} /> Approve
                  </button>
                  <button onClick={() => setStatus(cat, 'rejected')}
                    className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100">Reject</button>
                </div>
              ))}
            </div>
          )}

          <div className="border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <th className="px-3 py-2">Category Name</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-center">Registered Hosts</th>
                  <th className="px-3 py-2 text-center">Active Services</th>
                  <th className="px-3 py-2">Date Added</th>
                  <th className="px-3 py-2 text-center">Host Suggestions</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.group}>
                    <tr className="bg-gray-50/60">
                      <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{g.group}</td>
                    </tr>
                    {g.items.map(Row)}
                  </Fragment>
                ))}
                {live.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-sm text-gray-400 text-center">No categories yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminCategories;
