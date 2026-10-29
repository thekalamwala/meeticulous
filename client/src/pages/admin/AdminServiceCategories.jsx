import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  adminListServiceCategories,
  adminCreateServiceCategory,
  adminUpdateServiceCategory,
  adminDeleteServiceCategory,
  adminListCategories,
} from '../../services/api';
import { categoryLabel } from '../../utils/categoryUtils';

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ active }) {
  return active ? (
    <span className="inline-flex items-center text-[11px] font-medium rounded-full px-2 py-0.5 bg-green-50 text-green-700 border border-green-200">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center text-[11px] font-medium rounded-full px-2 py-0.5 bg-red-50 text-red-700 border border-red-200">
      Inactive
    </span>
  );
}

// ── Create / edit modal ─────────────────────────────────────────────────────────
function CategoryModal({ open, onClose, onSaved, editing, primary, primaryLabel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setIcon(editing?.icon ?? '');
    setDisplayOrder(editing?.display_order ?? 0);
    setIsActive(editing?.is_active ?? true);
  }, [open, editing]);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) { toast.error('Name must be at least 2 characters'); return; }
    setSaving(true);
    try {
      const payload = { name: trimmed, description: description.trim(), icon: icon.trim(), display_order: Number(displayOrder) || 0, is_active: isActive };
      if (editing) {
        await adminUpdateServiceCategory(editing.id, payload);
        toast.success('Service category updated');
      } else {
        await adminCreateServiceCategory({ ...payload, primary_category: primary });
        toast.success('Service category created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || (editing ? 'Update failed' : 'Create failed'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {editing ? 'Edit Service Category' : 'New Service Category'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Profession</label>
            <div className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2">
              {primaryLabel}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Service name <span className="text-red-500">*</span>
            </label>
            <input
              className="fb-input w-full"
              placeholder="e.g. Wedding Photography"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              SEO description (shown on /services pages; empty = auto template)
            </label>
            <textarea
              rows={2}
              maxLength={200}
              className="fb-input w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Icon key (optional, e.g. camera)
            </label>
            <input
              type="text"
              className="fb-input w-full"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Display order</label>
              <input
                type="number"
                className="fb-input w-full"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                min={0}
              />
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-gray-700">Active</span>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                aria-label="Active"
                onClick={() => setIsActive((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-[#0079C1]' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn text-sm text-gray-600 hover:bg-gray-100 px-4">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="btn bg-[#0079C1] text-white px-5 text-sm font-medium hover:bg-[#005E99] disabled:opacity-50"
          >
            {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const AdminServiceCategories = () => {
  const [cats, setCats] = useState([]);          // all service_categories rows
  const [professions, setProfessions] = useState([]); // [{ slug, label }]
  const [selected, setSelected] = useState('');  // selected primary_category slug
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminListServiceCategories()
      .then(({ data }) => setCats(data?.categories || []))
      .catch(() => toast.error('Failed to load service categories'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Full profession list (any status) for labels + the picker.
  useEffect(() => {
    adminListCategories()
      .then(({ data }) => setProfessions((data || []).map((c) => ({ slug: c.slug, label: c.label }))))
      .catch(() => {});
  }, []);

  const labelFor = useCallback(
    (slug) => professions.find((p) => p.slug === slug)?.label || categoryLabel(slug, professions),
    [professions]
  );

  // Counts per profession from the loaded rows.
  const countByPrimary = useMemo(() => {
    const m = {};
    for (const c of cats) m[c.primary_category] = (m[c.primary_category] || 0) + 1;
    return m;
  }, [cats]);

  // Professions to offer in the dropdown: all known professions, plus any that
  // already have categories (covers slugs no longer in the taxonomy).
  const professionOptions = useMemo(() => {
    const slugs = new Set(professions.map((p) => p.slug));
    Object.keys(countByPrimary).forEach((s) => slugs.add(s));
    return [...slugs].sort((a, b) => labelFor(a).localeCompare(labelFor(b)));
  }, [professions, countByPrimary, labelFor]);

  // Default the selection to the first profession that has categories.
  useEffect(() => {
    if (selected || !professionOptions.length) return;
    const firstWithCats = professionOptions.find((s) => countByPrimary[s]) || professionOptions[0];
    setSelected(firstWithCats);
  }, [selected, professionOptions, countByPrimary]);

  const rows = useMemo(
    () =>
      cats
        .filter((c) => c.primary_category === selected && c.status !== 'pending' && c.status !== 'rejected')
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name)),
    [cats, selected]
  );

  const pending = useMemo(
    () => cats.filter((c) => c.status === 'pending')
      .sort((a, b) => (a.primary_category || '').localeCompare(b.primary_category || '')),
    [cats]
  );

  const moderate = async (cat, status) => {
    try {
      await adminUpdateServiceCategory(cat.id, { status });
      toast.success(status === 'active' ? 'Approved' : 'Rejected');
      load();
    } catch { toast.error('Update failed'); }
  };

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (cat) => { setEditing(cat); setModalOpen(true); };

  const handleToggle = async (cat) => {
    try {
      await adminUpdateServiceCategory(cat.id, { is_active: !cat.is_active });
      toast.success(cat.is_active ? 'Deactivated' : 'Activated');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
    }
  };

  const handleDelete = async (cat) => {
    const inUse = (cat.serviceCount ?? 0) > 0;
    if (inUse) {
      toast.error(`"${cat.name}" is used by ${cat.serviceCount} service${cat.serviceCount === 1 ? '' : 's'}. Deactivate it instead.`);
      return;
    }
    if (!window.confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
    try {
      await adminDeleteServiceCategory(cat.id);
      toast.success('Deleted');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  const totalActive = cats.filter((c) => c.is_active).length;

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Service Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            The bookable services each profession offers. Hosts pick from their own profession's list.
          </p>
        </div>
        <button
          onClick={openCreate}
          disabled={!selected}
          className="btn flex items-center gap-1.5 bg-[#0079C1] text-white px-4 text-sm font-medium hover:bg-[#005E99] shrink-0 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" strokeWidth={3} /> New
        </button>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3 mt-5 mb-5">
          <div className="rounded border border-gray-200 p-3">
            <div className="text-2xl font-bold text-gray-900">{cats.length}</div>
            <div className="text-xs text-gray-500">Total services</div>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <div className="text-2xl font-bold text-gray-900">{totalActive}</div>
            <div className="text-xs text-gray-500">Active</div>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <div className="text-2xl font-bold text-gray-900">{Object.keys(countByPrimary).length}</div>
            <div className="text-xs text-gray-500">Professions covered</div>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-6 border border-amber-200 rounded overflow-hidden">
          <div className="px-4 py-2 bg-amber-50 text-amber-700 text-sm font-medium">
            Pending subcategory suggestions ({pending.length})
          </div>
          {pending.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-amber-100">
              <span className="flex-1 text-sm">
                <span className="font-medium text-gray-900">{cat.name}</span>
                <span className="text-xs text-gray-400"> · {labelFor(cat.primary_category)}</span>
              </span>
              <button onClick={() => moderate(cat, 'active')}
                className="btn text-xs bg-green-600 text-white px-2 py-1 hover:bg-green-700">Approve</button>
              <button onClick={() => moderate(cat, 'rejected')}
                className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100">Reject</button>
            </div>
          ))}
        </div>
      )}

      {/* Profession picker */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1">Profession</label>
        <select
          className="fb-input w-full max-w-sm"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {professionOptions.map((slug) => (
            <option key={slug} value={slug}>
              {labelFor(slug)} ({countByPrimary[slug] || 0})
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm py-12 text-center">Loading…</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">
                <th className="px-3 py-2.5">Service</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-center">In use</th>
                <th className="px-3 py-2.5 text-center">Order</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-sm text-gray-400 text-center">
                    No services for this profession yet.{' '}
                    {selected && (
                      <button onClick={openCreate} className="text-[#0079C1] underline">Add one</button>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((cat) => (
                  <tr key={cat.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-900">{cat.name}</div>
                      <div className="text-[11px] text-gray-400">/{cat.slug}</div>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge active={cat.is_active} /></td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-gray-600">{cat.serviceCount ?? 0}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-gray-500">{cat.display_order ?? 0}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggle(cat)}
                          className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${cat.is_active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
                        >
                          {cat.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => openEdit(cat)} title="Edit" className="text-gray-400 hover:text-[#0079C1] p-1.5 rounded transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(cat)} title="Delete" className="text-gray-400 hover:text-red-600 p-1.5 rounded transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <CategoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        editing={editing}
        primary={selected}
        primaryLabel={labelFor(selected)}
      />
    </div>
  );
};

export default AdminServiceCategories;
