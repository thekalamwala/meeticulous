import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Btn, Badge } from '../../components/admin/ui';
import { adminGetReferralRules, adminUpdateReferralRule, adminGetReferrals } from '../../services/api';

const PLAN_LABEL = { creator: 'Host+', professional: 'Studio' };
const planLabel = (s) => PLAN_LABEL[s] || s || '—';
const fmtDate = (s) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};
const STATUS_TONE = { pending: 'neutral', qualified: 'warning', rewarded: 'success', rejected: 'danger' };
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Editable fields on a reward rule (what the admin can change per plan+cadence).
const EDITABLE = ['reward_type', 'reward_value', 'min_qualifying_charges', 'hold_days', 'monthly_cap', 'active'];

const RuleRow = ({ rule, onSaved }) => {
  const [form, setForm] = useState(rule);
  const [saving, setSaving] = useState(false);
  const dirty = EDITABLE.some((k) => String(form[k]) !== String(rule[k]));

  const set = (k, v) => setForm({ ...form, [k]: v });

  const save = async () => {
    setSaving(true);
    try {
      const patch = {};
      for (const k of EDITABLE) patch[k] = form[k];
      const { data } = await adminUpdateReferralRule(rule.id, patch);
      toast.success(`${planLabel(rule.referred_plan)} ${rule.cadence} updated`);
      onSaved(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="adm-hoverable">
      <td className="px-3 py-1.5 adm-t1 whitespace-nowrap">
        <span className="font-semibold">{planLabel(rule.referred_plan)}</span>
        <span className="adm-t3"> · {rule.cadence}</span>
      </td>
      <td className="px-3 py-1.5">
        <select className="fb-input text-sm" value={form.reward_type} onChange={(e) => set('reward_type', e.target.value)}>
          <option value="cash_inr">Cash (₹)</option>
          <option value="account_credit">Account credit</option>
        </select>
      </td>
      <td className="px-3 py-1.5">
        <input type="number" min="0" step="1" className="fb-input text-sm w-24"
          value={form.reward_value} onChange={(e) => set('reward_value', e.target.value)} />
      </td>
      <td className="px-3 py-1.5">
        <input type="number" min="1" step="1" className="fb-input text-sm w-20"
          value={form.min_qualifying_charges} onChange={(e) => set('min_qualifying_charges', e.target.value)} />
      </td>
      <td className="px-3 py-1.5">
        <input type="number" min="0" step="1" className="fb-input text-sm w-20"
          value={form.hold_days} onChange={(e) => set('hold_days', e.target.value)} />
      </td>
      <td className="px-3 py-1.5">
        <input type="number" min="0" step="1" className="fb-input text-sm w-20"
          value={form.monthly_cap} onChange={(e) => set('monthly_cap', e.target.value)} />
      </td>
      <td className="px-3 py-1.5 text-center">
        <input type="checkbox" checked={!!form.active} onChange={(e) => set('active', e.target.checked)} />
      </td>
      <td className="px-3 py-1.5 text-right">
        <Btn size="sm" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Btn>
      </td>
    </tr>
  );
};

const AdminReferrals = () => {
  const [rules, setRules] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([adminGetReferralRules(), adminGetReferrals()])
      .then(([r, ref]) => {
        setRules(Array.isArray(r.data) ? r.data : []);
        setReferrals(Array.isArray(ref.data) ? ref.data : []);
      })
      .catch(() => { setError(true); toast.error('Failed to load referral config'); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const onRuleSaved = (updated) =>
    setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Refer & Earn"
        subtitle="Set what a host earns when someone they refer subscribes — per plan and billing cadence. Changes apply immediately to new qualifying referrals."
      />

      {loading ? (
        <p className="adm-t3 text-sm py-10 text-center">Loading…</p>
      ) : error ? (
        <p className="adm-t3 text-sm py-10 text-center">Could not load referral config.</p>
      ) : (
        <>
          {/* ── Reward rules ─────────────────────────────────────── */}
          <h2 className="text-sm font-bold adm-t2 mb-2">Reward rules</h2>
          <div className="adm-card rounded-2xl overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="adm-table w-full text-sm">
                <thead>
                  <tr className="adm-th text-left text-xs font-semibold adm-t3">
                    <th className="px-3 py-1.5">Plan · Cadence</th>
                    <th className="px-3 py-1.5">Reward type</th>
                    <th className="px-3 py-1.5">Reward (₹)</th>
                    <th className="px-3 py-1.5">Min charges</th>
                    <th className="px-3 py-1.5">Hold (days)</th>
                    <th className="px-3 py-1.5">Monthly cap</th>
                    <th className="px-3 py-1.5 text-center">Active</th>
                    <th className="px-3 py-1.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => <RuleRow key={rule.id} rule={rule} onSaved={onRuleSaved} />)}
                  {rules.length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-8 text-center adm-t3">
                      No rules found. Apply migration <code className="font-mono">v3.77_referral_program.sql</code>.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="adm-t3 text-xs mb-6">
            <strong>Min charges</strong> gates the reward until the referred host has paid that many times
            (monthly = 2 guards churn; yearly = 1 pays on first). <strong>Hold</strong> is the refund window
            before the reward is released. <strong>Monthly cap</strong> limits rewards per referrer per month
            (0 = unlimited). Cash rewards land in the referrer’s payout balance.
          </p>

          {/* ── Recent referrals ─────────────────────────────────── */}
          <h2 className="text-sm font-bold adm-t2 mb-2">Recent referrals</h2>
          <div className="adm-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="adm-table w-full text-sm">
                <thead>
                  <tr className="adm-th text-left text-xs font-semibold adm-t3">
                    <th className="px-3 py-1.5">Referrer</th>
                    <th className="px-3 py-1.5">Referred</th>
                    <th className="px-3 py-1.5">Plan</th>
                    <th className="px-3 py-1.5">Reward</th>
                    <th className="px-3 py-1.5">Status</th>
                    <th className="px-3 py-1.5">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="adm-hoverable">
                      <td className="px-3 py-1.5 adm-t1">{r.referrer?.username || r.referrer?.name || '—'}</td>
                      <td className="px-3 py-1.5 adm-t2">{r.referred?.username || r.referred?.name || '—'}</td>
                      <td className="px-3 py-1.5 adm-t2 whitespace-nowrap">
                        {r.referred_plan ? `${planLabel(r.referred_plan)} · ${r.cadence}` : '—'}
                      </td>
                      <td className="px-3 py-1.5 adm-t2">{Number(r.reward_value) > 0 ? money(r.reward_value) : '—'}</td>
                      <td className="px-3 py-1.5">
                        <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{r.status}</Badge>
                      </td>
                      <td className="px-3 py-1.5 text-xs adm-t3 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
                  {referrals.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center adm-t3">No referrals yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminReferrals;
