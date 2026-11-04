// Gifted Pro — admin side (super admin only; the server enforces it too).
// GiftForm: pick host(s), tenure, reason, note → eligibility preview → grant.
// GiftsTable: active / share-review / closed gifts with extend, revoke, share review.
// Used by Admin → Plans (bulk) and Host 360 (one host).
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  adminGetUsers, adminGiftEligibility, adminGrantGifts,
  adminListGifts, adminExtendGift, adminRevokeGift, adminReviewGiftShare,
} from '../../services/api';
import { Card, Btn, Badge } from './ui';

export const TENURES = [
  [1, '1 mo'], [2, '2 mo'], [6, '6 mo'], [12, '1 yr'], [24, '2 yr'], [60, '5 yr'],
];

// Mirrors planGiftService.addMonths (calendar months, month-end clamped) for the preview.
const addMonths = (date, n) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
};
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const tenureText = (m) => (m % 12 === 0 ? `${m / 12} yr` : `${m} mo`);
const errMsg = (e, fallback) => e?.response?.data?.message || fallback;

const TenurePills = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Gift length">
    {TENURES.map(([m, label]) => (
      <button key={m} type="button" role="radio" aria-checked={value === m} onClick={() => onChange(m)}
        className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors
          ${value === m ? 'bg-[#960D32] text-white' : 'adm-card adm-t2 adm-hoverable'}`}>
        {label}
      </button>
    ))}
  </div>
);

export const GiftForm = ({ presetHosts = null, onDone }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [hosts, setHosts] = useState(presetHosts || []);
  const [months, setMonths] = useState(1);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [campaign, setCampaign] = useState('');
  const [preview, setPreview] = useState(null); // { eligible, skipped }
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    try {
      const r = await adminGetUsers({ search: query });
      const rows = Array.isArray(r.data) ? r.data : r.data?.users || [];
      setResults(rows.filter((u) => u.role === 'host').slice(0, 8));
    } catch { toast.error('Search failed'); }
  };

  const add = (h) => { setHosts((xs) => (xs.some((x) => x.id === h.id) ? xs : [...xs, h])); setPreview(null); };
  const remove = (id) => { setHosts((xs) => xs.filter((x) => x.id !== id)); setPreview(null); };

  const check = async () => {
    if (!hosts.length) return toast.error('Pick at least one host');
    if (!reason.trim()) return toast.error('Add a reason (internal, for the audit log)');
    setBusy(true);
    try {
      const r = await adminGiftEligibility(hosts.map((h) => h.id));
      setPreview(r.data);
    } catch (e) { toast.error(errMsg(e, 'Eligibility check failed')); }
    finally { setBusy(false); }
  };

  const grant = async () => {
    setBusy(true);
    try {
      const r = await adminGrantGifts({
        host_ids: preview.eligible.map((h) => h.host_id), months,
        reason: reason.trim(), note: note.trim() || undefined, campaign: campaign.trim() || undefined,
      });
      const { granted, skipped } = r.data;
      toast.success(`Gifted Pro to ${granted.length} host${granted.length === 1 ? '' : 's'}${skipped.length ? ` · ${skipped.length} skipped` : ''}`);
      if (!presetHosts) setHosts([]);
      setPreview(null); setReason(''); setNote(''); setCampaign('');
      onDone?.();
    } catch (e) { toast.error(errMsg(e, 'Gift failed')); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {!presetHosts && (
        <>
          <div className="flex flex-wrap gap-2">
            <input className="fb-input text-sm flex-1 min-w-[200px]" placeholder="Search host by name/email…"
              value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
            <Btn variant="outline" size="sm" onClick={search}>Search</Btn>
          </div>
          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm px-3 py-1.5 rounded-lg bg-[var(--adm-hover)]">
                  <span className="adm-t2">{u.name} <span className="text-xs adm-t3">({u.email})</span></span>
                  <button onClick={() => add(u)} className="text-xs font-bold text-[#960D32] hover:underline">Add</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {hosts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hosts.map((h) => (
            <span key={h.id} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] bg-[var(--adm-hover)] adm-t2">
              {h.name || h.email}
              {!presetHosts && <button onClick={() => remove(h.id)} aria-label={`Remove ${h.name}`} className="adm-t3 hover:text-red-600">×</button>}
            </span>
          ))}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold adm-t3 mb-1.5">Gift length</p>
        <TenurePills value={months} onChange={(m) => { setMonths(m); setPreview(null); }} />
        <p className="text-xs adm-t3 mt-1.5">Ends on <strong className="adm-t2">{fmt(addMonths(new Date(), months))}</strong> if granted today.</p>
      </div>

      <input className="fb-input text-sm w-full" placeholder="Reason (required, internal — audit log only)" maxLength={500}
        value={reason} onChange={(e) => setReason(e.target.value)} />
      <div>
        <textarea className="fb-input text-sm w-full" rows={2} maxLength={280}
          placeholder="Personal note (optional) — shown to the host in Shubham's gift email"
          value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="text-[11px] adm-t3 text-right">{note.length}/280</p>
      </div>
      {!presetHosts && (
        <input className="fb-input text-sm w-full" placeholder="Campaign label (optional), e.g. nov-first-booking" maxLength={60}
          value={campaign} onChange={(e) => setCampaign(e.target.value)} />
      )}

      {preview && (
        <div className="rounded-lg bg-[var(--adm-hover)] px-3 py-2 text-[12.5px] adm-t2 space-y-1">
          <p><strong>{preview.eligible.length}</strong> will receive Pro for {tenureText(months)}.</p>
          {preview.skipped.map((s) => (
            <p key={s.host_id} className="adm-t3">Skipped {s.name || s.host_id}: {s.reason}</p>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {preview && preview.eligible.length > 0 ? (
          <Btn size="sm" onClick={grant} disabled={busy}>{busy ? 'Gifting…' : `Gift Pro to ${preview.eligible.length}`}</Btn>
        ) : (
          <Btn size="sm" onClick={check} disabled={busy}>{busy ? 'Checking…' : 'Check eligibility'}</Btn>
        )}
      </div>
    </div>
  );
};

const TABS = [
  ['active', 'Active'], ['share_pending', 'Share review'], ['ended', 'Ended'],
  ['revoked', 'Revoked'], ['converted', 'Converted'], ['all', 'All'],
];
const STATUS_TONE = { active: 'ok', ended: 'neutral', revoked: 'danger', converted: 'info' };

export const GiftsTable = ({ refreshKey = 0 }) => {
  const [tab, setTab] = useState('active');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [extending, setExtending] = useState(null); // gift id
  const [extendMonths, setExtendMonths] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    adminListGifts({ status: tab })
      .then((r) => setRows(r.data.gifts || []))
      .catch((e) => toast.error(errMsg(e, 'Failed to load gifts')))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const act = async (fn, ok) => {
    try { await fn(); toast.success(ok); setExtending(null); load(); }
    catch (e) { toast.error(errMsg(e, 'Action failed')); }
  };

  const revoke = (g) => {
    const reason = window.prompt(`Revoke ${g.host?.name || 'this host'}'s gift? They drop to Starter now and get the "gift has expired" email.\n\nReason (internal):`);
    if (reason && reason.trim()) act(() => adminRevokeGift(g.id, reason.trim()), 'Gift revoked');
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold adm-t1">Gifts</h2>
        <div className="flex flex-wrap gap-1 adm-card rounded-xl p-1">
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-2.5 py-1 rounded-lg text-[12px] font-medium ${tab === key ? 'bg-[#960D32] text-white' : 'adm-t2'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-center text-sm adm-t3 py-6">Loading…</p>
        : !rows.length ? <p className="text-center text-sm adm-t3 py-6">No gifts here.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10px] font-semibold adm-t3 uppercase tracking-wide">
                <th className="pb-2 pr-3">Host</th><th className="pb-2 pr-3">Length</th><th className="pb-2 pr-3">Ends</th>
                <th className="pb-2 pr-3">Campaign</th><th className="pb-2 pr-3">Status</th><th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className="border-t adm-border align-top">
                  <td className="py-2 pr-3">
                    <p className="adm-t1 font-medium">{g.host?.name || '—'}</p>
                    <p className="text-[11px] adm-t3">{g.host?.email}</p>
                  </td>
                  <td className="py-2 pr-3 adm-t2">
                    {tenureText(g.months)}{g.extended_months ? <span className="adm-t3"> +{tenureText(g.extended_months)}</span> : null}
                  </td>
                  <td className="py-2 pr-3 adm-t2">{fmt(g.ends_at)}</td>
                  <td className="py-2 pr-3 adm-t3">{g.campaign || '—'}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={STATUS_TONE[g.status] || 'neutral'}>{g.status}</Badge>
                    {g.share_status && (
                      <p className="text-[11px] adm-t3 mt-1">
                        Share: {g.share_status}{g.share_url && <> · <a href={g.share_url} target="_blank" rel="noreferrer" className="text-[#960D32] hover:underline">post</a></>}
                      </p>
                    )}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {g.status === 'active' && g.share_status === 'pending' && (
                      <span className="inline-flex gap-1.5 mr-2">
                        <Btn size="sm" onClick={() => act(() => adminReviewGiftShare(g.id, true), 'Share approved · +1 month')}>Approve +1 mo</Btn>
                        <Btn variant="outline" size="sm" onClick={() => act(() => adminReviewGiftShare(g.id, false), 'Share rejected')}>Reject</Btn>
                      </span>
                    )}
                    {g.status === 'active' && (extending === g.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <select className="fb-input text-xs w-20" value={extendMonths} onChange={(e) => setExtendMonths(Number(e.target.value))}>
                          {TENURES.map(([m, label]) => <option key={m} value={m}>+{label}</option>)}
                        </select>
                        <Btn size="sm" onClick={() => act(() => adminExtendGift(g.id, extendMonths), 'Gift extended')}>Save</Btn>
                        <Btn variant="ghost" size="sm" onClick={() => setExtending(null)}>Cancel</Btn>
                      </span>
                    ) : (
                      <span className="inline-flex gap-1.5">
                        <Btn variant="outline" size="sm" onClick={() => { setExtending(g.id); setExtendMonths(1); }}>Extend</Btn>
                        <Btn variant="outline" size="sm" className="!text-red-600" onClick={() => revoke(g)}>Revoke</Btn>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
