import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Btn, Table, Skeleton } from '../../../components/admin/ui';
import { crmListLists, crmCreateList, crmGetList, crmListLeads, crmBulk, crmImportCommit, crmListTags, adminCampCreateSegment } from '../../../services/api';
import { relTime } from './salesConstants';
import TagChip from './TagChip';
import LeadDrawer from './LeadDrawer';
import toast from 'react-hot-toast';

const PAGE_SIZE = 25;

// Minimal CSV parse (quotes + escaped quotes + embedded newlines).
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; } if (c === '\r' && text[i + 1] === '\n') i++; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const HEADER_MAP = { name: 'name', phone: 'phone', whatsapp: 'whatsapp', email: 'email', business: 'business', company: 'business', profession: 'profession', website: 'website', linkedin: 'linkedin', instagram: 'instagram', twitter: 'twitter', x: 'x', youtube: 'youtube', facebook: 'facebook', city: 'city', tags: 'tags' };

// CSV-sourced URLs are admin-uploaded but unsanitized — only render http(s) as a link (blocks javascript: etc).
const isHttpUrl = (u) => typeof u === 'string' && u.startsWith('http');

export default function SalesLists() {
  const { id } = useParams();
  return id ? <ListDetail listId={id} /> : <ListsIndex />;
}

function ListsIndex() {
  const [lists, setLists] = useState(null);
  const nav = useNavigate();
  const load = useCallback(() => crmListLists().then(({ data }) => setLists(Array.isArray(data) ? data : [])).catch(() => setLists([])), []);
  useEffect(() => { load(); }, [load]);

  const newList = async () => {
    const name = prompt('New list name (e.g. "Instagram — Oct"):'); if (!name || !name.trim()) return;
    const source = prompt('Source tag (instagram / linkedin / topmate / manual):', 'manual') || 'manual';
    try { const { data } = await crmCreateList({ name: name.trim(), source: source.trim(), consentBasis: 'b2b_legitimate_interest' }); nav(`/admin/sales/lists/${data.id}`); }
    catch (e) { toast.error(e.response?.data?.message || 'Could not create'); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <PageHeader title="Lists" subtitle="Cold contact pools. Import bulk data, cold-email, then promote responders to the pipeline."
        actions={<Btn size="sm" onClick={newList}>+ New list</Btn>} />
      {lists === null ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        : lists.length === 0 ? <Card className="rounded-2xl p-10 text-center adm-t3">No lists yet. Create one and import a CSV.</Card>
        : <div className="grid gap-3 sm:grid-cols-2">
            {lists.map((l) => (
              <Card key={l.id} className="rounded-2xl p-4 cursor-pointer adm-hoverable" onClick={() => nav(`/admin/sales/lists/${l.id}`)}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold adm-t1 truncate">{l.name}</div>
                  <span className="text-[12px] adm-t3">{l.cold_count} cold</span>
                </div>
                <p className="text-[11px] adm-t3 mt-1">{l.source || '—'} · created {relTime(l.created_at)}</p>
              </Card>
            ))}
          </div>}
    </div>
  );
}

function ListDetail({ listId }) {
  const [list, setList] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(new Set());
  const [showImport, setShowImport] = useState(false);
  const [drawerId, setDrawerId] = useState(null);
  // Filters
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');            // debounced search
  const [tagCatalog, setTagCatalog] = useState([]);

  useEffect(() => { crmGetList(listId).then(({ data }) => setList(data)).catch(() => setList(null)); }, [listId]);
  useEffect(() => { crmListTags().then(({ data }) => setTagCatalog(Array.isArray(data) ? data : [])).catch(() => setTagCatalog([])); }, []);
  // Debounce the search box (300ms) so we don't query per keystroke.
  const t = useRef();
  useEffect(() => { clearTimeout(t.current); t.current = setTimeout(() => { setDq(q); setPage(1); }, 300); return () => clearTimeout(t.current); }, [q]);

  const load = useCallback(() => {
    setLoading(true);
    crmListLeads({ listId, tag: tag || undefined, q: dq || undefined, page, pageSize: PAGE_SIZE })
      .then(({ data }) => { setRows(data.rows || []); setTotal(data.total || 0); })
      .catch(() => { setRows([]); setTotal(0); }).finally(() => setLoading(false));
  }, [listId, tag, dq, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSel(new Set()); }, [rows]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allSel ? new Set() : new Set(rows.map((r) => r.id)));

  const bulk = async (action, value, payload) => {
    if (!sel.size) return;
    try { const { data } = await crmBulk({ ids: [...sel], action, value, payload });
      toast.success(`${data.done}/${data.total} ${action === 'status' ? 'promoted' : 'queued'}`); setSel(new Set()); load(); }
    catch { toast.error('Bulk action failed'); }
  };

  // Save the current filter as a reusable CAMPAIGN segment over the prospect
  // contacts synced from this list's leads. Scoped by the list's source tag (every
  // contact here carries it) AND the active tag filter — both 'contains', so the
  // resolver ANDs them. Free-text search is view-only (segments filter by tag, not text).
  const createSegment = async () => {
    const scopeTag = list?.source;
    if (!scopeTag) return toast.error('This list has no source tag to scope a segment');
    const name = prompt('Name this campaign segment:', tag ? `${list.name} · ${tag}` : list.name);
    if (!name || !name.trim()) return;
    const filters = [{ field: 'tags', op: 'contains', value: scopeTag }];
    if (tag) filters.push({ field: 'tags', op: 'contains', value: tag });
    try {
      await adminCampCreateSegment({ name: name.trim(), description: `List "${list.name}"${tag ? ` · tag ${tag}` : ''}`, definition: { contact_type: 'prospect', filters } });
      toast.success(`Segment "${name.trim()}" saved — pick it in Campaigns`);
    } catch (e) { toast.error(e.response?.data?.message || 'Could not save segment'); }
  };

  const Links = ({ r }) => (
    <div className="flex gap-1.5 text-[13px]">
      {isHttpUrl(r.website) && <a href={r.website} target="_blank" rel="noreferrer" title="Website" onClick={(e) => e.stopPropagation()}>🌐</a>}
      {isHttpUrl(r.linkedin) && <a href={r.linkedin} target="_blank" rel="noreferrer" title="LinkedIn" onClick={(e) => e.stopPropagation()}>in</a>}
      {isHttpUrl(r.instagram) && <a href={r.instagram} target="_blank" rel="noreferrer" title="Instagram" onClick={(e) => e.stopPropagation()}>ig</a>}
    </div>
  );

  const columns = [
    { key: 'sel', label: <input type="checkbox" checked={allSel} onChange={toggleAll} />, className: 'w-8',
      render: (r) => <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} /> },
    { key: 'name', label: 'Name', render: (r) => (
      <div className="min-w-0 px-1.5"><div className="font-semibold adm-t1 truncate">{r.name || <span className="adm-t3">Unnamed</span>}</div>
        <p className="text-[11px] adm-t3 truncate">{[r.phone, r.email].filter(Boolean).join(' · ') || '—'}</p></div>) },
    { key: 'business', label: 'Business', render: (r) => <span className="adm-t2">{r.business_name || '—'}</span> },
    { key: 'links', label: 'Links', render: (r) => <Links r={r} /> },
    { key: 'tags', label: 'Tags', render: (r) => (r.tags || []).length ? <div className="flex flex-wrap gap-1">{r.tags.slice(0, 3).map((t) => <TagChip key={t} name={t} />)}</div> : <span className="adm-t3">—</span> },
    { key: 'added', label: 'Added', render: (r) => <span className="text-[11px] adm-t3">{relTime(r.created_at)}</span> },
  ];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <PageHeader title={list?.name || 'List'} subtitle={`${total} cold contact${total === 1 ? '' : 's'} · ${list?.source || '—'}`}
        actions={<Btn variant="outline" size="sm" onClick={() => setShowImport(true)}>Import CSV</Btn>} />

      {/* Filters + segment. Search is view-only; the segment captures the tag filter. */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input className="fb-input text-sm flex-1 min-w-[200px]" placeholder="Search name, business, phone, email…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="fb-input text-sm w-auto min-w-[130px]" value={tag} onChange={(e) => { setTag(e.target.value); setPage(1); }}>
          <option value="">Any tag</option>
          {tagCatalog.map((tg) => <option key={tg.id} value={tg.name}>{tg.name}</option>)}
        </select>
        {(tag || q) && <Btn variant="outline" size="sm" onClick={() => { setTag(''); setQ(''); setDq(''); setPage(1); }}>Clear</Btn>}
        <Btn size="sm" className="ml-auto" onClick={createSegment}>↗ Create segment</Btn>
      </div>

      {sel.size > 0 && (
        <Card className="mb-3 rounded-xl p-3 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold adm-t1">{sel.size} selected</span>
          <Btn size="sm" onClick={() => { if (confirm(`Promote ${sel.size} to the pipeline (→ New)?`)) bulk('status', 'new'); }}>Promote → New</Btn>
          <Btn variant="outline" size="sm" onClick={() => bulk('email', null, promptEmail())}>Cold email</Btn>
          <button className="text-[12px] adm-t3 ml-auto" onClick={() => setSel(new Set())}>Clear</button>
        </Card>
      )}

      {loading ? <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        : rows.length === 0 ? <Card className="rounded-2xl p-10 text-center adm-t3">No contacts yet. Import a CSV.</Card>
        : <Table columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => setDrawerId(r.id)} />}

      {!loading && (rows.length > 0 || page > 1) && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-[12px] adm-t3">{total} · page {page}/{totalPages}</span>
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Btn>
            <Btn variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Btn>
          </div>
        </div>
      )}

      <LeadDrawer leadId={drawerId} onClose={() => setDrawerId(null)} onChanged={() => { load(); }} />
      {showImport && <ImportModal listId={listId} onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load(); }} />}
    </div>
  );
}

