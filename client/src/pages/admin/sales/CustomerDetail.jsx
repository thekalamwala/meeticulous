import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Btn, Badge } from '../../../components/admin/ui';
import { crmGetLead, crmLeadTimeline, adminHost360Get, adminHost360Billing } from '../../../services/api';
import { STATUS_LABEL, STATUS_TONE, rupees, relTime, leadScore } from './salesConstants';
import {
  Mail, Phone, MessageCircle, FileText, CheckCircle2, CalendarClock, Clock,
  MapPin, Briefcase, ExternalLink, TrendingUp,
} from 'lucide-react';

/**
 * Customer 360 (audit Phase 3b) — ONE read-only screen that unifies the sales
 * lead (journey, attribution, timeline) with the linked account (subscription,
 * bookings, revenue). Composes existing endpoints; actions stay in LeadPanel /
 * Host360, which this deep-links to. The account block is best-effort: an admin
 * with `leads.view` but not host360 perms simply doesn't see it (no error).
 */

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const initials = (n) => (n || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

function tIcon(item) {
  const s = `${item.source || item.type || ''} ${item.title || ''}`.toLowerCase();
  if (s.includes('whatsapp')) return { Icon: MessageCircle, cls: 'text-emerald-600 bg-emerald-50' };
  if (s.includes('mail') || s.includes('email')) return { Icon: Mail, cls: 'text-blue-600 bg-blue-50' };
  if (s.includes('call')) return { Icon: Phone, cls: 'text-slate-600 bg-slate-100' };
  if (s.includes('note')) return { Icon: FileText, cls: 'text-violet-600 bg-violet-50' };
  if (s.includes('subscription') || s.includes('status') || s.includes('paid')) return { Icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' };
  if (s.includes('follow')) return { Icon: CalendarClock, cls: 'text-amber-600 bg-amber-50' };
  return { Icon: Clock, cls: 'text-slate-500 bg-slate-100' };
}

function Row({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <Icon size={14} className="adm-t3 shrink-0" />
      <span className="adm-t3 w-20 shrink-0">{label}</span>
      <span className="adm-t1 truncate">{value}</span>
    </div>
  );
}

// Attribution block — reads the v3.120 columns (source / utm / first & last touch).
function Attribution({ lead }) {
  const ft = lead.first_touch || {};
  const utm = [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(' / ');
  return (
    <Card className="rounded-2xl p-4">
      <h3 className="text-[11px] uppercase tracking-wide adm-t3 mb-3 font-semibold">Attribution</h3>
      <div className="space-y-1.5">
        <Row icon={TrendingUp} label="Source" value={lead.source} />
        <Row icon={TrendingUp} label="UTM" value={utm || null} />
        <Row icon={TrendingUp} label="Campaign" value={lead.utm_campaign} />
        <Row icon={ExternalLink} label="Landing" value={lead.landing_page || ft.landing_page} />
        <Row icon={ExternalLink} label="Referrer" value={lead.referrer || ft.referrer} />
        <Row icon={Clock} label="First seen" value={fmtDate(ft.at || lead.created_at)} />
      </div>
      {!lead.source && !utm && <p className="text-[12px] adm-t3">No attribution captured.</p>}
    </Card>
  );
}

// Account & money — only when the lead is linked to a profile AND host360 loaded.
function Account({ host, billing, profileId }) {
  if (!host && !billing) return null;
  const sub = billing?.subscription || {};
  const counts = host?.counts || {};
  const rev = billing?.revenue || host?.revenue || {};
  const payments = (billing?.payments || []).slice(0, 4);
  return (
    <Card className="rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] uppercase tracking-wide adm-t3 font-semibold">Account &amp; money</h3>
        <Link to={`/admin/host360/${profileId}`} className="text-[11px] text-[#2E1065] inline-flex items-center gap-1">Host 360 <ExternalLink size={11} /></Link>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><p className="text-[11px] adm-t3">Plan</p><p className="text-[13px] font-semibold adm-t1">{billing?.plan || host?.host?.plan || host?.plan || '—'}</p></div>
        <div><p className="text-[11px] adm-t3">Subscription</p><p className="text-[13px] font-semibold adm-t1 capitalize">{sub.status || '—'}</p></div>
        <div><p className="text-[11px] adm-t3">Renews / expires</p><p className="text-[13px] adm-t1">{fmtDate(sub.current_period_end)}</p></div>
        <div><p className="text-[11px] adm-t3">Bookings</p><p className="text-[13px] adm-t1 tabular-nums">{counts.bookings ?? counts.paid_bookings ?? '—'}</p></div>
      </div>
      <div className="rounded-xl bg-emerald-50 px-3 py-2 mb-3">
        <p className="text-[11px] text-emerald-700">Lifetime revenue</p>
        <p className="text-lg font-bold text-emerald-800 tabular-nums">{rupees((Number(rev.lifetime ?? rev.total) || 0) * 100)}</p>
      </div>
      {payments.length > 0 && (
        <div>
          <p className="text-[11px] adm-t3 mb-1">Recent payments</p>
          <div className="divide-y divide-gray-100">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-1.5 text-[12px]">
                <span className="adm-t2">{p.type} · {fmtDate(p.at)}</span>
                {/* host360 billing: Subscription amount is rupees, Plan amount is paise (raw). */}
                <span className="adm-t1 tabular-nums font-medium">{rupees(p.type === 'Plan' ? (Number(p.amount) || 0) : (Number(p.amount) || 0) * 100)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function CustomerDetail() {
  const { leadId } = useParams();
  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [host, setHost] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // crmGetLead returns { lead, notes, followUps } — the lead is nested.
    crmGetLead(leadId).then(async ({ data }) => {
      if (!alive) return;
      const l = data?.lead || null;
      setLead(l);
      crmLeadTimeline(leadId).then(({ data: t }) => alive && setTimeline(Array.isArray(t) ? t : [])).catch(() => {});
      // Account side — best-effort, only when linked; permission errors are silent.
      if (l?.profile_id) {
        adminHost360Get(l.profile_id).then(({ data: h }) => alive && setHost(h)).catch(() => {});
        adminHost360Billing(l.profile_id).then(({ data: b }) => alive && setBilling(b)).catch(() => {});
      }
    }).catch(() => setLead(null)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [leadId]);

  if (loading) return <div className="p-6 max-w-5xl"><p className="adm-t3">Loading…</p></div>;
  if (!lead) return <div className="p-6 max-w-5xl"><Card className="rounded-2xl p-10 text-center adm-t3">Customer not found.</Card></div>;

  const { score, temp } = leadScore(lead);

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-full bg-[#2E1065]/10 text-[#2E1065] grid place-items-center font-bold shrink-0">{initials(lead.name)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold adm-t1 truncate">{lead.name || 'Unnamed'}</h1>
            <Badge tone={STATUS_TONE[lead.status] || 'neutral'}>{STATUS_LABEL[lead.status] || lead.status}</Badge>
            <span className="text-[11px] adm-t3">Score {score} · {temp}</span>
          </div>
          {lead.business_name && <p className="text-[13px] adm-t3">{lead.business_name}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to={`/admin/sales/leads/${lead.id}`}><Btn variant="outline" size="sm">Work in LeadPanel</Btn></Link>
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,320px)_1fr] gap-5">
        {/* Left: identity + attribution + account */}
        <div className="space-y-4">
          <Card className="rounded-2xl p-4">
            <h3 className="text-[11px] uppercase tracking-wide adm-t3 mb-3 font-semibold">Identity</h3>
            <div className="space-y-1.5">
              <Row icon={Phone} label="Phone" value={lead.phone} />
              <Row icon={Mail} label="Email" value={lead.email} />
              <Row icon={MapPin} label="City" value={lead.city} />
              <Row icon={Briefcase} label="Work" value={lead.profession} />
            </div>
            {Number(lead.revenue_paise) > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[12px] adm-t3">Attributed revenue</span>
                <span className="text-[13px] font-semibold adm-t1 tabular-nums">{rupees(lead.revenue_paise)}</span>
              </div>
            )}
          </Card>

          <Attribution lead={lead} />
          <Account host={host} billing={billing} profileId={lead.profile_id} />
        </div>

        {/* Right: unified timeline */}
        <Card className="rounded-2xl p-4">
          <h3 className="text-[11px] uppercase tracking-wide adm-t3 mb-3 font-semibold">Timeline</h3>
          {timeline.length === 0 ? (
            <p className="text-[13px] adm-t3">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {timeline.map((item, i) => {
                const { Icon, cls } = tIcon(item);
                return (
                  <div key={item.id || i} className="flex gap-3">
                    <div className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${cls}`}><Icon size={14} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] adm-t1">{item.title || item.type}</p>
                      {item.body && <p className="text-[12px] adm-t3 whitespace-pre-wrap break-words">{item.body}</p>}
                      <p className="text-[11px] adm-t3">{relTime(item.occurred_at || item.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
