import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Download, Repeat, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { crmGetCustomers, crmExportCsv, crmResolveCustomer } from '../services/api';
import {
  PageHeader, Card, DataTable, Badge, SearchInput, SegmentedControl,
  Button, buttonClasses, EmptyState, ErrorState, cn, fmtMoney,
} from '../components/dashboard/ui';
import { PREMIUM_PLAN } from '../data/plans';

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const COLUMNS = [
  {
    key: 'name',
    header: 'Client',
    render: (c) => (
      <div className="flex items-center gap-2">
        <p className="font-medium text-gray-800">{c.name || 'Unknown'}</p>
        {c.is_recurring && (
          <Badge tone="primary"><Repeat className="h-3 w-3" />Recurring</Badge>
        )}
      </div>
    ),
  },
  { key: 'phone', header: 'Phone', render: (c) => <span className="text-gray-600">{c.phone || '—'}</span> },
  { key: 'email', header: 'Email', render: (c) => <span className="block max-w-[180px] truncate text-gray-500">{c.email || '—'}</span> },
  { key: 'bookings_count', header: 'Bookings', align: 'right', render: (c) => <span className="text-gray-700">{c.bookings_count}</span> },
  { key: 'total_spent', header: 'Total Spent', align: 'right', render: (c) => <span className="font-semibold text-primary">{fmtMoney(c.total_spent)}</span> },
  { key: 'last_booking_at', header: 'Last Booking', render: (c) => <span className="text-gray-500">{fmtDate(c.last_booking_at)}</span> },
];

const ClientsList = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [filter, setFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [gated, setGated] = useState(false);
  const [opening, setOpening] = useState(null); // customer_key currently being resolved

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await crmGetCustomers({ q, sort, filter: filter || undefined });
      setClients(data.clients || []);
      setTotal(data.total || 0);
      setGated(false);
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.upgrade_required) {
        setGated(true);
      } else {
        setError(true);
        toast.error('Failed to load clients');
      }
    } finally {
      setLoading(false);
    }
  }, [q, sort, filter]);

  useEffect(() => { load(); }, [load]);

  // A derived (not-yet-persisted) client has id:null — resolve it to a stable
  // UUID handle first, then navigate to the detail page.
  const openClient = async (c) => {
    if (opening) return;
    if (c.id) { navigate(`/dashboard/clients/${c.id}`); return; }
    setOpening(c.customer_key);
    try {
      const { data } = await crmResolveCustomer(c.customer_key);
      navigate(`/dashboard/clients/${data.id}`);
    } catch {
      toast.error('Could not open this client');
    } finally {
      setOpening(null);
    }
  };

  const handleExport = async () => {
    try {
      const { data } = await crmExportCsv();
      const url = window.URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clients.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not export clients');
    }
  };

  if (gated) {
    return (
      <div>
        <PageHeader title="Customers" subtitle="Your customers" />
        <Card className="border-2 border-dashed border-primary/30 text-center">
          <div className="mb-3 text-3xl">🗂️</div>
          <h3 className="mb-1 font-semibold text-gray-900">Unlock Customers</h3>
          <p className="mb-4 text-sm text-gray-500">
            See every customer's booking history, total spend, and private notes with {PREMIUM_PLAN.name}.
          </p>
          <Link to="/dashboard/upgrade" className={buttonClasses({ variant: 'primary' })}>
            Upgrade to {PREMIUM_PLAN.name}
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${total} customer${total === 1 ? '' : 's'}`}
        actions={
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={loading || total === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, email…" className="w-full sm:w-72" />
        <SegmentedControl
          className="sm:w-auto"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recent', label: 'Recent' },
            { value: 'ltv', label: 'Top Spend' },
          ]}
        />
        <button
          type="button"
          onClick={() => setFilter((f) => (f === 'lapsed' ? null : 'lapsed'))}
          className={cn(
            'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
            filter === 'lapsed'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50',
          )}
        >
          <UserX className="h-3.5 w-3.5" /> Lapsed
        </button>
      </div>

      {error && clients.length === 0 ? (
        <ErrorState message="Couldn't load your clients." onRetry={load} />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={clients}
          loading={loading}
          onRowClick={openClient}
          empty={
            <EmptyState
              icon={Users}
              title="No customers yet"
              description="Customers show up here automatically once guests book and pay for your services."
            />
          }
        />
      )}
    </div>
  );
};

export default ClientsList;
