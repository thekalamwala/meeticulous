// AdminSeo.jsx — /admin/seo control center. A secondary rail switches between the
// Dashboard, list-first views (Services / Profiles / Blog / Pages) each with a
// right-side inspector drawer, and the operational tabs (Issues / Fixes / Search
// Console). View is the :view route param so every tab is a real, linkable URL.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Ic from '../../components/admin/Ic';
import { IC } from '../../components/admin/adminNav';
import { PageHeader, Card, Badge, Skeleton, Btn } from '../../components/admin/ui';
import {
  adminSeoIssues, adminSeoFixes, adminSeoGenerateFixes, adminSeoDecideFix,
  adminSeoApplyFix, adminSeoMarkApplied, adminSeoRollbackFix, adminSeoRetestFix,
  adminSeoRunCrawl, adminSeoCrawlStatus, adminSeoMuteIssue, adminSeoGsc, adminSeoGscStatus, adminSeoGscSync,
} from '../../services/api';
import SeoDashboard from '../../components/admin/seo/SeoDashboard';
import SeoList from '../../components/admin/seo/SeoList';
import SeoNetwork from '../../components/admin/seo/SeoNetwork';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const secs = (ms) => (ms == null ? '' : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`);

// One sequential progress line (Crawl, then Search Console) with a live timer.
function PhaseLine({ label, state, elapsed, note }) {
  return (
    <div className="flex items-center gap-2">
      {state === 'active' && <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" style={{ color: 'var(--adm-accent)' }} />}
      {state === 'done' && <Ic d={IC.check} size={14} style={{ color: 'var(--adm-ok)' }} />}
      {state === 'error' && <span style={{ color: 'var(--adm-danger)' }}>✕</span>}
      {state === 'pending' && <span className="inline-block w-3.5 h-3.5 rounded-full border-2 adm-t3" style={{ opacity: 0.3 }} />}
      {state === 'skipped' && <span className="adm-t3">–</span>}
      <span className={state === 'pending' ? 'adm-t3' : 'adm-t1 font-medium'}>{label}</span>
      {state === 'skipped' && <span className="adm-t3 text-[12px]">not connected — skipped</span>}
      {elapsed != null && state !== 'pending' && state !== 'skipped' && <span className="adm-t3 tabular-nums text-[12px]">{secs(elapsed)}</span>}
      {note && <span className="adm-t3 text-[12px]">· {note}</span>}
    </div>
  );
}

function RunStatus({ job, onDismiss }) {
  const now = Date.now();
  const crawlEl = job.crawlStart ? (job.crawlEnd || now) - job.crawlStart : null;
  const gscEl = job.gscStart ? (job.gscEnd || now) - job.gscStart : null;
  const total = job.crawlStart ? (job.gscEnd || job.crawlEnd || now) - job.crawlStart : null;
  const crawlState = job.phase === 'error' && !job.crawlEnd ? 'error' : job.crawlEnd ? 'done' : job.phase === 'crawl' ? 'active' : 'pending';
  const gscState = job.gscSkipped ? 'skipped' : (job.phase === 'error' && job.crawlEnd && !job.gscEnd) ? 'error' : job.gscEnd ? 'done' : job.phase === 'gsc' ? 'active' : 'pending';
  return (
    <Card className="mb-4 py-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1.5 text-[13px]">
          <PhaseLine label="1 · Crawl site" state={crawlState} elapsed={crawlEl} />
          <PhaseLine label="2 · Sync Search Console" state={gscState} elapsed={gscEl} note={job.gscTimeout ? 'started — still finishing in background' : undefined} />
        </div>
        <div className="flex items-center gap-3">
          {job.phase === 'done' && <Badge tone="ok">Done in {secs(total)}</Badge>}
          {job.phase === 'error' && <Badge tone="danger">{job.error || 'Failed'}</Badge>}
          {job.active && <span className="adm-t3 text-[12px] tabular-nums">{secs(total)}</span>}
          {!job.active && <button onClick={onDismiss} className="adm-t3 text-[12px] adm-hoverable rounded px-2 py-1">Dismiss</button>}
        </div>
      </div>
    </Card>
  );
}

const SEVERITY_TONE = { P0: 'danger', P1: 'danger', P2: 'warn', P3: 'neutral', P4: 'neutral' };
const LEVEL_TONE = { AUTO: 'ok', REVIEW: 'warn', DO_NOT: 'danger' };
const CATEGORIES = ['technical', 'onpage', 'content', 'semantic', 'structured_data', 'indexability', 'internal_linking'];

export default function AdminSeo() {
  const { view = 'dashboard' } = useParams();
  const [job, setJob] = useState(null);
  const [, setTick] = useState(0); // drives the live timer while a run is active
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  useEffect(() => {
    if (!job?.active) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [job?.active]);

  // One button, two phases, in order: crawl the site → then sync Search Console.
  // Each phase polls to real completion (crawl via crawl status; GSC via the newest
  // last_synced advancing), so the UI shows genuine done/failed, never a guess.
  const runAll = async () => {
    if (job?.active) return;
    const j = { active: true, phase: 'crawl', crawlStart: Date.now() };
    setJob({ ...j });
    try {
      const { data } = await adminSeoRunCrawl();
      let status = 'running'; let ticks = 0;
      while (status === 'running' && ticks < 90 && mountedRef.current) {
        await sleep(2000); // eslint-disable-line no-await-in-loop
        const res = await adminSeoCrawlStatus(data.crawlId); // eslint-disable-line no-await-in-loop
        status = res.data.crawl?.status; ticks += 1;
      }
      if (!mountedRef.current) return;
      if (status === 'running') throw new Error('Crawl timed out — still running in the background.');
      j.crawlEnd = Date.now(); j.phase = 'gsc'; j.gscStart = Date.now(); setJob({ ...j });

      const before = await adminSeoGscStatus().then((r) => r.data).catch(() => ({ configured: true, last_synced: null }));
      if (before.configured === false) {
        j.gscSkipped = true; j.gscEnd = Date.now();
      } else {
        await adminSeoGscSync();
        let advanced = false; let t2 = 0;
        while (!advanced && t2 < 40 && mountedRef.current) { // ~2min at 3s/tick
          await sleep(3000); // eslint-disable-line no-await-in-loop
          const s = await adminSeoGscStatus().then((r) => r.data).catch(() => ({})); // eslint-disable-line no-await-in-loop
          if (s.last_synced && (!before.last_synced || s.last_synced > before.last_synced)) advanced = true;
          t2 += 1;
        }
        if (!mountedRef.current) return;
        j.gscEnd = Date.now(); if (!advanced) j.gscTimeout = true;
      }
      j.phase = 'done'; j.active = false; setJob({ ...j });
      toast.success('Crawl + Search Console sync complete');
    } catch (e) {
      if (!mountedRef.current) return;
      j.phase = 'error'; j.active = false; j.error = e.response?.data?.message || e.message || 'Failed'; setJob({ ...j });
      toast.error(j.error);
    }
  };

  return (
    <div>
      <PageHeader
        title="SEO & GEO"
        subtitle="Traditional search health + AI/GEO readiness. List → inspect → diagnose → fix → measure."
        actions={<Btn variant="primary" size="sm" icon="refresh" onClick={runAll} disabled={job?.active}>{job?.active ? (job.phase === 'crawl' ? 'Crawling…' : 'Syncing…') : 'Run crawl + sync'}</Btn>}
      />
      {job && <RunStatus job={job} onDismiss={() => setJob(null)} />}

      {view === 'dashboard' && <SeoDashboard />}
      {view === 'services' && <SeoList type="service" />}
      {view === 'profiles' && <SeoList type="host" />}
      {view === 'blogs' && <SeoList type="blog" />}
      {view === 'pages' && <SeoList type="static,unknown" />}
      {view === 'network' && <SeoNetwork />}
      {view === 'issues' && <IssuesTab />}
      {view === 'fixes' && <FixesTab />}
      {view === 'search-console' && <GscTab />}
    </div>
  );
}

// ── Issues (operational) ─────────────────────────────────────────────────────
function IssuesTab() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (severity) params.severity = severity;
      if (category) params.category = category;
      const res = await adminSeoIssues(params);
      setIssues(res.data.issues || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load SEO issues');
      setIssues([]);
    } finally { setLoading(false); }
  }, [severity, category]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <select className="fb-input text-sm" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All severities</option>
          {['P0', 'P1', 'P2', 'P3', 'P4'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="fb-input text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {loading ? <Skeleton className="h-40" /> : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
              <th className="text-left py-2 px-4">Severity</th>
              <th className="text-left py-2 px-4">Category</th>
              <th className="text-left py-2 px-4">Title</th>
            </tr></thead>
            <tbody>
              {issues.map((iss) => (
                <tr key={iss.id} className="border-b adm-border last:border-0 cursor-pointer adm-hoverable" onClick={() => setSelected(iss)}>
                  <td className="py-2 px-4"><Badge tone={SEVERITY_TONE[iss.severity]}>{iss.severity}</Badge></td>
                  <td className="py-2 px-4 capitalize">{iss.category}</td>
                  <td className="py-2 px-4">{iss.title}</td>
                </tr>
              ))}
              {!issues.length && <tr><td colSpan={3} className="py-6 text-center adm-t3">No issues found.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}
      {selected && <IssueDrawer issue={selected} onClose={() => setSelected(null)} onMuted={load} />}
    </div>
  );
}

function IssueDrawer({ issue, onClose, onMuted }) {
  const [muting, setMuting] = useState(false);
  const mute = async () => {
    setMuting(true);
    try {
      await adminSeoMuteIssue(issue.id, { ruleType: true });
      toast.success('Issue muted'); onMuted?.(); onClose();
    } catch (e) { toast.error(e.response?.data?.message || 'Mute failed'); } finally { setMuting(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full w-full max-w-md overflow-y-auto adm-canvas shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold adm-t1">{issue.title}</h2>
          <button onClick={onClose} className="adm-t3" aria-label="Close">✕</button>
        </div>
        <div className="space-y-3 text-sm">
          <div><span className="adm-t3">Severity</span><div><Badge tone={SEVERITY_TONE[issue.severity]}>{issue.severity}</Badge></div></div>
          <div><span className="adm-t3">Category</span><div className="capitalize">{issue.category}</div></div>
          {issue.detail && <div><span className="adm-t3">Why it matters</span><div>{issue.detail}</div></div>}
          {issue.affected_url && <div><span className="adm-t3">Affected URL</span><div className="break-all">{issue.affected_url}</div></div>}
          {issue.evidence && <div><span className="adm-t3">Evidence</span><pre className="text-xs adm-card p-2 rounded whitespace-pre-wrap">{typeof issue.evidence === 'string' ? issue.evidence : JSON.stringify(issue.evidence, null, 2)}</pre></div>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium adm-t2 adm-hoverable">Cancel</button>
          <button onClick={mute} disabled={muting} className="rounded-lg bg-[#960D32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2A1416] disabled:opacity-50">{muting ? 'Muting…' : 'Mute this type'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Fixes (Phase 2/3 queue) ──────────────────────────────────────────────────
function FixesTab() {
  const [fixes, setFixes] = useState([]);
  const [summary, setSummary] = useState({});
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [level, setLevel] = useState('');
  const [status, setStatus] = useState('proposed');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (level) params.approvalLevel = level;
      const res = await adminSeoFixes(params);
      setFixes(res.data.fixes || []);
      setSummary(res.data.summary || {});
      setDryRun(res.data.dryRun !== false);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load fixes');
      setFixes([]);
    } finally { setLoading(false); }
  }, [level, status]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data } = await adminSeoGenerateFixes();
      if (data.skipped) toast(data.skipped); else toast.success(`Proposed ${data.proposed} fix(es)`);
      await load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to generate proposals'); } finally { setGenerating(false); }
  };

  const byLevel = summary.byLevel || {};
  return (
    <div>
      <Card className="mb-4 text-sm flex items-center justify-between">
        <div>
          {dryRun ? <Badge tone="warn">DRY RUN</Badge> : <Badge tone="danger">LIVE APPLY</Badge>}
          <span className="ml-3 adm-t3">Proposals only — approving stages a fix; nothing publishes in this phase.</span>
        </div>
        <Btn variant="primary" size="sm" onClick={generate} disabled={generating}>{generating ? 'Generating…' : 'Generate proposals'}</Btn>
      </Card>
      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <select className="fb-input text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          {['proposed', 'approved', 'applied', 'failed', 'rejected', 'rolled_back', ''].map((s) => <option key={s || 'all'} value={s}>{s || 'all statuses'}</option>)}
        </select>
        <select className="fb-input text-sm" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">All levels</option>
          {['AUTO', 'REVIEW', 'DO_NOT'].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <div className="flex gap-2">{['AUTO', 'REVIEW', 'DO_NOT'].map((l) => <Badge key={l} tone={LEVEL_TONE[l]}>{l}: {byLevel[l] || 0}</Badge>)}</div>
      </div>
      {loading ? <Skeleton className="h-40" /> : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
              <th className="text-left py-2 px-4">Level</th>
              <th className="text-left py-2 px-4">Rule</th>
              <th className="text-left py-2 px-4">URL</th>
              <th className="text-left py-2 px-4">Target</th>
              <th className="text-left py-2 px-4">Evidence</th>
            </tr></thead>
            <tbody>
              {fixes.map((f) => (
                <tr key={f.id} className="border-b adm-border last:border-0 cursor-pointer adm-hoverable" onClick={() => setSelected(f)}>
                  <td className="py-2 px-4"><Badge tone={LEVEL_TONE[f.approval_level] || 'neutral'}>{f.approval_level}</Badge></td>
                  <td className="py-2 px-4">{f.rule_key}</td>
                  <td className="py-2 px-4 break-all">{f.url}</td>
                  <td className="py-2 px-4">{f.target}</td>
                  <td className="py-2 px-4">{f.evidence_maturity || '—'}</td>
                </tr>
              ))}
              {!fixes.length && <tr><td colSpan={5} className="py-6 text-center adm-t3">No proposals — run Generate proposals after a crawl.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}
      {selected && <FixDrawer fix={selected} onClose={() => setSelected(null)} onDecided={load} />}
    </div>
  );
}

function FixDrawer({ fix, onClose, onDecided }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const run = async (fn, okMsg) => {
    setBusy(true); setNote(null);
    try {
      const res = await fn();
      const d = res?.data || {};
      if (d.ok === false) {
        setNote(d.message || d.reason || 'No change applied.');
        if (d.dryRun) toast('DRY_RUN — nothing applied.'); else if (d.requiresPr) toast('Land this as a PR, then Mark applied.'); else toast(d.message || 'No change applied.');
      } else if (d.retest) {
        toast(d.resolved ? 'Re-test: issue resolved ✓' : 'Re-test: issue still present');
        setNote(`Re-test → ${d.retest.status} · health ${d.retest.health}${d.resolved != null ? ` · resolved: ${d.resolved}` : ''}`);
      } else { toast.success(okMsg); onDecided?.(); onClose(); return; }
      onDecided?.();
    } catch (e) { toast.error(e.response?.data?.message || 'Action failed'); } finally { setBusy(false); }
  };
  const st = fix.status;
  const canApprove = fix.approval_level !== 'DO_NOT';
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full w-full max-w-md overflow-y-auto adm-canvas shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold adm-t1">{fix.rule_key}</h2>
          <button onClick={onClose} className="adm-t3" aria-label="Close">✕</button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex gap-2"><Badge tone={LEVEL_TONE[fix.approval_level] || 'neutral'}>{fix.approval_level}</Badge><Badge tone="neutral">{st}</Badge></div>
          <div><span className="adm-t3">URL</span><div className="break-all">{fix.url}</div></div>
          <div><span className="adm-t3">Target / field</span><div>{fix.target}{fix.field ? ` · ${fix.field}` : ''}</div></div>
          {fix.reason && <div><span className="adm-t3">Reason</span><div>{fix.reason}</div></div>}
          {fix.new_value != null && (
            <div><span className="adm-t3">Change</span><pre className="text-xs adm-card p-2 rounded whitespace-pre-wrap"><span className="text-red-600">- {fix.old_value ?? '(none)'}</span>{'\n'}<span className="text-green-700">+ {fix.new_value}</span></pre></div>
          )}
          {fix.new_value == null && <div><span className="adm-t3">Content context</span><pre className="text-xs adm-card p-2 rounded whitespace-pre-wrap">{JSON.stringify(fix.context || {}, null, 2)}</pre></div>}
          {fix.test_after && Object.keys(fix.test_after).length > 0 && (
            <div><span className="adm-t3">Re-test</span><div>{fix.test_after.status} · health {fix.test_after.health} · resolved: {String(fix.test_after.resolved)}</div></div>
          )}
          {note && <div className="text-xs rounded bg-amber-50 text-amber-800 p-2">{note}</div>}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button onClick={() => run(() => adminSeoRetestFix(fix.id))} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-medium adm-t2 adm-hoverable disabled:opacity-50">Re-test</button>
          {st === 'proposed' && (
            <>
              <button onClick={() => run(() => adminSeoDecideFix(fix.id, { decision: 'reject' }), 'Rejected')} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-medium adm-t2 adm-hoverable disabled:opacity-50">Reject</button>
              {canApprove && <button onClick={() => run(() => adminSeoDecideFix(fix.id, { decision: 'approve' }), 'Approved (staged)')} disabled={busy} className="rounded-lg bg-[#960D32] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2A1416] disabled:opacity-50">Approve (stage)</button>}
            </>
          )}
          {st === 'approved' && (
            fix.target === 'db_field'
              ? <button onClick={() => run(() => adminSeoApplyFix(fix.id), 'Applied')} disabled={busy} className="rounded-lg bg-[#960D32] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2A1416] disabled:opacity-50">Apply</button>
              : <button onClick={() => run(() => adminSeoMarkApplied(fix.id, {}), 'Marked applied')} disabled={busy} className="rounded-lg bg-[#960D32] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2A1416] disabled:opacity-50">Mark applied (PR landed)</button>
          )}
          {(st === 'applied' || st === 'failed') && (
            <button onClick={() => run(() => adminSeoRollbackFix(fix.id), 'Rolled back')} disabled={busy} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">Rollback</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Search Console ───────────────────────────────────────────────────────────
function GscTab() {
  const [gsc, setGsc] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadGsc = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminSeoGsc();
      setGsc(res.data.gsc || []);
      setConfigured(!!res.data.configured);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to load Search Console data'); setGsc([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadGsc(); }, [loadGsc]);

  if (loading) return <Skeleton className="h-40" />;
  return (
    <div>
      {!configured && <Card className="mb-4 text-sm">Google Search Console not connected — set GSC_SA_KEY and GSC_PROPERTY to enable.</Card>}
      <div className="flex justify-end mb-3"><span className="text-[12px] adm-t3">Use <b>Run crawl + sync</b> in the header to refresh this data.</span></div>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
            <th className="text-left py-2 px-4">URL</th>
            <th className="text-left py-2 px-4">Coverage</th>
            <th className="text-right py-2 px-4">Impressions</th>
            <th className="text-right py-2 px-4">Clicks</th>
            <th className="text-right py-2 px-4">Position</th>
          </tr></thead>
          <tbody>
            {gsc.map((row) => (
              <tr key={row.id || row.url} className="border-b adm-border last:border-0">
                <td className="py-2 px-4 break-all">{row.url}</td>
                <td className="py-2 px-4">{row.coverage_state || '—'}</td>
                <td className="py-2 px-4 text-right">{row.impressions ?? 0}</td>
                <td className="py-2 px-4 text-right">{row.clicks ?? 0}</td>
                <td className="py-2 px-4 text-right">{row.position != null ? Math.round(row.position) : '—'}</td>
              </tr>
            ))}
            {!gsc.length && <tr><td colSpan={5} className="py-6 text-center adm-t3">{configured ? 'No Search Console data yet — runs on the next gsc-sync' : 'No data — connect Search Console to enable.'}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
