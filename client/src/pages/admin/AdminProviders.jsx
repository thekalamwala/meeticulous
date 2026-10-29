import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminGetUsers, adminUpdateUser, adminGetUser, adminDeleteUser } from '../../services/api';
import toast from 'react-hot-toast';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import SeoDrawer from '../../components/admin/SeoDrawer';
import { PageHeader, Badge } from '../../components/admin/ui';
import { normalizePlan, getPlanBorderLabel } from '../../utils/themeUtils';

const PROVIDER_ICON = 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M16 11l2 2 4-4';

const STATUS_FILTER = {
  active:    { label: 'Active',    role: 'host', verified: true,  banned: false },
  pending:   { label: 'Pending',   role: 'host', verified: false, banned: false },
  suspended: { label: 'Suspended', role: 'host', verified: null,  banned: true },
};

// Row-level actions collapsed into one "Manage" overflow menu. The menu is
// fixed-positioned (anchored to the trigger via getBoundingClientRect) so it
// escapes the table's overflow-x-auto / overflow-hidden clipping.
const MENU_W = 168;
const RowActions = ({ p, onEdit, onVerify, onBan, onSeo, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: Math.max(8, r.right - MENU_W) });
    }
    setOpen(o => !o);
  };

  // Close on scroll/resize — the fixed menu would otherwise detach from the row.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const item = 'block w-full text-left px-3 py-2 text-[12px] hover:bg-gray-50';
  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50">
        Manage
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            style={{ top: pos.top, left: pos.left, width: MENU_W }}>
            {p.username && (
              <a href={`/${p.username}`} target="_blank" rel="noreferrer" className={`${item} text-gray-700`}>View profile</a>
            )}
            <button onClick={() => { setOpen(false); onEdit(p); }} className={`${item} text-gray-700`}>Edit</button>
            <button onClick={() => { setOpen(false); onVerify(p); }} className={`${item} text-gray-700`}>
              {p.is_verified ? 'Unverify' : 'Verify'}
            </button>
            <button onClick={() => { setOpen(false); onBan(p); }} className={`${item} text-amber-600`}>
              {p.is_banned ? 'Unban' : 'Suspend'}
            </button>
            <button onClick={() => { setOpen(false); onSeo(p); }} className={`${item} text-gray-700`}>SEO</button>
            <div className="my-1 border-t border-gray-100" />
            <button onClick={() => { setOpen(false); onDelete(p); }} className={`${item} text-red-600`}>Delete</button>
          </div>
        </>
      )}
    </>
  );
};

