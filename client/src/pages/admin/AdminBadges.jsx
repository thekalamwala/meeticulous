import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  adminGetBadgeMeta, adminListBadges, adminGetBadge, adminCreateBadge, adminUpdateBadge,
  adminBadgeStatus, adminPreviewRules, adminRunBadgeEval,
  adminVendorBadges, adminAssignBadge, adminRevokeBadge, adminGetUsers, adminUploadImage,
} from '../../services/api';
import { PageHeader, Card, Btn, Badge } from '../../components/admin/ui';

const STATUS_TONE = {
  draft: 'neutral',
  active: 'ok',
  archived: 'warn',
};

const EMPTY_FORM = {
  name: '', description: '', image_url: '', category_id: '',
  badge_type: 'automatic', is_negative: false, is_bas_team: false,
  status: 'draft', rule_logic: 'AND',
  rules: [{ field: 'completed_bookings', operator: '>=', value: '', group_id: 0 }],
};

const AdminBadges = () => {
  const [badges, setBadges] = useState([]);
  const [meta, setMeta] = useState({ categories: [], fields: [], operators: [] });
  const [filters, setFilters] = useState({ search: '', type: '', status: '' });
  const [loading, setLoading] = useState(true);

  // create/edit wizard
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  const handleImageUpload = async (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Use a JPG, PNG or WEBP image');
      return;
    }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    setUploadingImg(true);
    try {
      const { data } = await adminUploadImage(file, 'badges');
      setForm((f) => ({ ...f, image_url: data.url }));
      toast.success('Image uploaded');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingImg(false);
    }
  };

  // vendor badge management
  const [vendorPanel, setVendorPanel] = useState(null); // { vendor, awards }
  const [vendorQuery, setVendorQuery] = useState('');
  const [vendorResults, setVendorResults] = useState([]);
  const [assignForm, setAssignForm] = useState({ badge_id: '', reason: '' });

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.type)   params.type = filters.type;
    if (filters.status) params.status = filters.status;
    adminListBadges(params).then((r) => setBadges(r.data)).catch(() => toast.error('Failed to load badges'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { adminGetBadgeMeta().then((r) => setMeta(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setStep(1); setPreview(null); setShowForm(true); };

  const openEdit = async (badge) => {
    try {
      const r = await adminGetBadge(badge.id);
      setEditingId(badge.id);
      setForm({
        name: r.data.name, description: r.data.description || '', image_url: r.data.image_url || '',
        category_id: r.data.category_id || '', badge_type: r.data.badge_type,
        is_negative: r.data.is_negative, is_bas_team: r.data.is_bas_team,
        status: r.data.status, rule_logic: r.data.rule_logic,
        rules: r.data.rules.length ? r.data.rules : EMPTY_FORM.rules,
      });
      setStep(1); setPreview(null); setShowForm(true);
    } catch { toast.error('Failed to load badge'); }
  };

  const runPreview = async () => {
    try {
      const r = await adminPreviewRules({ rule_logic: form.rule_logic, rules: form.rules.filter((x) => x.value !== '') });
      setPreview(r.data.count);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Preview failed');
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, rules: form.badge_type === 'automatic' ? form.rules.filter((r) => r.value !== '') : [] };
      if (editingId) {
        await adminUpdateBadge(editingId, payload);
        if (payload.status) await adminBadgeStatus(editingId, payload.status);
        toast.success('Badge updated');
      } else {
        await adminCreateBadge(payload);
        toast.success('Badge created');
      }
      setShowForm(false); load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (badge, status) => {
    try {
      await adminBadgeStatus(badge.id, status);
      toast.success(`${badge.name} → ${status}`);
      load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Status change failed'); }
  };

  const searchVendors = async () => {
    if (!vendorQuery.trim()) return;
    try {
      const r = await adminGetUsers({ search: vendorQuery, role: 'host' });
      const rows = Array.isArray(r.data) ? r.data : r.data?.users || [];
      setVendorResults(rows.filter((u) => u.role === 'host').slice(0, 8));
    } catch { toast.error('Host search failed'); }
  };

  const openVendor = async (vendor) => {
    try {
      const r = await adminVendorBadges(vendor.id);
      setVendorPanel({ vendor, awards: r.data });
      setAssignForm({ badge_id: '', reason: '' });
    } catch { toast.error('Failed to load host badges'); }
  };

  const assign = async () => {
    if (!assignForm.badge_id) return toast.error('Pick a badge');
    if (!assignForm.reason.trim()) return toast.error('A reason is required');
    try {
      await adminAssignBadge(vendorPanel.vendor.id, assignForm);
      toast.success('Badge assigned');
      openVendor(vendorPanel.vendor); load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Assignment failed'); }
  };

  const revoke = async (award) => {
    const reason = window.prompt(`Reason for revoking "${award.badges?.name}" (required):`);
    if (!reason || !reason.trim()) return;
    try {
      await adminRevokeBadge(vendorPanel.vendor.id, award.badge_id, reason.trim());
      toast.success('Badge revoked');
      openVendor(vendorPanel.vendor); load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Revoke failed'); }
  };

  const manualBadges = badges.filter((b) => b.badge_type === 'manual' && b.status !== 'archived');

  return (
    <div>
      <PageHeader title="Badges" subtitle="Rules-driven host credentialing — all badge logic lives in the database"
        actions={<>
          <Btn variant="outline" size="sm" onClick={() => adminRunBadgeEval().then((r) => toast.success(`Evaluated: +${r.data.awarded} awarded, -${r.data.revoked} revoked`)).catch(() => toast.error('Evaluation failed'))}>Run Engine Now</Btn>
          <Btn size="sm" onClick={openCreate}>+ New Badge</Btn>
        </>} />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input className="fb-input text-sm w-56" placeholder="Search badges…" value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        <select className="fb-input text-sm w-36" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
          <option value="">All types</option><option value="automatic">Automatic</option><option value="manual">Manual</option>
        </select>
        <select className="fb-input text-sm w-36" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
        </select>
      </div>

      {/* Badge list */}
      <div className="adm-card rounded-xl overflow-hidden mb-8">
        {loading ? <p className="text-center text-sm adm-t3 py-8">Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="adm-table w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider adm-t3 border-b adm-border">
                  <th className="px-4 py-2.5">Badge</th><th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Earned</th><th className="px-4 py-2.5">Flags</th><th className="px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {badges.map((b) => (
                  <tr key={b.id} className="border-b adm-border last:border-0 adm-hoverable">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {b.image_url
                          ? <img src={b.image_url} alt={b.name} className="w-8 h-8 rounded object-cover border adm-border" />
                          : <div className="w-8 h-8 rounded bg-gradient-to-br from-orange-100 to-amber-100 border adm-border flex items-center justify-center text-xs font-bold text-orange-500">{b.name[0]}</div>}
                        <span className="font-medium adm-t1">{b.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs adm-t2">{b.badge_categories?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-xs capitalize adm-t2">{b.badge_type}</td>
                    <td className="px-4 py-2.5"><Badge tone={STATUS_TONE[b.status]}><span className="capitalize">{b.status}</span></Badge></td>
                    <td className="px-4 py-2.5 text-xs font-semibold adm-t1">{b.earned_count}</td>
                    <td className="px-4 py-2.5 text-[10px] space-x-1">
                      {b.is_bas_team && <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-bold">BAS</span>}
                      {b.is_negative && <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-bold">NEG</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                      <button onClick={() => openEdit(b)} className="text-indigo-600 font-semibold hover:underline mr-3">Edit</button>
                      {b.status !== 'active' && <button onClick={() => setStatus(b, 'active')} className="text-emerald-600 font-semibold hover:underline mr-3">Activate</button>}
                      {b.status !== 'archived' && <button onClick={() => setStatus(b, 'archived')} className="text-amber-600 font-semibold hover:underline">Archive</button>}
                    </td>
                  </tr>
                ))}
                {badges.length === 0 && <tr><td colSpan="7" className="text-center text-sm adm-t3 py-8">No badges match.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vendor badge management */}
      <Card className="max-w-3xl">
        <h2 className="text-sm font-bold adm-t1 mb-1">Host Badges</h2>
        <p className="text-xs adm-t3 mb-3">Search a host to view earned badges and manage manual assignments (reason required, full audit trail).</p>
        <div className="flex gap-2 mb-3">
          <input className="fb-input text-sm flex-1" placeholder="Search host by name/email…" value={vendorQuery}
            onChange={(e) => setVendorQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchVendors()} />
          <Btn variant="outline" size="sm" onClick={searchVendors}>Search</Btn>
        </div>
        {vendorResults.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {vendorResults.map((v) => (
              <button key={v.id} onClick={() => openVendor(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border adm-border ${vendorPanel?.vendor?.id === v.id ? 'bg-gray-900 text-white' : 'adm-t2 adm-hoverable'}`}>
                {v.name} <span className="opacity-60">({v.email})</span>
              </button>
            ))}
          </div>
        )}

        {vendorPanel && (
          <div className="border-t adm-border pt-4">
            <p className="text-sm font-semibold adm-t1 mb-2">{vendorPanel.vendor.name} — badge history</p>
            <div className="space-y-1.5 mb-4">
              {vendorPanel.awards.length === 0 && <p className="text-xs adm-t3">No badges yet.</p>}
              {vendorPanel.awards.map((a) => (
                <div key={a.id} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${a.revoked_at ? 'bg-[var(--adm-hover)] adm-t3' : 'bg-emerald-50/50'}`}>
                  <div>
                    <span className="font-semibold adm-t1">{a.badges?.name}</span>
                    <span className="ml-2 adm-t3">
                      {a.assigned_by ? 'manual' : 'engine'} · {new Date(a.assigned_at).toLocaleDateString('en-IN')}
                      {a.reason && ` · "${a.reason}"`}
                      {a.revoked_at && ` · REVOKED ${new Date(a.revoked_at).toLocaleDateString('en-IN')}${a.revocation_reason ? ` ("${a.revocation_reason}")` : ''}`}
                    </span>
                  </div>
                  {!a.revoked_at && a.badges?.badge_type === 'manual' && (
                    <button onClick={() => revoke(a)} className="text-red-500 font-semibold hover:underline">Revoke</button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-semibold adm-t3 mb-1">Assign manual badge</label>
                <select className="fb-input text-sm" value={assignForm.badge_id} onChange={(e) => setAssignForm((f) => ({ ...f, badge_id: e.target.value }))}>
                  <option value="">Select badge…</option>
                  {manualBadges.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="flex-[2] min-w-[220px]">
                <label className="block text-[11px] font-semibold adm-t3 mb-1">Reason (required)</label>
                <input className="fb-input text-sm" value={assignForm.reason} onChange={(e) => setAssignForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Why is this badge being assigned?" />
              </div>
              <Btn size="sm" onClick={assign}>Assign</Btn>
            </div>
          </div>
        )}
      </Card>

      {/* Create / Edit wizard */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-10" onClick={() => setShowForm(false)}>
          <div className="adm-card rounded-2xl w-full max-w-xl p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold adm-t1">{editingId ? 'Edit Badge' : 'New Badge'}</h2>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((s) => (
                  <span key={s} className={`w-6 h-1.5 rounded-full ${step >= s ? 'bg-[#960D32]' : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-xs font-bold adm-t3 uppercase tracking-wider">Step 1 — Basic information</p>
                <div><label className="block text-sm font-medium adm-t1 mb-1">Name</label>
                  <input className="fb-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="block text-sm font-medium adm-t1 mb-1">Description</label>
                  <textarea className="fb-input" rows="2" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
                <div>
                  <label className="block text-sm font-medium adm-t1 mb-1">Badge image</label>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl border adm-border bg-[var(--adm-hover)] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {form.image_url
                        ? <img src={form.image_url} alt="badge" className="w-full h-full object-cover" />
                        : <span className="text-[10px] adm-t3 text-center px-1">No image</span>}
                    </div>
                    <div className="flex-1">
                      <label className={`fb-btn fb-btn--secondary text-sm cursor-pointer inline-block ${uploadingImg ? 'opacity-60 pointer-events-none' : ''}`}>
                        {uploadingImg ? 'Uploading…' : (form.image_url ? 'Replace image' : 'Upload image')}
                        <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden"
                          onChange={(e) => { handleImageUpload(e.target.files?.[0]); e.target.value = ''; }} />
                      </label>
                      {form.image_url && (
                        <button type="button" onClick={() => setForm((f) => ({ ...f, image_url: '' }))}
                          className="ml-2 text-[12px] text-red-500 hover:underline">Remove</button>
                      )}
                      <p className="text-[11px] adm-t3 mt-1">PNG, JPG or WEBP, up to 2MB.</p>
                    </div>
                  </div>
                </div>
                <div><label className="block text-sm font-medium adm-t1 mb-1">Category</label>
                  <select className="fb-input" value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
                    <option value="">No category</option>
                    {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
                <div className="flex gap-5 pt-1">
                  <label className="flex items-center gap-2 text-sm adm-t2"><input type="checkbox" checked={form.is_bas_team} onChange={(e) => setForm((f) => ({ ...f, is_bas_team: e.target.checked }))} /> BAS Team badge</label>
                  <label className="flex items-center gap-2 text-sm adm-t2"><input type="checkbox" checked={form.is_negative} onChange={(e) => setForm((f) => ({ ...f, is_negative: e.target.checked }))} /> Negative (admin-only)</label>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-xs font-bold adm-t3 uppercase tracking-wider">Step 2 — Badge type</p>
                {['automatic', 'manual'].map((t) => (
                  <label key={t} className={`flex items-start gap-3 border adm-border rounded-xl p-3 cursor-pointer ${form.badge_type === t ? 'border-[#960D32] bg-orange-50/40' : ''}`}>
                    <input type="radio" checked={form.badge_type === t} onChange={() => setForm((f) => ({ ...f, badge_type: t }))} className="mt-1" />
                    <span>
                      <span className="block text-sm font-semibold capitalize adm-t1">{t}</span>
                      <span className="block text-xs adm-t3">
                        {t === 'automatic' ? 'Awarded by the engine when rules are satisfied. Re-evaluated on schedule and events.' : 'Assigned by admins from a vendor profile, with a documented reason.'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            {step === 3 && form.badge_type === 'automatic' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold adm-t3 uppercase tracking-wider">Step 3 — Rules</p>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="adm-t3">Combine with</span>
                    {['AND', 'OR'].map((l) => (
                      <button key={l} onClick={() => setForm((f) => ({ ...f, rule_logic: l }))}
                        className={`px-2 py-1 rounded font-bold ${form.rule_logic === l ? 'bg-gray-900 text-white' : 'adm-chip adm-t3'}`}>{l}</button>
                    ))}
                  </div>
                </div>
                {form.rules.map((r, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select className="fb-input text-sm flex-1" value={r.field}
                      onChange={(e) => setForm((f) => ({ ...f, rules: f.rules.map((x, j) => j === i ? { ...x, field: e.target.value } : x) }))}>
                      {meta.fields.map((fld) => <option key={fld} value={fld}>{fld}</option>)}
                    </select>
                    <select className="fb-input text-sm w-20" value={r.operator}
                      onChange={(e) => setForm((f) => ({ ...f, rules: f.rules.map((x, j) => j === i ? { ...x, operator: e.target.value } : x) }))}>
                      {meta.operators.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                    <input type="number" className="fb-input text-sm w-28" value={r.value}
                      onChange={(e) => setForm((f) => ({ ...f, rules: f.rules.map((x, j) => j === i ? { ...x, value: e.target.value } : x) }))} />
                    <button onClick={() => setForm((f) => ({ ...f, rules: f.rules.filter((_, j) => j !== i) }))}
                      className="text-red-400 hover:text-red-600 text-lg leading-none px-1">×</button>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <button onClick={() => setForm((f) => ({ ...f, rules: [...f.rules, { field: meta.fields[0] || 'completed_bookings', operator: '>=', value: '', group_id: 0 }] }))}
                    className="text-xs font-semibold text-indigo-600 hover:underline">+ Add rule</button>
                  <Btn variant="outline" size="sm" onClick={runPreview}>Preview eligible hosts</Btn>
                  {preview !== null && <span className="text-xs font-bold text-emerald-600">{preview} host(s) would earn this badge now</span>}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <p className="text-xs font-bold adm-t3 uppercase tracking-wider">Step 4 — Publish</p>
                {['draft', 'active', 'archived'].map((s) => (
                  <label key={s} className={`flex items-start gap-3 border adm-border rounded-xl p-3 cursor-pointer ${form.status === s ? 'border-[#960D32] bg-orange-50/40' : ''}`}>
                    <input type="radio" checked={form.status === s} onChange={() => setForm((f) => ({ ...f, status: s }))} className="mt-1" />
                    <span>
                      <span className="block text-sm font-semibold capitalize adm-t1">{s}</span>
                      <span className="block text-xs adm-t3">
                        {s === 'draft' ? 'Saved, not evaluated.' : s === 'active' ? 'Evaluated immediately and on every engine run.' : 'Preserved, no new awards.'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-between mt-6 pt-4 border-t adm-border">
              <Btn variant="outline" size="sm" onClick={() => step > 1 ? setStep(step === 4 && form.badge_type === 'manual' ? 2 : step - 1) : setShowForm(false)}>
                {step === 1 ? 'Cancel' : 'Back'}
              </Btn>
              {step < 4 ? (
                <Btn size="sm" onClick={() => {
                  if (step === 1 && !form.name.trim()) return toast.error('Name is required');
                  setStep(step === 2 && form.badge_type === 'manual' ? 4 : step + 1);
                }}>Next</Btn>
              ) : (
                <Btn size="sm" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Badge'}
                </Btn>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBadges;
