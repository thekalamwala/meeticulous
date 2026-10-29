// client/src/components/admin/seo/SeoList.jsx
// Reusable list view for services / profiles / blogs / pages. One table + inspector
// drawer, driven by GET /admin/seo/list. Search, sortable columns, filter, pagination.
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Ic from '../Ic';
import { IC } from '../adminNav';
import { Table, Badge, Skeleton } from '../ui';
import { adminSeoList } from '../../../services/api';
import SeoInspector from './SeoInspector';
import AdminFilters from '../ui/AdminFilters';
import { ScoreChip, Delta, fmtNum, fmtPct, fmtPos } from './seoShared';

const PAGE_SIZE = 50;
const INDEX_TONE = (p) => (p.http_status && p.http_status !== 200 ? 'danger' : !p.indexable ? 'warn' : 'ok');
const INDEX_LABEL = (p) => (p.http_status && p.http_status !== 200 ? String(p.http_status) : !p.indexable ? 'No' : 'Yes');

// Clickable, sort-aware column header.
function SortHead({ label, field, sort, dir, onSort, align = 'left' }) {
  const active = sort === field;
  return (
    <button onClick={() => onSort(field)} className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'adm-t1' : ''}`}>
      {label}{active && <Ic d={IC.chevD} size={11} className={dir === 'asc' ? 'rotate-180' : ''} />}
    </button>
  );
}

export default function SeoList({ type, title, subtitle }) {
  const [state, setState] = useState({ rows: [], total: 0, loading: true });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('seo');
  const [dir, setDir] = useState('asc');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [indexable, setIndexable] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [type, debounced, indexable, sort, dir]);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const params = { type, sort, dir, page, pageSize: PAGE_SIZE };
      if (debounced) params.search = debounced;
      if (indexable) params.indexable = indexable;
      const res = await adminSeoList(params);
      setState({ rows: res.data.pages || [], total: res.data.total || 0, loading: false });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load pages');
      setState({ rows: [], total: 0, loading: false });
    }
  }, [type, sort, dir, page, debounced, indexable]);

  useEffect(() => { load(); }, [load]);

  const onSort = (field) => {
    if (sort === field) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(field); setDir(field === 'seo' || sort === 'geo' ? 'asc' : 'desc'); }
  };

  const H = (label, field, align) => <SortHead label={label} field={field} sort={sort} dir={dir} onSort={onSort} align={align} />;
  const columns = [
    { key: 'url', label: 'Page', render: (r) => (
      <div className="min-w-0 max-w-[280px]">
        <div className="font-medium adm-t1 truncate text-[13px]">{r.title || r.url}</div>
        <div className="adm-t3 truncate text-[11px]">{r.url}</div>
      </div>
    ) },
    { key: 'index', label: 'Idx', className: 'text-center', render: (r) => <Badge tone={INDEX_TONE(r)}>{INDEX_LABEL(r)}</Badge> },
    { key: 'seo', label: H('SEO', 'seo', 'right'), className: 'text-right', render: (r) => <ScoreChip value={r.seo_score} capped={r.seo_caps > 0} /> },
    { key: 'geo', label: H('GEO', 'geo', 'right'), className: 'text-right', render: (r) => <ScoreChip value={r.geo_score} capped={r.geo_caps > 0} /> },
    { key: 'clicks', label: H('Clicks', 'clicks', 'right'), className: 'text-right tabular-nums', render: (r) => fmtNum(r.gsc?.clicks) },
    { key: 'impr', label: H('Impr.', 'impressions', 'right'), className: 'text-right tabular-nums', render: (r) => fmtNum(r.gsc?.impressions) },
    { key: 'ctr', label: 'CTR', className: 'text-right tabular-nums', render: (r) => fmtPct(r.gsc?.ctr) },
    { key: 'rank', label: H('Rank', 'position', 'right'), className: 'text-right tabular-nums', render: (r) => fmtPos(r.gsc?.position) },
    { key: 'trend', label: 'Trend', className: 'text-right', render: (r) => <Delta value={r.gsc?.position_change} goodUp /> },
    { key: 'iss', label: H('Iss.', 'issues', 'right'), className: 'text-right tabular-nums', render: (r) => (r.issue_count ? <span style={{ color: r.issue_count > 3 ? 'var(--adm-danger)' : 'var(--adm-warn)' }}>{r.issue_count}</span> : '0') },
  ];

  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Ic d={IC.search} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 adm-t3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search URL or title…"
            className="fb-input text-sm w-full pl-8" />
        </div>
        <AdminFilters
          value={{ indexable: indexable || undefined }}
          onChange={(next) => setIndexable(next.indexable || '')}
          config={[{ key: 'indexable', label: 'Index', search: false, options: [
            { value: 'true', label: 'Indexable' },
            { value: 'false', label: 'Non-indexable' },
          ] }]}
        />
        <span className="text-[12px] adm-t3 ml-auto">{state.total} page{state.total === 1 ? '' : 's'}</span>
      </div>

      {state.loading ? (
        <Skeleton className="h-64" />
      ) : (
        <Table
          columns={columns}
          rows={state.rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelected(r.id)}
          empty={<div className="p-8 text-center adm-t3 text-sm">No pages{debounced ? ' match your search' : ' in the latest crawl'}.</div>}
        />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-[12px] adm-t3">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="adm-hoverable rounded-lg px-3 py-1.5 disabled:opacity-40">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="adm-hoverable rounded-lg px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {selected && <SeoInspector pageId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
