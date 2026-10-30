import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader, Table, Btn, Badge } from '../../components/admin/ui';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { adminListKyc, adminGetKyc, adminDecideKyc } from '../../services/api';

const ICON = 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4';
const TITLES = { pending: 'Pending KYC', approved: 'Verified KYC', rejected: 'Rejected KYC' };
const TONE = { pending: 'warn', approved: 'ok', rejected: 'danger' };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

// Signed document link — opens in a new tab; rel guards against tab-nabbing.
const DocLink = ({ href, label }) =>
  href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#960D32] hover:underline">{label} ↗</a>
  ) : (
    <span className="adm-t3">{label}: —</span>
  );

export const KycDetail = ({ id, onClose, onDecided }) => {
  const [row, setRow] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { adminGetKyc(id).then(({ data }) => setRow(data)).catch(() => onClose()); }, [id, onClose]);

  const decide = async (status) => {
    if (status === 'rejected' && !note.trim()) return alert('Add a rejection reason.');
    setBusy(true);
    try {
      await adminDecideKyc(id, { status, note });
      onDecided();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="adm-card h-full w-full max-w-md overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold adm-t1">KYC review</h3>
          <button onClick={onClose} className="adm-t3 hover:adm-t1">✕</button>
        </div>
        {!row ? (
          <p className="adm-t3 text-sm">Loading…</p>
        ) : (
          <div className="space-y-4 text-sm">
            <Badge tone={TONE[row.status]}>{row.status}</Badge>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                ['Name', row.full_name], ['Email', row.email], ['Phone', row.phone],
                ['PAN', row.pan_number], ['Aadhaar', row.aadhaar_number],
                ['Holder', row.holder_name], ['Bank', row.bank_name], ['Account', row.account_number],
                ['IFSC', row.ifsc], ['Branch', row.branch || '—'], ['Type', row.account_type],
              ].map(([k, v]) => (
                <div key={k}><dt className="adm-t3 text-xs">{k}</dt><dd className="adm-t1">{v || '—'}</dd></div>
              ))}
            </dl>
            <div className="flex flex-col gap-1">
              <DocLink href={row.selfie_url} label="Live selfie" />
              <DocLink href={row.pan_doc_url} label="PAN document" />
              <DocLink href={row.aadhaar_doc_url} label="Aadhaar document" />
            </div>
            {row.review_note && <p className="rounded bg-red-500/10 p-2 text-red-500">Note: {row.review_note}</p>}
            {row.status === 'pending' && (
              <div className="space-y-3 border-t border-black/10 pt-4">
                <textarea
                  value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                  placeholder="Reason (required to reject)…"
                  className="adm-card w-full rounded-lg p-2 text-sm"
                />
                <div className="flex gap-2">
                  <Btn variant="danger" onClick={() => decide('rejected')} disabled={busy}>Reject</Btn>
                  <Btn onClick={() => decide('approved')} disabled={busy}>Approve</Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const AdminKYC = () => {
  const { status = 'pending' } = useParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminListKyc(status).then(({ data }) => setRows(data || [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: 'full_name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'created_at', label: 'Submitted', render: (r) => fmtDate(r.created_at) },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={TONE[r.status]}>{r.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader title={TITLES[status] || 'KYC'} subtitle="Identity verification management" />
      {loading ? (
        <p className="adm-t3 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <AdminEmptyState icon={ICON} iconBg="bg-blue-50" iconColor="text-blue-500"
          title={`No ${status} submissions`} description="KYC submissions appear here as hosts complete verification." />
      ) : (
        <Table columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => setOpenId(r.id)} />
      )}
      {openId && <KycDetail id={openId} onClose={() => setOpenId(null)} onDecided={() => { setOpenId(null); load(); }} />}
    </div>
  );
};
export default AdminKYC;