// Compact edit modal. Only the fields the server's updateUser whitelist accepts
// (name / email / admin_notes). Role, verify, ban have their own menu actions.
const ProviderEditModal = ({ entity, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: entity.name || '',
    email: entity.email || '',
    admin_notes: entity.admin_notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      await adminUpdateUser(entity.id, { name: form.name, email: form.email, admin_notes: form.admin_notes });
      toast.success('Saved');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const input = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#0079C1] focus:outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-bold text-gray-900">Edit provider</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="text-[12px] font-semibold text-gray-700">Name</span>
            <input value={form.name} onChange={set('name')} className={input} />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-gray-700">Email</span>
            <span className="block text-[11px] text-gray-400">Changing this updates their login email.</span>
            <input value={form.email} onChange={set('email')} className={input} />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-gray-700">Admin notes</span>
            <span className="block text-[11px] text-gray-400">Internal only — never shown to the host.</span>
            <textarea value={form.admin_notes} onChange={set('admin_notes')} rows={3} className={input} />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-[#0079C1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005E99] disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Filter tabs — 'all' has no status filter; the other three map to the
// verified/banned combinations in STATUS_FILTER. "Unverified" == pending.
const TABS = [
  { key: 'all',       label: 'All',        to: '/admin/providers' },
  { key: 'active',    label: 'Active',     to: '/admin/providers/active' },
  { key: 'pending',   label: 'Unverified', to: '/admin/providers/pending' },
  { key: 'suspended', label: 'Suspended',  to: '/admin/providers/suspended' },
];
const TITLES = { all: 'All Hosts', active: 'Active Hosts', pending: 'Unverified Hosts', suspended: 'Suspended Hosts' };
const SEARCH_ICON = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z';

const AdminProviders = () => {
  const { status } = useParams();
  const active = status || 'all';   // no :status segment → show everyone
  const [providers, setProviders] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [debounced, setDebounced] = useState('');
  const [seoEntity, setSeoEntity] = useState(null);
  const [editEntity, setEditEntity] = useState(null);

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // List rows lack the SEO columns, so load the full profile before opening.
  const openSeo = async (p) => {
    try {
      const { data } = await adminGetUser(p.id);
      setSeoEntity(data.user);
    } catch { toast.error('Failed to load SEO'); }
  };

  // Edit opens the full profile (list rows omit admin_notes).
  const openEdit = async (p) => {
    try {
      const { data } = await adminGetUser(p.id);
      setEditEntity(data.user);
    } catch { toast.error('Failed to load'); }
  };

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const { data } = await adminGetUsers({ role: 'host', page, limit: 20, search: debounced || undefined });
      let list = data.users || [];
      const filter = STATUS_FILTER[active];
      if (filter) {
        if (filter.banned !== null) list = list.filter(u => u.is_banned === filter.banned);
        if (filter.verified !== null) list = list.filter(u => u.is_verified === filter.verified);
      }
      setProviders(list);
      setTotal(data.total || list.length);
    } catch { toast.error('Failed to load providers'); }
    finally { setLoading(false); }
  };

  // Reset to the first page whenever the tab or the search term changes.
  useEffect(() => { setPage(1); }, [active, debounced]);
  useEffect(() => { fetchProviders(); }, [active, page, debounced]);

  const handleVerify = async (u) => {
    try {
      await adminUpdateUser(u.id, { is_verified: !u.is_verified });
      toast.success(u.is_verified ? 'Unverified' : 'Verified');
      fetchProviders();
    } catch { toast.error('Failed'); }
  };

  const handleBan = async (u) => {
    if (!window.confirm(`${u.is_banned ? 'Unban' : 'Suspend'} ${u.name}?`)) return;
    try {
      await adminUpdateUser(u.id, { is_banned: !u.is_banned });
      toast.success(u.is_banned ? 'Unbanned' : 'Suspended');
      fetchProviders();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Permanently delete ${u.name}? This cannot be undone.`)) return;
    try {
      await adminDeleteUser(u.id);
      toast.success('Deleted');
      fetchProviders();
    } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <PageHeader
        title={TITLES[active] || 'Hosts'}
        subtitle={`${total} host${total !== 1 ? 's' : ''}`}
        actions={
          <div className="flex gap-1 adm-card rounded-xl p-1">
            {TABS.map(t => (
              <Link key={t.key} to={t.to}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all
                  ${active === t.key ? 'bg-[#0079C1] text-white' : 'adm-t2 hover:text-gray-700'}`}>
                {t.label}
              </Link>
            ))}
          </div>
        }
      />

      {/* Search — name, phone, or email (server-side, debounced) */}
      <div className="relative mb-4 max-w-md">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 adm-t3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={SEARCH_ICON} />
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, or email…"
          className="w-full pl-10 pr-9 py-2.5 adm-card border rounded-xl text-sm adm-t1 placeholder:text-[color:var(--adm-text-3)] focus:ring-2 focus:ring-[#0079C1]/25 focus:border-[#0079C1] outline-none transition"
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md adm-t3 hover:text-gray-700">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {loading ? (
        <div className="adm-card rounded-2xl py-12 text-center adm-t3 text-sm">Loading...</div>
      ) : providers.length === 0 ? (
        <AdminEmptyState icon={PROVIDER_ICON} iconBg="bg-blue-50" iconColor="text-blue-500"
          title={debounced ? 'No matches' : (TITLES[active] || 'No hosts')}
          description={debounced ? 'No hosts match that name, phone, or email.' : 'No hosts found for this filter.'} />
      ) : (
        <div className="adm-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="adm-table w-full text-sm">
              <thead className="bg-gray-50 border-b adm-border">
                <tr>{['Host','Username','Plan','Status','Joined','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold adm-t3 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y adm-border">
                {providers.map(p => (
                  <tr key={p.id} className="adm-hoverable transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 bg-blue-500">
                          {(p.name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium adm-t1 text-[13px]">{p.name}</p>
                          <p className="text-[11px] adm-t3">{p.email}</p>
                          {p.phone && <p className="text-[11px] adm-t3">{p.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] adm-t2">@{p.username || '—'}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const canon = normalizePlan(p.plan);
                        const label = getPlanBorderLabel(canon);
                        const colors = canon === 'supreme' ? 'bg-amber-50 text-amber-700'
                          : canon === 'professional' ? 'bg-purple-50 text-purple-700'
                          : canon === 'creator' ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-100 text-gray-500';
                        return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors}`}>{label}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {p.is_banned ? <Badge tone="danger">Suspended</Badge>
                        : p.is_verified ? <Badge tone="ok">Verified</Badge>
                        : <Badge tone="warn">Pending</Badge>}
                    </td>
                    <td className="px-4 py-3 text-[12px] adm-t3">
                      {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <RowActions p={p} onEdit={openEdit} onVerify={handleVerify} onBan={handleBan} onSeo={openSeo} onDelete={handleDelete} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {seoEntity && (
        <SeoDrawer
          kind="provider"
          entity={seoEntity}
          onClose={() => setSeoEntity(null)}
        />
      )}

      {editEntity && (
        <ProviderEditModal
          entity={editEntity}
          onClose={() => setEditEntity(null)}
          onSaved={fetchProviders}
        />
      )}
    </div>
  );
};

export default AdminProviders;
