// AdminGstItc.jsx — /admin/gst/itc — honest empty state.
// The platform captures NO input/purchase GST, so ITC has no data source. This
// page says so plainly rather than showing fabricated numbers.
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Skeleton } from '../../components/admin/ui';
import { adminGstItc } from '../../services/api';
import { inr } from './gstShared';

const TILES = [
  ['available', 'ITC Available'], ['claimed', 'ITC Claimed'], ['pending', 'ITC Pending'],
  ['rejected', 'ITC Rejected'], ['reversed', 'ITC Reversed'], ['atRisk', 'ITC at Risk'],
];

export default function AdminGstItc() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminGstItc();
        setData(res.data);
      } catch (e) {
        toast.error(e.response?.data?.message || 'Failed to load ITC');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Input Tax Credit" subtitle="ITC on the platform's own purchases" />

      {loading ? (
        <Skeleton className="h-24" />
      ) : (
        <>
          <Card className="mb-4" style={{ borderColor: 'var(--adm-warn)' }}>
            <div className="text-sm font-semibold mb-1">No ITC data</div>
            <div className="text-sm adm-t2">{data?.reason || 'No input-GST / purchase data is captured in the platform.'}</div>
            <div className="text-xs adm-t3 mt-2">When an input-GST source (vendor bills / expense GST) is added, this page will populate automatically — the numbers below stay 0 until then.</div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TILES.map(([key, label]) => (
              <Card key={key}>
                <div className="text-[11px] uppercase tracking-wide adm-t3">{label}</div>
                <div className="text-2xl font-semibold tabular-nums mt-1">{inr(data?.summary?.[key] || 0)}</div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
