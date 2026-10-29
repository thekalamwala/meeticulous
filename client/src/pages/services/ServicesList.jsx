import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { svcGetAll, svcDelete, svcToggle, svcDuplicate } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import {
  PageHeader, Card, Button, buttonClasses, SearchInput, SegmentedControl, Fab,
  StatusBadge, Modal, SkeletonCard, ErrorState, cn,
} from '../../components/dashboard/ui';

const TYPE_LABEL = { online: 'Online', offline: 'Offline', one_on_one: '1:1', group: 'Group', paid_dm: 'Paid DM' };

const fmtDuration = (min) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const Status = ({ active }) => (
  <StatusBadge status={active ? 'active' : 'disabled'} label={active ? 'Active' : 'Disabled'} />
);

// Shared action icons (used by both the desktop table and the mobile card list).
const PATHS = {
  view:    'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
  edit:    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  dup:     'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  disable: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  enable:  'M5 13l4 4L19 7',
  del:     'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
};
const Icon = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

const EmptyServices = ({ filter, search }) => (
  <div className="py-14 text-center">
    <div className="mb-3 text-gray-300">
      <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    </div>
    <p className="text-sm text-gray-400">No services here yet.</p>
    {filter === 'all' && !search && (
      <Link to="/dashboard/service/add-new" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
        Create your first service →
      </Link>
    )}
  </div>
);

