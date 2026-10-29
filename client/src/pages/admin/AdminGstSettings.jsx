// AdminGstSettings.jsx — /admin/gst/settings — read-only GST configuration.
// Seller identity + rates live in config today; this displays them. Editing
// arrives if/when a gst_settings table is introduced.
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Badge, Skeleton } from '../../components/admin/ui';
import { adminGstSettings } from '../../services/api';

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-4 border-b adm-border py-2 text-sm last:border-0">
    <span className="adm-t3">{label}</span><span className="font-medium text-right">{value ?? '—'}</span>
  </div>
);

export default function AdminGstSettings() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setD((await adminGstSettings()).data); }
      catch (e) { toast.error(e.response?.data?.message || 'Failed to load settings'); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div><PageHeader title="GST Settings" /><Skeleton className="h-40" /></div>;
  if (!d) return <div><PageHeader title="GST Settings" /><Card>Could not load settings.</Card></div>;

  const reg = d.registration || {}, tax = d.taxConfig || {}, inv = d.invoiceConfig || {}, itg = d.integrations || {};
  const pct = (f) => (f == null ? '—' : `${(f * 100).toFixed(f * 100 % 1 ? 2 : 0)}%`);

  return (
    <div>
      <PageHeader title="GST Settings" subtitle="Registration, tax and invoice configuration (read-only)" actions={<Badge tone="neutral">Read-only</Badge>} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="text-sm font-semibold mb-2">GST registration</div>
          <Row label="GSTIN" value={reg.gstin} />
          <Row label="Legal name" value={reg.legalName} />
          <Row label="PAN" value={reg.pan} />
          <Row label="CIN" value={reg.cin} />
          <Row label="State" value={reg.stateName ? `${reg.stateName} (${reg.stateCode})` : reg.stateCode} />
          <Row label="Address" value={reg.address} />
          <Row label="Registration type" value={reg.registrationType} />
          <Row label="Status" value={reg.status} />
        </Card>

        <Card>
          <div className="text-sm font-semibold mb-2">Tax configuration</div>
          <Row label="GST rate" value={pct(tax.gstRate)} />
          <Row label="TDS rate (194-O)" value={pct(tax.tdsRate)} />
          <Row label="TCS rate (§52)" value={pct(tax.tcsRate)} />
          <Row label="Default SAC" value={tax.defaultSac} />
        </Card>

        <Card>
          <div className="text-sm font-semibold mb-2">Invoice configuration</div>
          <Row label="Fiscal year" value={inv.fiscalYear} />
          {inv.series && Object.entries(inv.series).map(([k, v]) => (
            <Row key={k} label={`${k} series`} value={`${v.prefix} (${v.code})`} />
          ))}
        </Card>

        <Card>
          <div className="text-sm font-semibold mb-2">Integrations</div>
          <Row label="GST portal / GSP" value={<Badge tone={itg.gstPortal ? 'ok' : 'neutral'}>{itg.gstPortal ? 'connected' : 'not connected'}</Badge>} />
          <Row label="E-invoicing" value={<Badge tone={itg.eInvoicing ? 'ok' : 'neutral'}>{itg.eInvoicing ? 'on' : 'off'}</Badge>} />
          <Row label="E-way bill" value={<Badge tone={itg.eWayBill ? 'ok' : 'neutral'}>{itg.eWayBill ? 'on' : 'off'}</Badge>} />
          <Row label="Accounting" value={<Badge tone={itg.accounting ? 'ok' : 'neutral'}>{itg.accounting ? 'connected' : 'not connected'}</Badge>} />
        </Card>
      </div>

      {d.note && <div className="text-xs adm-t3 mt-4">{d.note}</div>}
    </div>
  );
}
