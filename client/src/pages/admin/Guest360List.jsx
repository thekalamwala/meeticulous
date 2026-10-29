// client/src/pages/admin/Guest360List.jsx
// Admin "Guest 360°" directory — every person who has BOOKED, resolved from
// bookings by CRM customer key (phone-last-10, else email). The demand-side
// mirror of Host360List. Read-only: a row opens the per-guest 360 detail.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminGuest360List } from '../../services/api';
import toast from 'react-hot-toast';
import { PageHeader, Btn } from '../../components/admin/ui';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const SEARCH_ICON = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z';
const PAGE_SIZE = 20;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtPhone = (p) => (p ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : null);

const Avatar = ({ name }) => (
  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 bg-emerald-500">
    {(name || '?')[0].toUpperCase()}
  </div>
);

const Guest360List = () => {
  const navigate = useNavigate();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debounced]);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await adminGuest360List({ page, pageSize: PAGE_SIZE, search: debounced || undefined });
        if (!live) return;
        setGuests(data.guests || []);
        setTotal(data.total || 0);
      } catch { if (live) toast.error('Failed to load guests'); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [page, debounced]);

  const openDetail = (g) => navigate(`/admin/guest360/${encodeURIComponent(g.key)}`);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="Guest 360°" subtitle={`${total} guest${total !== 1 ? 's' : ''} who have booked`} />

      <div className="mb-4">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 adm-t3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={SEARCH_ICON} />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email…"
            className="w-full pl-10 pr-9 py-2.5 adm-card border rounded-xl text-sm adm-t1 placeholder:text-[color:var(--adm-text-3)] focus:ring-2 focus:ring-[#2E1065]/25 focus:border-[#2E1065] outline-none transition"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md adm-t3 hover:text-gray-700">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="adm-card rounded-2xl py-12 text-center adm-t3 text-sm">Loading…</div>
      ) : guests.length === 0 ? (
        <div className="adm-card rounded-2xl py-12 text-center adm-t3 text-sm">No guests match this search.</div>
      ) : (
        <div className="adm-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="adm-table w-full text-sm">
              <thead className="bg-gray-50 border-b adm-border">
                <tr>{['Guest', 'Contact', 'Bookings', 'Spent', 'Last booking', 'Account', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold adm-t3 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y adm-border">
                {guests.map((g) => (
                  <tr key={g.key} onClick={() => openDetail(g)} className="adm-hoverable cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={g.name} />
                        <p className="font-medium adm-t1 text-[13px]">{g.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="text-[12px] adm-t2">{fmtPhone(g.phone) || '—'}</p>
                        <p className="text-[11px] adm-t3">{g.email || '—'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] adm-t2">
                      {g.bookings}
                      {(g.cancelled + g.no_show) > 0 && (
                        <span className="text-[11px] adm-t3"> · {g.cancelled + g.no_show} lost</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] adm-t2 font-medium">{inr(g.spent)}</td>
                    <td className="px-4 py-3 text-[12px] adm-t2">{fmtDate(g.last_booking_at)}</td>
                    <td className="px-4 py-3">
                      {g.has_account
                        ? <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">Registered</span>
                        : <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">Guest</span>}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Btn size="sm" variant="outline" icon="external" onClick={() => openDetail(g)}>Open 360°</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] adm-t3">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border adm-border px-3 py-1.5 text-[12px] adm-t2 disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border adm-border px-3 py-1.5 text-[12px] adm-t2 disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Guest360List;