// Minimal cold-email prompt (reuses the gated bulk email path). Returns a payload
// or throws-safe empty; the send worker still enforces the kill-switch + opt-out.
function promptEmail() {
  const subject = window.prompt('Cold email subject ({{first_name}} supported):'); if (!subject) return { subject: '', html: '' };
  const html = window.prompt('HTML body:') || ''; return { subject, html };
}

function ImportModal({ listId, onClose, onDone }) {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const onFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const grid = parseCsv(await file.text()).filter((r) => r.some((c) => c.trim()));
    if (grid.length < 2) return toast.error('Empty CSV');
    const headers = grid[0].map((h) => HEADER_MAP[h.trim().toLowerCase()] || h.trim().toLowerCase());
    const parsed = grid.slice(1).map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] || '').trim()])))
      .filter((r) => r.email || r.phone);
    setRows(parsed); setCount(parsed.length);
  };
  const commit = async () => {
    setBusy(true);
    try { const { data } = await crmImportCommit(rows, listId); toast.success(`Imported: ${data.created} new, ${data.merged} merged, ${data.skipped} skipped`); onDone(); }
    catch { toast.error('Import failed'); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="rounded-2xl p-5 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-bold adm-t1 mb-2">Import into list (CSV)</h2>
        <p className="text-[12px] adm-t3 mb-3">Headers: name, email, phone, whatsapp, business, profession, website, linkedin, instagram, city, tags. Rows without email or phone are skipped.</p>
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm mb-3" />
        {count > 0 && <p className="text-[13px] adm-t2 mb-3">{count} contacts ready.</p>}
        <div className="flex justify-end gap-2">
          <Btn variant="outline" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" onClick={commit} disabled={busy || !count}>{busy ? 'Importing…' : `Import ${count}`}</Btn>
        </div>
      </Card>
    </div>
  );
}
