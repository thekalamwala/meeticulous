import { useState, useEffect } from 'react';
import {
  adminListStaff, adminListRoles, adminCreateStaff,
  adminUpdateStaff, adminSetStaffActive, adminResetStaffPass,
  adminHost360Managers, adminHost360CreateManager, adminHost360UpdateManager,
} from '../../services/api';
import toast from 'react-hot-toast';
import { PageHeader, Btn, Badge, Skeleton } from '../../components/admin/ui';

// Admin Staff & Roles (Super Admin only). Lists staff, creates/edits accounts,
// activates/deactivates, resets passwords. One-time temp passwords are shown
// in a copyable banner after create/reset — never re-retrievable.

const EMPTY_FORM = { email: '', username: '', name: '', role_key: 'operations', crm_team: '', password: '' };

const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const AdminStaff = () => {
  const [staff, setStaff]     = useState([]);
  const [roles, setRoles]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShow]   = useState(false);
  const [editing, setEditing] = useState(null);          // staff row being edited, or null
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [secret, setSecret]   = useState(null);          // { username, password } one-time banner

  const load = async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([adminListStaff(), adminListRoles()]);
      setStaff(s.data.staff || []);
      setRoles(r.data.roles || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const roleName = (key) => roles.find((r) => r.key === key)?.name || key;

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShow(true); };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ email: row.email, username: row.username, name: row.name, role_key: row.role_key, crm_team: row.crm_team || '', password: '' });
    setShow(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await adminUpdateStaff(editing.id, { name: form.name, role_key: form.role_key, crm_team: form.crm_team || null });
        toast.success('Staff updated');
      } else {
        const { data } = await adminCreateStaff(form);
        if (data.temp_password) setSecret({ username: data.staff.username, password: data.temp_password });
        toast.success('Staff created');
      }
      setShow(false);
      load();
    } catch (e2) {
      toast.error(e2.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      await adminSetStaffActive(row.id, !row.is_active);
      toast.success(row.is_active ? 'Deactivated' : 'Activated');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    }
  };

  const resetPass = async (row) => {
    try {
      const { data } = await adminResetStaffPass(row.id, {});
      if (data.temp_password) setSecret({ username: row.username, password: data.temp_password });
      toast.success('Password reset');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Reset failed');
    }
  };

  return (
    <div>
      <PageHeader title="Staff & Roles" subtitle="Admin accounts and their access level. Super Admin only."
        actions={<Btn size="sm" onClick={openCreate}>+ Add Staff</Btn>} />

      {/* One-time credential banner */}
      {secret && (
        <div className="mb-5 rounded-xl border-2 border-[#191919] bg-[#F8FAFC] p-4">
          <p className="text-sm font-bold adm-t1">Temporary password for @{secret.username}</p>
          <p className="text-[12px] adm-t3 mb-2">Share it securely. It cannot be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 adm-card border adm-border rounded-lg text-sm font-mono select-all">{secret.password}</code>
            <Btn variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(secret.password); toast.success('Copied'); }}>Copy</Btn>
            <Btn variant="outline" size="sm" onClick={() => setSecret(null)}>Done</Btn>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : (
        <div className="adm-card rounded-2xl overflow-hidden">
          <table className="adm-table w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Username</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Role</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Last login</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((row) => (
                <tr key={row.id} className="border-b adm-border last:border-0 adm-hoverable transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold adm-t2">{row.name}</p>
                    <p className="text-[11px] adm-t3">{row.email}</p>
                  </td>
                  <td className="px-4 py-3 adm-t2">@{row.username}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-[#2E1065]/10 text-[#2E1065]">{roleName(row.role_key)}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-[12px] adm-t3">{fmtDate(row.last_login_at)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={row.is_active ? 'ok' : 'danger'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(row)} className="text-[12px] adm-t3 hover:text-[color:var(--adm-text-1)] px-2 py-1 rounded adm-hoverable">Edit</button>
                      <button onClick={() => resetPass(row)} className="text-[12px] adm-t3 hover:text-[color:var(--adm-text-1)] px-2 py-1 rounded adm-hoverable">Reset PW</button>
                      <button onClick={() => toggleActive(row)} className={`text-[12px] px-2 py-1 rounded adm-hoverable ${row.is_active ? 'text-red-500' : 'text-green-600'}`}>
                        {row.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center adm-t3">No staff yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Account Managers — assignable to hosts in Host 360. */}
      <AccountManagers />

      {/* Create / edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <div className="adm-card rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold adm-t1 mb-4">{editing ? 'Edit staff' : 'Add staff'}</h2>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium adm-t3 mb-1">Full name</label>
                <input className="fb-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium adm-t3 mb-1">Username</label>
                  <input className="fb-input" required disabled={!!editing} value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium adm-t3 mb-1">Email</label>
                  <input className="fb-input" type="email" required disabled={!!editing} value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium adm-t3 mb-1">Role</label>
                <select className="fb-input" value={form.role_key} onChange={(e) => setForm({ ...form, role_key: e.target.value })}>
                  {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                </select>
                <p className="text-[11px] adm-t3 mt-1">{roles.find((r) => r.key === form.role_key)?.description}</p>
              </div>
              <div>
                <label className="block text-xs font-medium adm-t3 mb-1">CRM team <span className="adm-t3">(pipeline handoffs)</span></label>
                <select className="fb-input" value={form.crm_team || ''} onChange={(e) => setForm({ ...form, crm_team: e.target.value })}>
                  <option value="">— None —</option>
                  <option value="sales">Sales (Presale)</option>
                  <option value="relations">Relations (Customer Relations)</option>
                  <option value="marketing">Marketing</option>
                </select>
                <p className="text-[11px] adm-t3 mt-1">Leads handed to this team auto-assign to its least-loaded member.</p>
              </div>
              {!editing && (
                <div>
                  <label className="block text-xs font-medium adm-t3 mb-1">Initial password <span className="adm-t3">(optional)</span></label>
                  <input className="fb-input" type="text" placeholder="Leave blank to auto-generate" value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Btn size="sm" type="submit" disabled={saving} className="flex-1">{saving ? 'Saving…' : 'Save'}</Btn>
                <Btn variant="outline" size="sm" type="button" onClick={() => setShow(false)}>Cancel</Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Account Managers — lightweight directory of people who own hosts. Assigned to
// a host from Host 360. Managed here alongside staff (staff.manage gated).
const AM_EMPTY = { name: '', email: '', phone: '' };

const AccountManagers = () => {
  const [managers, setManagers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShow]     = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(AM_EMPTY);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await adminHost360Managers();
      setManagers(data.managers || []);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to load account managers');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(AM_EMPTY); setShow(true); };
  const openEdit = (row) => { setEditing(row); setForm({ name: row.name, email: row.email || '', phone: row.phone || '' }); setShow(true); };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await adminHost360UpdateManager(editing.id, form);
      else await adminHost360CreateManager(form);
      toast.success('Saved');
      setShow(false);
      load();
    } catch (e2) {
      toast.error(e2.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      await adminHost360UpdateManager(row.id, { is_active: !row.is_active });
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Action failed');
    }
  };

  return (
    <div className="mt-10">
      <PageHeader title="Account Managers" subtitle="People who own hosts. Assign them from Host 360."
        actions={<Btn size="sm" onClick={openCreate}>+ Add Manager</Btn>} />

      {loading ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : (
        <div className="adm-card rounded-2xl overflow-hidden">
          <table className="adm-table w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Email</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Phone</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((row) => (
                <tr key={row.id} className="border-b adm-border last:border-0 adm-hoverable transition-colors">
                  <td className="px-4 py-3 font-semibold adm-t2">{row.name}</td>
                  <td className="px-4 py-3 hidden md:table-cell adm-t3">{row.email || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell adm-t3">{row.phone || '—'}</td>
                  <td className="px-4 py-3"><Badge tone={row.is_active ? 'ok' : 'danger'}>{row.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(row)} className="text-[12px] adm-t3 hover:text-[color:var(--adm-text-1)] px-2 py-1 rounded adm-hoverable">Edit</button>
                      <button onClick={() => toggleActive(row)} className={`text-[12px] px-2 py-1 rounded adm-hoverable ${row.is_active ? 'text-red-500' : 'text-green-600'}`}>
                        {row.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {managers.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center adm-t3">No account managers yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <div className="adm-card rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold adm-t1 mb-4">{editing ? 'Edit manager' : 'Add manager'}</h2>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium adm-t3 mb-1">Full name</label>
                <input className="fb-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium adm-t3 mb-1">Email</label>
                  <input className="fb-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium adm-t3 mb-1">Phone</label>
                  <input className="fb-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Btn size="sm" type="submit" disabled={saving} className="flex-1">{saving ? 'Saving…' : 'Save'}</Btn>
                <Btn variant="outline" size="sm" type="button" onClick={() => setShow(false)}>Cancel</Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStaff;
