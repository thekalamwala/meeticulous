// client/src/components/admin/seo/SeoDashboard.jsx
// Decision-first overview: SEO/GEO health, index/attention/trend counts, top
// opportunities (what to work on next), and a by-type breakdown. GSC = outcome layer.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Ic from '../Ic';
import { IC } from '../adminNav';
import { StatCard, Card, Skeleton, Badge } from '../ui';
import { adminSeoDashboard } from '../../../services/api';
import SeoInspector from './SeoInspector';
import { ScoreChip, fmtNum, fmtPos, scoreTone, toneColor } from './seoShared';

const TYPE_VIEW = { service: 'services', host: 'profiles', blog: 'blogs', static: 'pages', unknown: 'pages' };
const TYPE_LABEL = { service: 'Services', host: 'Profiles', blog: 'Blog', static: 'Pages', unknown: 'Other' };

export default function SeoDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;
    adminSeoDashboard()
      .then((res) => { if (alive) setData(res.data); })
      .catch((e) => { if (alive) { toast.error(e.response?.data?.message || 'Failed to load dashboard'); setData(null); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  if (!data || data.empty) return <Card>No crawl data yet — run a crawl to populate the control center.</Card>;

  const t = data.totals;
  const scoreColor = (n) => toneColor(scoreTone(n));

  return (
    <div className="space-y-5">
      {/* Health + outcome KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard compact label="Avg SEO" value={<span style={{ color: scoreColor(t.avg_seo) }}>{t.avg_seo}</span>} icon="checkCircle" iconColor="bg-emerald-500" />
        <StatCard compact label="Avg GEO" value={<span style={{ color: scoreColor(t.avg_geo) }}>{t.avg_geo}</span>} icon="zap" iconColor="bg-violet-500" />
        <StatCard compact label="Indexed" value={`${t.indexed}/${t.pages}`} icon="checkCircle" iconColor="bg-sky-500" />
        <StatCard compact label="Needs attention" value={t.needs_attention} icon="alert" iconColor="bg-amber-500" />
        <StatCard compact label="Clicks (28d)" value={fmtNum(t.clicks)} icon="trendUp" iconColor="bg-emerald-500" />
        <StatCard compact label="Impressions" value={fmtNum(t.impressions)} icon="eye" iconColor="bg-sky-500" />
        <StatCard compact label="Avg position" value={fmtPos(t.avg_position)} icon="bars" iconColor="bg-gray-500" />
        <StatCard compact label="Improving / declining" value={<span><span style={{ color: 'var(--adm-ok)' }}>{t.improving}</span> / <span style={{ color: 'var(--adm-danger)' }}>{t.declining}</span></span>} icon="activity" iconColor="bg-violet-500" />
      </div>

      {/* Top opportunities */}
      <div>
        <h2 className="text-[13px] font-bold adm-t1 mb-2 flex items-center gap-2"><Ic d={IC.zap} size={15} />Top opportunities</h2>
        {data.opportunities?.length ? (
          <div className="space-y-2">
            {data.opportunities.map((o) => (
              <Card key={o.key} className="p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[13px] font-semibold adm-t1">{o.label}</span>
                  <Badge tone={o.count > 5 ? 'warn' : 'neutral'}>{o.count}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {o.pages.map((p) => (
                    <button key={p.id} onClick={() => setSelected(p.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] adm-hoverable" style={{ borderColor: 'var(--adm-border,#e5e7eb)' }}>
                      <span className="adm-t2 truncate max-w-[220px]">{p.url.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                      <ScoreChip value={p.seo_score} />
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        ) : <Card>No standout opportunities — everything indexed and reasonably healthy.</Card>}
      </div>

      {/* By type */}
      <div>
        <h2 className="text-[13px] font-bold adm-t1 mb-2 flex items-center gap-2"><Ic d={IC.layers} size={15} />By page type</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {data.by_type.map((row) => (
            <Link key={row.type} to={`/admin/seo/${TYPE_VIEW[row.type] || 'pages'}`} className="adm-card rounded-xl p-3.5 adm-hoverable block">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold adm-t1">{TYPE_LABEL[row.type] || row.type}</span>
                <span className="text-[11px] adm-t3">{row.count}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1">SEO <ScoreChip value={row.avg_seo} /></span>
                <span className="flex items-center gap-1">GEO <ScoreChip value={row.avg_geo} /></span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {selected && <SeoInspector pageId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
