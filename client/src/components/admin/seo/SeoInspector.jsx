// client/src/components/admin/seo/SeoInspector.jsx
// Right-side page inspector: performance, ranking queries, SEO + GEO "why not 100",
// prioritized fixes, and current-vs-previous history. Fetches the enriched page row.
import { useState, useEffect } from 'react';
import Ic from '../Ic';
import { IC } from '../adminNav';
import { Badge, Skeleton } from '../ui';
import { adminSeoPage } from '../../../services/api';
import Drawer from './Drawer';
import { ScoreDonut, ScoreBar, Delta, SectionTitle, scoreTone, toneColor, fmtNum, fmtPct, fmtPos, EVIDENCE_LABEL } from './seoShared';

const TIER_TONE = { HIGH: 'danger', MEDIUM: 'warn', LOW: 'neutral' };
const INDEX_TONE = (p) => (p.http_status && p.http_status !== 200 ? 'danger' : !p.indexable ? 'warn' : 'ok');
const INDEX_LABEL = (p) => (p.http_status && p.http_status !== 200 ? `HTTP ${p.http_status}` : !p.indexable ? 'Noindex' : 'Indexed');

// Metric tile for the performance row.
function Metric({ label, value, delta }) {
  return (
    <div className="rounded-xl adm-card px-3 py-2.5">
      <p className="text-[10px] font-semibold adm-t3 uppercase tracking-wide">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className="text-[17px] font-bold adm-t1 tabular-nums">{value}</span>
        {delta}
      </div>
    </div>
  );
}

// "You lost N points" list for one axis (SEO or GEO).
function WhyNot100({ result }) {
  const lostDims = (result.dimensions || []).filter((d) => d.lost > 0).sort((a, b) => b.lost - a.lost);
  const totalLost = 100 - result.score;
  if (!lostDims.length && !result.caps?.length) {
    return <p className="text-[13px] adm-t2">No points lost — this page is in great shape.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-[13px] adm-t2">
        You lost <span className="font-bold" style={{ color: toneColor(scoreTone(result.score)) }}>{totalLost} points</span>.
        {result.caps?.length ? ' Score is capped by a hard issue (see below).' : ''}
      </p>
      {result.caps?.map((c, i) => (
        <div key={`cap${i}`} className="rounded-lg p-2.5 border" style={{ borderColor: 'var(--adm-danger)', background: 'color-mix(in srgb, var(--adm-danger) 8%, transparent)' }}>
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: 'var(--adm-danger)' }}>
            <Ic d={IC.alert} size={13} /> Score capped at {c.cap}
          </div>
          <p className="text-[12px] adm-t2 mt-1">{c.reason}</p>
        </div>
      ))}
      {lostDims.map((d) => (
        <div key={d.key} className="rounded-lg adm-card p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Ic d={IC.alert} size={13} className="adm-t3 flex-shrink-0" />
              <span className="text-[12.5px] font-semibold adm-t1 truncate">{d.label}</span>
              <Badge tone="neutral" title={EVIDENCE_LABEL[d.evidence]}>{d.evidence}</Badge>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ScoreBar value={d.score} />
              <span className="text-[12.5px] font-bold tabular-nums" style={{ color: 'var(--adm-danger)' }}>−{d.lost}</span>
            </div>
          </div>
          <p className="text-[12px] adm-t2 mt-1.5">{d.reason}</p>
          {d.fix && <p className="text-[12px] mt-1" style={{ color: 'var(--adm-accent)' }}><span className="font-semibold">Fix:</span> {d.fix}</p>}
        </div>
      ))}
    </div>
  );
}

