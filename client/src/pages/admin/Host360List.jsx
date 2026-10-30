// client/src/pages/admin/Host360List.jsx
// Admin "Host 360°" directory — one searchable, filterable list of every host
// with a quick-action menu and a click-through to the per-host 360 detail page.
// Modelled on AdminProviders.jsx (debounced server search, RowActions overflow
// menu, pagination, react-hot-toast). New api helpers (adminHost360*) are added
// separately in services/api.js.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminHost360List, adminHost360Managers } from '../../services/api';
import toast from 'react-hot-toast';
import { PageHeader, Btn } from '../../components/admin/ui';
import Ic from '../../components/admin/Ic';
import { IC } from '../../components/admin/adminNav';
import { normalizePlan, getPlanBorderLabel } from '../../utils/themeUtils';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const SEARCH_ICON = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z';
const PAGE_SIZE = 20;

const PlanBadge = ({ plan }) => {
  const canon = normalizePlan(plan);
  const label = getPlanBorderLabel(canon);
  const colors = canon === 'supreme' ? 'bg-amber-50 text-amber-700'
    : canon === 'professional' ? 'bg-purple-50 text-purple-700'
    : canon === 'creator' ? 'bg-blue-50 text-blue-700'
    : 'bg-gray-100 text-gray-500';
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors}`}>{label}</span>;
};

// Host avatar — real photo when we have one, initial only as the fallback.
const Avatar = ({ host }) => {
  const [broken, setBroken] = useState(false);
  const src = host.profile_image;
  if (src && !broken) {
    return (
      <img src={src} alt="" loading="lazy" onError={() => setBroken(true)}
        className="w-8 h-8 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 bg-blue-500">
      {(host.name || '?')[0].toUpperCase()}
    </div>
  );
};

// Average guest rating. Colour tracks the number so a bad host is visible while
// scanning: 4.5+ green, 4+ lime, 3+ amber, below 3 red. null = never reviewed,
// which is different from a low score and must not read as one.
const RatingPill = ({ rating, count }) => {
  if (rating == null) return <span className="text-[11px] adm-t3">No reviews</span>;
  const tone = rating >= 4.5 ? 'bg-emerald-50 text-emerald-700'
    : rating >= 4 ? 'bg-lime-50 text-lime-700'
    : rating >= 3 ? 'bg-amber-50 text-amber-700'
    : 'bg-red-50 text-red-600';
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${tone}`}
      title={`${count} review${count === 1 ? '' : 's'}`}>
      <Ic d={IC.star} size={11} />
      {rating.toFixed(1)}
    </span>
  );
};

const Host360List = () => {
  const navigate = useNavigate();
  const [hosts, setHosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [debounced, setDebounced] = useState('');
  const [plan, setPlan]         = useState('');
  const [statusF, setStatusF]   = useState('');
  const [amId, setAmId]         = useState('');
  const [managers, setManagers] = useState([]);

  // Debounce search so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Account-manager filter options (loaded once).
  useEffect(() => {
    (async () => {
      try {
        const { data } = await adminHost360Managers();
        setManagers(data.managers || []);
      } catch { /* non-fatal — filter just stays empty */ }
    })();
  }, []);

  const fetchHosts = async () => {
    setLoading(true);
    try {
      const { data } = await adminHost360List({
        page,
        pageSize: PAGE_SIZE,
        search: debounced || undefined,
        plan: plan || undefined,
        status: statusF || undefined,
        account_manager_id: amId || undefined,
      });
      setHosts(data.hosts || []);
      setTotal(data.total || 0);
    } catch { toast.error('Failed to load hosts'); }
    finally { setLoading(false); }
  };

  // Reset to page 1 whenever a filter or the search term changes.
  useEffect(() => { setPage(1); }, [debounced, plan, statusF, amId]);
  useEffect(() => { fetchHosts(); }, [page, debounced, plan, statusF, amId]);

  const openDetail = (h) => navigate(`/admin/host360/${h.id}`);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selCls = 'adm-card border rounded-xl px-3 py-2 text-[13px] adm-t1 outline-none focus:border-[#960D32] focus:ring-2 focus:ring-[#960D32]/25 transition w-full min-w-0';

  return (
    <div>
      <PageHeader title="Host 360°" subtitle={`${total} host${total !== 1 ? 's' : ''}`} />

      {/* Filters — search + all three dropdowns share one horizontal line. The
          selects hold their width and the search takes the slack; on a narrow
          viewport the row scrolls sideways rather than wrapping. */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 adm-t3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={SEARCH_ICON} />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email…"
            className="w-full pl-10 pr-9 py-2.5 adm-card border rounded-xl text-sm adm-t1 placeholder:text-[color:var(--adm-text-3)] focus:ring-2 focus:ring-[#960D32]/25 focus:border-[#960D32] outline-none transition"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md adm-t3 hover:text-gray-700">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <select value={plan} onChange={e => setPlan(e.target.value)} className={selCls}>
          <option value="">All plans</option>
          <option value="starter">Starter</option>
          <option value="creator">Host+</option>
          <option value="professional">Studio</option>
          <option value="supreme">Supreme</option>
        </select>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} className={selCls}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
          <option value="unverified">Unverified</option>
        </select>
        <select value={amId} onChange={e => setAmId(e.target.value)} className={selCls}>
          <option value="">All account managers</option>
          {managers.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="adm-card rounded-2xl py-12 text-center adm-t3 text-sm">Loading…</div>
      ) : hosts.length === 0 ? (
        <div className="adm-card rounded-2xl py-12 text-center adm-t3 text-sm">No hosts match these filters.</div>
      ) : (
        <div className="adm-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="adm-table w-full text-sm">
              <thead className="bg-gray-50 border-b adm-border">
                <tr>{['Business','Contact Details','Plan','Rating','Revenue','Account Manager','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold adm-t3 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y adm-border">
                {hosts.map(h => (
                  <tr key={h.id} onClick={() => openDetail(h)} className="adm-hoverable cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar host={h} />
                        <div>
                          <p className="font-medium adm-t1 text-[13px]">{h.name}</p>
                          {h.username && <p className="text-[11px] adm-t3">@{h.username}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="text-[12px] adm-t2">{h.phone || '—'}</p>
                        <p className="text-[11px] adm-t3">{h.email || '—'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3"><PlanBadge plan={h.plan} /></td>
                    {/* Status lives in the filter dropdown, so the column earns
                        its width with the rating instead of repeating it. */}
                    <td className="px-4 py-3"><RatingPill rating={h.rating} count={h.reviews_count} /></td>
                    <td className="px-4 py-3 text-[13px] adm-t2 font-medium">{inr(h.revenue)}</td>
                    <td className="px-4 py-3 text-[12px] adm-t2">{h.account_manager?.name || '—'}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Btn size="sm" variant="outline" icon="external" onClick={() => openDetail(h)}>Open 360°</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] adm-t3">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="rounded-lg border adm-border px-3 py-1.5 text-[12px] adm-t2 disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="rounded-lg border adm-border px-3 py-1.5 text-[12px] adm-t2 disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Host360List;
