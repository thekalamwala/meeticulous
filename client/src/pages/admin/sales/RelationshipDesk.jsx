import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Skeleton } from '../../../components/admin/ui';
import LeadDrawer from './LeadDrawer';
import {
  crmGetRelationships, crmRecommendationDone, crmRecommendationSnooze, crmRecommendationDismiss,
} from '../../../services/api';
import TwoClock from './TwoClock';

// The Relationship Desk: "who should I talk to today, and why?" — one ranked list of
// open touch recommendations the lifecycle engine emitted (first success, cooling,
// at-risk, dormant). Read-only over GET /admin/crm/recommendations. Click a card →
// the shared LeadDrawer for the real conversation; the quick-actions close the rec.

const HEALTH_TONE = {
  thriving: 'bg-emerald-500/10 text-emerald-600',
  steady:   'bg-sky-500/10 text-sky-600',
  cooling:  'bg-amber-500/10 text-amber-600',
  at_risk:  'bg-red-500/10 text-red-600',
  dormant:  'bg-gray-400/10 adm-t3',
};
const HEALTH_LABEL = { thriving: 'Thriving', steady: 'Steady', cooling: 'Cooling', at_risk: 'At risk', dormant: 'Dormant' };
const PRIORITY_DOT = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-gray-400' };
const MODE_LABEL = { auto: 'Automated', recommend: 'Your call', human: 'Human only' };
const REASON_LABEL = {
  first_success: 'First success', cooling: 'Gone quiet', at_risk: 'At risk', dormant: 'Dormant',
};
const CHANNEL_LABEL = { whatsapp: 'WhatsApp', email: 'Email', call: 'Call', personal: 'Personal' };

function HealthChip({ state }) {
  if (!state) return <span className="text-[10px] adm-t3">Health pending</span>;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${HEALTH_TONE[state] || HEALTH_TONE.dormant}`}>
      {HEALTH_LABEL[state] || state}
    </span>
  );
}

function RecCard({ rec, onOpen, onAction, busy }) {
  // Lead recs open the shared LeadDrawer for the real conversation. Guest recs (PR-9)
  // have no lead conversation view, so the card isn't drawer-clickable — its quick
  // actions still work.
  const isGuest = rec.subject_type === 'guest';
  const clickable = !isGuest && !!rec.lead_id;
  const open = () => { if (clickable) onOpen(rec.lead_id); };
  const fire = (e, action) => { e.stopPropagation(); onAction(rec, action); };
  return (
    <div role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined} onClick={open}
      onKeyDown={(e) => { if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } }}
      className={`w-full text-left px-4 py-3 rounded-xl adm-hoverable border border-transparent transition ${clickable ? 'hover:border-[#2E1065]/40 cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[rec.priority] || PRIORITY_DOT.low}`} title={`${rec.priority} priority`} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold adm-t1 truncate flex items-center gap-1.5">
              {rec.name || rec.business_name || (isGuest ? 'Guest' : 'Unnamed lead')}
              <span className={`text-[9px] px-1 py-0.5 rounded font-semibold shrink-0 ${isGuest ? 'bg-sky-500/10 text-sky-600' : 'bg-gray-400/10 adm-t3'}`}>
                {isGuest ? 'Guest' : 'Lead'}
              </span>
            </p>
            {rec.business_name && rec.name && <p className="text-[11px] adm-t3 truncate">{rec.business_name}</p>}
          </div>
        </div>
        <HealthChip state={rec.health_state} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#2E1065]/8 text-[#2E1065]">{REASON_LABEL[rec.reason] || rec.reason}</span>
        <span className="text-[10px] adm-t3">→ {rec.touch_type?.replace(/_/g, ' ')}</span>
        {rec.suggested_channel && <span className="text-[10px] adm-t3">· {CHANNEL_LABEL[rec.suggested_channel] || rec.suggested_channel}</span>}
        {rec.suggested_sender === 'founder' && <span className="text-[10px] adm-t3">· founder</span>}
        <span className="text-[10px] adm-t3 ml-auto">{MODE_LABEL[rec.mode] || rec.mode}</span>
      </div>

      {rec.explanation && <p className="text-[11px] adm-t3 mt-1.5">{rec.explanation}</p>}

      <div className="flex items-center justify-between mt-2">
        <TwoClock meaningfulAt={rec.last_meaningful_interaction_at} automatedAt={rec.last_automated_touch_at} />
        <div className="flex flex-wrap gap-1">
          <button type="button" disabled={busy} onClick={(e) => fire(e, 'done')}
            className="text-[10px] px-2 py-0.5 rounded-md border border-gray-200 hover:border-[#2E1065]/50 text-emerald-600 disabled:opacity-50">Mark done</button>
          <button type="button" disabled={busy} onClick={(e) => fire(e, 'snooze')}
            className="text-[10px] px-2 py-0.5 rounded-md border border-gray-200 hover:border-[#2E1065]/50 adm-t2 disabled:opacity-50">Snooze 2d</button>
          <button type="button" disabled={busy} onClick={(e) => fire(e, 'dismiss')}
            className="text-[10px] px-2 py-0.5 rounded-md border border-gray-200 hover:border-[#2E1065]/50 adm-t3 disabled:opacity-50">Dismiss</button>
        </div>
      </div>
    </div>
  );
}

export default function RelationshipDesk() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [drawerId, setDrawerId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(false);
    crmGetRelationships()
      .then(({ data }) => setData(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = useCallback(async (rec, action) => {
    setBusyId(rec.id);
    try {
      if (action === 'done') {
        await crmRecommendationDone(rec.id, { channel: rec.suggested_channel || null });
        toast.success('Touch recorded');
      } else if (action === 'snooze') {
        await crmRecommendationSnooze(rec.id, new Date(Date.now() + 2 * 864e5).toISOString());
        toast.success('Snoozed 2 days');
      } else if (action === 'dismiss') {
        await crmRecommendationDismiss(rec.id);
        toast.success('Dismissed');
      }
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const items = data?.items ?? [];
  const count = data?.count ?? 0;

  return (
    <div>
      <PageHeader
        title="Relationship Desk"
        subtitle="Who to talk to today, and why. Worked top to bottom — the most urgent relationships first."
        actions={
          <div className="flex gap-3 text-[12px]">
            <a href="/admin/sales/desk" className="adm-t2 hover:text-[#2E1065]">Sales Desk</a>
            <a href="/admin/sales/leads" className="adm-t2 hover:text-[#2E1065]">All leads</a>
          </div>
        }
      />

      {error ? (
        <Card className="rounded-2xl p-8 text-center">
          <p className="adm-t1 font-semibold mb-2">Couldn't load the relationship desk</p>
          <button onClick={load} className="text-[13px] text-[#2E1065]">Retry</button>
        </Card>
      ) : loading ? (
        <div className="space-y-2 max-w-2xl">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <Card className="rounded-2xl p-4 max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-bold adm-t1 text-sm">Today's relationship opportunities</h2>
            <span className="text-[11px] font-semibold adm-t3 ml-auto">{count}</span>
          </div>
          {items.length === 0 ? (
            <p className="text-[12px] adm-t3 py-10 text-center">No one needs a touch right now — every relationship is warm. ✅</p>
          ) : (
            <div className="space-y-1.5">
              {items.map((rec) => (
                <RecCard key={rec.id} rec={rec} onOpen={setDrawerId} onAction={act} busy={busyId === rec.id} />
              ))}
            </div>
          )}
        </Card>
      )}

      {drawerId && (
        <LeadDrawer leadId={drawerId} onClose={() => setDrawerId(null)} onChanged={load} />
      )}
    </div>
  );
}
