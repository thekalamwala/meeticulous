// AdminGstExports.jsx — /admin/gst/exports — CA & Accounting Exports (§11–§13).
// Generate a monthly/quarterly/annual GST pack or the Full Accounting Pack for a
// period; download the zipped CSV/XLSX + summary. History is immutable; a closed
// period reuses its stored pack.
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Badge, Btn, Skeleton } from '../../components/admin/ui';
import { adminGstExports, adminGstCreateExport, adminGstDownloadExport } from '../../services/api';
import { inr, num, PeriodFilter, defaultPeriod, periodParams } from './gstShared';

const MODE_TO_PACK = { month: 'monthly', quarter: 'quarterly', annual: 'annual' };
const TONE = { complete: 'ok', running: 'info', pending: 'neutral', failed: 'danger' };
const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function AdminGstExports() {
  const [period, setPeriod] = useState(defaultPeriod);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setRuns((await adminGstExports()).data.exports || []); }
    catch (e) { toast.error(e.response?.data?.message || 'Failed to load exports'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generate = async (packType) => {
    setBusy(packType);
    try {
      const body = { pack_type: packType, ...periodParams(packType === 'full' ? { ...period, mode: 'annual' } : period) };
      const res = await adminGstCreateExport(body);
      toast.success(res.data.reused ? 'Reused the existing pack for this period' : 'Pack generated');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Generation failed');
    } finally {
      setBusy('');
    }
  };

  const download = async (id) => {
    try {
      const res = await adminGstDownloadExport(id);
      if (res.data.url) window.open(res.data.url, '_blank', 'noopener');
      else toast.error('No download URL');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Download failed');
    }
  };

  return (
    <div>
      <PageHeader title="CA & Accounting Exports" subtitle="Generate a complete GST pack for your CA — zipped registers, working papers & summary" />

      <Card className="mb-4">
        <div className="text-sm font-semibold mb-3">Generate a pack</div>
        <div className="flex flex-wrap items-end gap-3">
          <PeriodFilter value={period} onChange={setPeriod} />
          <Btn variant="primary" size="sm" disabled={!!busy} onClick={() => generate(MODE_TO_PACK[period.mode] || 'monthly')}>
            {busy && busy !== 'full' ? 'Generating…' : `Generate ${period.mode === 'annual' ? 'Annual' : period.mode === 'quarter' ? 'Quarterly' : 'Monthly'} GST Pack`}
          </Btn>
          <Btn variant="outline" size="sm" disabled={!!busy} onClick={() => generate('full')}>
            {busy === 'full' ? 'Generating…' : 'Generate Full Accounting Pack (FY)'}
          </Btn>
        </div>
        <div className="text-xs adm-t3 mt-3">
          The Full Accounting Pack covers the whole financial year and adds a financial-transactions file for your accountant.
          GSTR-1/3B files are working papers, not government filing files.
        </div>
      </Card>

      <div className="text-sm font-semibold mb-2">Export history</div>
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !runs.length ? (
        <div className="adm-card rounded-2xl py-16 text-center adm-t3">No exports yet — generate one above.</div>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="adm-table w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-right px-4 py-3">Records</th>
                  <th className="text-right px-4 py-3">Taxable</th>
                  <th className="text-right px-4 py-3">GST</th>
                  <th className="text-left px-4 py-3">Generated</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {runs.map((r) => (
                  <tr key={r.id} className="border-b adm-border last:border-0">
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3 capitalize">{r.pack_type}</td>
                    <td className="px-4 py-3 text-right">{r.record_count != null ? num(r.record_count) : '—'}</td>
                    <td className="px-4 py-3 text-right">{r.taxable_total != null ? inr(r.taxable_total) : '—'}</td>
                    <td className="px-4 py-3 text-right">{r.gst_total != null ? inr(r.gst_total) : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap adm-t3">{fmt(r.generated_at)}</td>
                    <td className="px-4 py-3"><Badge tone={TONE[r.status] || 'neutral'}>{r.status}</Badge></td>
                    <td className="px-4 py-3">
                      {r.status === 'complete' && <Btn variant="outline" size="sm" onClick={() => download(r.id)}>Download</Btn>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