function QueryPill({ q, active, onClick }) {
  const c = toneColor(scoreTone(q.position != null ? (q.position <= 10 ? 90 : q.position <= 20 ? 60 : 40) : null));
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] adm-hoverable ${active ? 'ring-2' : ''}`}
      style={{ borderColor: 'var(--adm-border, #e5e7eb)' }}>
      <span className="adm-t1 truncate max-w-[180px]">{q.query}</span>
      <span className="font-semibold tabular-nums" style={{ color: c }}>#{fmtPos(q.position)}</span>
      {q.position_change != null && q.position_change !== 0 && (
        <Delta value={Number(q.position_change.toFixed?.(1) ?? q.position_change)} goodUp suffix="" />
      )}
    </button>
  );
}

export default function SeoInspector({ pageId, onClose }) {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeQuery, setActiveQuery] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setPage(null); setActiveQuery(null);
    adminSeoPage(pageId)
      .then((res) => { if (alive) setPage(res.data.page); })
      .catch(() => { if (alive) setPage(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [pageId]);

  const g = page?.gsc;
  const q = activeQuery;

  return (
    <Drawer
      open={!!pageId}
      onClose={onClose}
      title={page?.title || (loading ? 'Loading…' : 'Page')}
      subtitle={page?.url}
      headerRight={page && (
        <a href={page.url} target="_blank" rel="noopener noreferrer"
          className="adm-hoverable rounded-lg w-8 h-8 flex items-center justify-center adm-t2" title="Open live page">
          <Ic d={IC.external} size={15} />
        </a>
      )}
    >
      {loading ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      ) : !page ? (
        <p className="adm-t3 text-sm">Could not load this page.</p>
      ) : (
        <>
          {/* Header scores */}
          <div className="flex items-center gap-5 pb-4 border-b adm-border">
            <ScoreDonut value={page.seo_score} label="SEO" />
            <ScoreDonut value={page.geo_score} label="GEO" />
            <div className="flex flex-col gap-1.5">
              <Badge tone={INDEX_TONE(page)}>{INDEX_LABEL(page)}</Badge>
              <Badge tone="neutral">{page.page_type}</Badge>
              {page.signals?.bodySource === 'meta-only' && <Badge tone="warn" title="Scored from metadata only — no body content available">meta-only</Badge>}
            </div>
          </div>

          {/* PERFORMANCE */}
          <SectionTitle icon="bars" right={<span className="text-[10px] adm-t3 normal-case font-normal">Search Console · 28d vs prev 28d</span>}>Performance</SectionTitle>
          {g ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric label="Clicks" value={fmtNum(g.clicks)} delta={<Delta value={g.clicks_change} goodUp />} />
              <Metric label="Impressions" value={fmtNum(g.impressions)} delta={<Delta value={g.impressions_change} goodUp />} />
              <Metric label="CTR" value={fmtPct(g.ctr)} />
              <Metric label="Avg position" value={fmtPos(g.position)} delta={<Delta value={g.position_change} goodUp />} />
            </div>
          ) : (
            <p className="text-[13px] adm-t3">No Search Console data for this URL yet.</p>
          )}

          {/* RANKING QUERIES */}
          {page.queries?.length > 0 && (
            <>
              <SectionTitle icon="search">Ranking queries <span className="adm-t3 normal-case font-normal">({page.queries.length})</span></SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {page.queries.slice(0, 24).map((qq) => (
                  <QueryPill key={qq.query} q={qq} active={q?.query === qq.query} onClick={() => setActiveQuery(q?.query === qq.query ? null : qq)} />
                ))}
              </div>
              {q && (
                <div className="mt-2 rounded-lg adm-card p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[12px]">
                  <div className="col-span-2 sm:col-span-5 font-semibold adm-t1">{q.query}</div>
                  <div><span className="adm-t3 block text-[10px] uppercase">Position</span>{fmtPos(q.position)}</div>
                  <div><span className="adm-t3 block text-[10px] uppercase">Prev</span>{fmtPos(q.prev_position)}</div>
                  <div><span className="adm-t3 block text-[10px] uppercase">Change</span><Delta value={q.position_change} goodUp /></div>
                  <div><span className="adm-t3 block text-[10px] uppercase">Clicks</span>{fmtNum(q.clicks)}</div>
                  <div><span className="adm-t3 block text-[10px] uppercase">Impr.</span>{fmtNum(q.impressions)}</div>
                </div>
              )}
            </>
          )}

          {/* SEO SCORE */}
          <SectionTitle icon="checkCircle" right={<span className="text-[13px] font-bold" style={{ color: toneColor(scoreTone(page.seo_score)) }}>{page.seo_score}/100</span>}>SEO score</SectionTitle>
          <WhyNot100 result={page.seo} />

          {/* GEO SCORE */}
          <SectionTitle icon="zap" right={<span className="text-[13px] font-bold" style={{ color: toneColor(scoreTone(page.geo_score)) }}>{page.geo_score}/100</span>}>GEO / AEO readiness <span className="adm-t3 normal-case font-normal">· diagnostic</span></SectionTitle>
          <WhyNot100 result={page.geo} />

          {/* RECOMMENDED FIXES */}
          {page.recommendations?.length > 0 && (
            <>
              <SectionTitle icon="arrow">Recommended fixes</SectionTitle>
              <div className="space-y-1.5">
                {page.recommendations.slice(0, 8).map((r, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg adm-card p-2.5">
                    <Badge tone={TIER_TONE[r.tier]}>{r.tier}</Badge>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium adm-t1">{r.title}</p>
                      <p className="text-[11px] adm-t3 mt-0.5">
                        {r.axis} · {r.label} · impact {r.impact} · confidence {(r.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* HISTORY */}
          <SectionTitle icon="clock">History</SectionTitle>
          {page.previous ? (
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-lg adm-card p-2.5">
                <span className="adm-t3 block text-[10px] uppercase">SEO — prev → now</span>
                <span className="font-semibold adm-t1">{page.previous.seo_score} → {page.seo_score}</span>{' '}
                <Delta value={page.seo_score - page.previous.seo_score} goodUp />
              </div>
              <div className="rounded-lg adm-card p-2.5">
                <span className="adm-t3 block text-[10px] uppercase">GEO — prev → now</span>
                <span className="font-semibold adm-t1">{page.previous.geo_score} → {page.geo_score}</span>{' '}
                <Delta value={page.geo_score - page.previous.geo_score} goodUp />
              </div>
            </div>
          ) : (
            <p className="text-[13px] adm-t3">Historical data unavailable (needs a previous crawl of this URL).</p>
          )}
        </>
      )}
    </Drawer>
  );
}
