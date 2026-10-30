// Bolt Stats — 8 headline KPI cards over the last 30 days + a "which .md doc
// answers the most" bar chart (edges = assistant answers → the docs they cited).
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminBotAnalytics, adminBotGraph } from '../../../services/api';
import { StatCard, Skeleton } from '../../../components/admin/ui';

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [topDocs, setTopDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [a, g] = await Promise.all([adminBotAnalytics(), adminBotGraph()]);
        setStats(a.data); setTopDocs(g.data.topDocs || []);
      } catch { toast.error('Could not load stats'); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading || !stats) {
    return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;
  }

  const p = stats.pct;
  const cards = [
    { label: 'Total Answers', value: stats.answered,          sub: 'last 30 days',           icon: 'chat',   iconColor: 'bg-[#960D32]' },
    { label: 'Solved without AI', value: `${p.deflected}%`,   sub: 'greetings + FAQs + reused', icon: 'zap',  iconColor: 'bg-emerald-500' },
    { label: 'Used AI', value: `${p.ai}%`,                    sub: 'the goal: shrink this',  icon: 'star',   iconColor: 'bg-violet-500' },
    { label: 'Reused Answers', value: `${p.cache}%`,          sub: `${stats.cacheSize} saved`, icon: 'refresh', iconColor: 'bg-sky-500' },
    { label: 'Via FAQs', value: `${p.faq}%`,                  sub: `${stats.liveFaqs} live FAQs`, icon: 'help', iconColor: 'bg-teal-500' },
    { label: 'Sent to Human', value: `${p.escalation}%`,      sub: `${stats.openGaps} open`, icon: 'alert',  iconColor: 'bg-amber-500' },
    { label: 'Greetings', value: `${p.smalltalk}%`,           sub: 'hi, thanks, etc.',       icon: 'msgSq',  iconColor: 'bg-gray-400' },
    { label: 'Open Gaps', value: stats.openGaps,              sub: 'awaiting an answer',     icon: 'clock',  iconColor: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide adm-t3">Which .md doc answers the most (last 1000 cited answers)</p>
        {topDocs.length === 0 ? <p className="text-sm adm-t3">No cited answers yet.</p> : (
          <div className="adm-card space-y-1.5 rounded-2xl p-4">
            {topDocs.map((d) => {
              const max = topDocs[0].answers || 1;
              const name = d.source_file.replace(/^docs\/help\//, '');
              return (
                <div key={d.source_file} className="flex items-center gap-2">
                  <div className="w-48 shrink-0 truncate text-xs adm-t2" title={d.source_file}>{name}</div>
                  <div className="h-4 flex-1 rounded bg-[#2A1416]/5">
                    <div className="h-4 rounded bg-[#960D32]" style={{ width: `${Math.round((d.answers / max) * 100)}%` }} />
                  </div>
                  <div className="w-10 shrink-0 text-right text-xs font-semibold adm-t2">{d.answers}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
