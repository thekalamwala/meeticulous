import { useState, useEffect } from 'react';
import { adminFinanceSummary } from '../../services/api';
import toast from 'react-hot-toast';
import { PageHeader, Card, Skeleton } from '../../components/admin/ui';

// P1 Ledger dashboard — every figure is read from account_balances (running
// double-entry balances) or indexed snapshot sums. Nothing computed client-side.

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(n) || 0);

const CARDS = [
  { key: 'gross_collections',              label: 'Gross Collections',         hint: 'All customer + host payments received' },
  { key: 'net_revenue',                    label: 'Net Revenue',               hint: 'Fee + commission + subscription − platform-borne charges', accent: true },
  { key: 'available_business_cash',        label: 'Available Business Cash',   hint: 'Bank − host payables − GST liability', accent: true },
  { key: 'outstanding_vendor_payables',    label: 'Host Payables',             hint: 'Owed to hosts, pending settlement' },
  { key: 'gst_liability',                  label: 'GST Liability',             hint: 'Collected for the government, not revenue' },
  { key: 'platform_fee_revenue',           label: 'Platform Fee Revenue',      hint: '₹10 base fee per paid order' },
  { key: 'commission_revenue',             label: 'Commission Revenue',        hint: 'Free-plan commission' },
  { key: 'subscription_revenue',           label: 'Subscription Revenue',      hint: 'Host plan fees (excl. GST)' },
  { key: 'razorpay_charges_orders',        label: 'Razorpay Charges (Orders)', hint: 'Host-borne gateway fees' },
  { key: 'razorpay_charges_subscriptions', label: 'Razorpay Charges (Subs)',   hint: 'Platform-borne gateway fees' },
  { key: 'razorpay_receivable',            label: 'Razorpay Receivable',       hint: 'Collected by Razorpay, not yet in bank' },
  { key: 'bank_balance',                   label: 'Bank',                      hint: 'Per ledger (bank transfers recorded)' },
];

const AdminFinanceDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFinanceSummary()
      .then((r) => setMetrics(r.data.metrics))
      .catch((e) => toast.error(e.response?.data?.message || 'Failed to load financial summary'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Finance" subtitle="Double-entry ledger balances. GST and host money are never platform revenue." />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {CARDS.map((c) => <Skeleton key={c.key} className="h-24" />)}
        </div>
      ) : !metrics ? (
        <Card className="p-0 py-16 text-center adm-t3">No financial data yet.</Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {CARDS.map((c) => (
            <Card key={c.key} className={`p-4 ${c.accent ? 'border-gray-900' : ''}`}>
              <p className="text-[11px] uppercase tracking-wide adm-t3 font-semibold">{c.label}</p>
              <p className="text-lg font-bold adm-t1 mt-1 tabular-nums">{inr(metrics[c.key])}</p>
              <p className="text-[11px] adm-t3 mt-1">{c.hint}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFinanceDashboard;