export default function ServicesList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // service to confirm delete

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await svcGetAll();
      setServices(data || []);
    } catch {
      setError(true);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = services;
    if (filter === 'active')   list = list.filter(s => s.is_active);
    if (filter === 'disabled') list = list.filter(s => !s.is_active);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => (s.title || '').toLowerCase().includes(q) || (s.short_description || s.description || '').toLowerCase().includes(q));
    }
    return list;
  }, [services, filter, search]);

  const handleToggle = async (s) => {
    try {
      await svcToggle(s.id);
      toast.success(s.is_active ? 'Service disabled' : 'Service enabled');
      load();
    } catch { toast.error('Failed to toggle'); }
  };

  const handleDuplicate = async (s) => {
    try {
      await svcDuplicate(s.id);
      toast.success('Service duplicated');
      load();
    } catch { toast.error('Failed to duplicate'); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await svcDelete(confirmDelete.id);
      toast.success('Service deleted');
      setConfirmDelete(null);
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const counts = {
    all: services.length,
    active: services.filter(s => s.is_active).length,
    disabled: services.filter(s => !s.is_active).length,
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Services" subtitle="Manage everything you offer." />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (error && services.length === 0) {
    return (
      <div>
        <PageHeader title="Services" subtitle="Manage everything you offer." />
        <ErrorState message="Couldn’t load your services." onRetry={load} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle={`${counts.active} active · ${counts.all} total`}
        actions={
          <Link to="/dashboard/service/add-new" className={cn(buttonClasses({ variant: 'primary' }), 'hidden sm:inline-flex')}>
            <Plus className="h-4 w-4" />
            Add Service
          </Link>
        }
      />

      {/* Filters — segmented control + search */}
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SegmentedControl
          className="sm:w-auto sm:flex-1"
          value={filter}
          onChange={setFilter}
          options={['all', 'active', 'disabled'].map(f => ({
            value: f, label: f.charAt(0).toUpperCase() + f.slice(1), count: counts[f],
          }))}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search services…" className="sm:w-56" />
      </div>

      {/* Table — desktop / tablet only (mobile uses the card list below) */}
      <Card padded={false} className="hidden overflow-hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <th className="w-12 px-4 py-3 text-left">Thumb</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Type</th>
                <th className="px-4 py-3 text-left">Price</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Duration</th>
                <th className="hidden px-4 py-3 text-left lg:table-cell">Bookings</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="hidden px-4 py-3 text-left lg:table-cell">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={9}><EmptyServices filter={filter} search={search} /></td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className={cn('transition-colors hover:bg-gray-50', !s.is_active && 'opacity-60')}>
                  <td className="px-4 py-3">
                    {s.thumbnail_url
                      ? <img src={s.thumbnail_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-300">{(s.title || '?').charAt(0).toUpperCase()}</div>}
                  </td>
                  <td className="max-w-[200px] px-4 py-3">
                    <p className="truncate font-medium text-gray-800">{s.title}</p>
                    {(s.short_description || s.description) && (
                      <p className="truncate text-xs text-gray-400">{s.short_description || s.description}</p>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-gray-500 sm:table-cell">
                    {TYPE_LABEL[s.meeting_mode] || TYPE_LABEL[s.service_type] || s.meeting_mode || '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">{s.price === 0 ? 'Free' : `₹${s.price}`}</td>
                  <td className="hidden px-4 py-3 text-xs text-gray-500 md:table-cell">{fmtDuration(s.duration)}</td>
                  <td className="hidden px-4 py-3 text-xs text-gray-500 lg:table-cell">{s.total_bookings || 0}</td>
                  <td className="px-4 py-3"><Status active={s.is_active} /></td>
                  <td className="hidden px-4 py-3 text-xs text-gray-400 lg:table-cell">
                    {new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {s.slug && s.is_active && (
                        <a href={`/${user?.username}/booking/${s.slug}`} target="_blank" rel="noreferrer" title="View public page"
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600">
                          <Icon d={PATHS.view} />
                        </a>
                      )}
                      <button onClick={() => navigate(`/dashboard/service/edit/${s.id}`)} title="Edit"
                        className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary">
                        <Icon d={PATHS.edit} />
                      </button>
                      <button onClick={() => handleDuplicate(s)} title="Duplicate"
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700">
                        <Icon d={PATHS.dup} />
                      </button>
                      <button onClick={() => handleToggle(s)} title={s.is_active ? 'Disable' : 'Enable'}
                        className={cn('rounded-lg p-1.5 transition-colors', s.is_active ? 'text-red-400 hover:bg-red-50 hover:text-red-600' : 'text-green-500 hover:bg-green-50 hover:text-green-700')}>
                        <Icon d={s.is_active ? PATHS.disable : PATHS.enable} />
                      </button>
                      <button onClick={() => setConfirmDelete(s)} title="Delete"
                        className="rounded-lg p-1.5 text-red-300 transition-colors hover:bg-red-50 hover:text-red-600">
                        <Icon d={PATHS.del} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t bg-gray-50 px-4 py-3 text-xs text-gray-400">
          Disabled services remain in historical booking records.
        </div>
      </Card>

      {/* Mobile card list — actions are always visible (no horizontal scroll needed) */}
      <div className="space-y-3 sm:hidden">
        {filtered.length === 0 ? (
          <Card padded={false}><EmptyServices filter={filter} search={search} /></Card>
        ) : filtered.map(s => {
          const typeLabel = TYPE_LABEL[s.meeting_mode] || TYPE_LABEL[s.service_type] || s.meeting_mode || '—';
          return (
            <Card key={s.id} className={cn(!s.is_active && 'opacity-70')}>
              <button
                type="button"
                onClick={() => navigate(`/dashboard/service/edit/${s.id}`)}
                className="flex w-full items-start gap-3 text-left"
              >
                {s.thumbnail_url
                  ? <img src={s.thumbnail_url} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
                  : <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-300">{(s.title || '?').charAt(0).toUpperCase()}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold text-gray-800">{s.title}</p>
                    <Status active={s.is_active} />
                  </div>
                  {(s.short_description || s.description) && (
                    <p className="mt-0.5 truncate text-xs text-gray-400">{s.short_description || s.description}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span className="font-semibold text-primary">{s.price === 0 ? 'Free' : `₹${s.price}`}</span>
                    <span>{typeLabel}</span>
                    <span>{fmtDuration(s.duration)}</span>
                    <span>{s.total_bookings || 0} bookings</span>
                  </div>
                </div>
              </button>

              {/* Secondary actions (tap the card to edit). Delete sits apart. */}
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
                {s.slug && s.is_active && (
                  <a href={`/${user?.username}/booking/${s.slug}`} target="_blank" rel="noreferrer"
                    className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100">
                    <Icon d={PATHS.view} /> View public page
                  </a>
                )}
                <button onClick={() => handleDuplicate(s)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100">
                  <Icon d={PATHS.dup} /> Duplicate
                </button>
                <button onClick={() => handleToggle(s)}
                  className={cn('inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium', s.is_active ? 'border-red-200 text-red-600 hover:bg-red-50 active:bg-red-100' : 'border-green-200 text-green-700 hover:bg-green-50 active:bg-green-100')}>
                  <Icon d={s.is_active ? PATHS.disable : PATHS.enable} /> {s.is_active ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => setConfirmDelete(s)}
                  className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100">
                  <Icon d={PATHS.del} /> Delete
                </button>
              </div>
            </Card>
          );
        })}
        <p className="px-1 pt-1 text-xs text-gray-400">Disabled services remain in historical booking records.</p>
      </div>

      {/* Confirm delete */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Service?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        {confirmDelete && (
          <p className="text-sm text-gray-600">
            "<strong>{confirmDelete.title}</strong>" will be permanently deleted. This cannot be undone.
          </p>
        )}
      </Modal>

      {/* Mobile: floating "Add service" (phones only; header button shows sm+) */}
      <Fab as={Link} to="/dashboard/service/add-new" icon={Plus} label="Add service" iconOnly className="sm:hidden" />
    </div>
  );
}
