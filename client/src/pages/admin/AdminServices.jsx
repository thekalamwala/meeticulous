import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  adminGetServices,
  adminUpdateService,
  adminDeleteService,
  adminListServiceCategories,
} from "../../services/api";
import toast from "react-hot-toast";
import SeoDrawer from "../../components/admin/SeoDrawer";
import { PageHeader, Badge } from "../../components/admin/ui";

// ── Inline SVG icons (1.75 stroke, no emoji) ──────────────────────
const Ic = ({ d, size = 16, className = "", strokeWidth = 1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    className={`flex-shrink-0 ${className}`}>
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>
);

const IC = {
  video:   ['M23 7l-7 5 7 5V7z', 'M14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z'],
  mapPin:  ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z', 'M12 7a3 3 0 100 6 3 3 0 000-6z'],
  pencil:  ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z'],
  globe:   ['M12 2a10 10 0 100 20 10 10 0 000-20z', 'M2 12h20', 'M12 2c2.5 2.7 4 6.3 4 10s-1.5 7.3-4 10c-2.5-2.7-4-6.3-4-10s1.5-7.3 4-10z'],
  trash:   ['M3 6h18', 'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2'],
  x:       ['M18 6L6 18', 'M6 6l12 12'],
  layers:  ['M12 2L2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
};

// Mode = video (Online, blue) / map marker (Offline, red). Icon-only + tooltip.
const ModeIcon = ({ mode }) => {
  const offline = mode === "offline";
  return (
    <span title={offline ? "Offline" : "Online"} aria-label={offline ? "Offline" : "Online"}
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg"
      style={{ background: offline ? "#DC26261A" : "#960D321A" }}>
      <Ic d={offline ? IC.mapPin : IC.video} size={15}
        className={offline ? "text-[#DC2626]" : "text-[#960D32]"} />
    </span>
  );
};

const IconBtn = ({ icon, label, onClick, tone = "gray" }) => {
  const tones = {
    gray:    "adm-t3 hover:text-[#960D32] hover:bg-[#960D32]/10",
    danger:  "text-rose-500 hover:text-rose-700 hover:bg-rose-50",
  };
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${tones[tone]}`}>
      <Ic d={icon} size={16} />
    </button>
  );
};

const AdminServices = () => {
  const [services, setServices] = useState([]);
  const [cats, setCats] = useState([]);          // all taxonomy rows (every profession)
  const [loading, setLoading] = useState(true);
  const [seoEntity, setSeoEntity] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  // Merge the admin SEO update back into the row so the No-index badge reflects.
  const handleSeoSaved = (row) =>
    setServices((list) => list.map((s) => (s.id === row.id ? { ...s, ...row } : s)));

  const load = async () => {
    try {
      const [svc, cat] = await Promise.all([
        adminGetServices(),
        adminListServiceCategories(),
      ]);
      setServices(svc.data || []);
      setCats(cat.data?.categories || []);
    } catch {
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // slug label lookup, scoped by profession (slug is unique per primary_category).
  const labelFor = useMemo(() => {
    const m = new Map();
    cats.forEach((c) => m.set(`${c.primary_category}|${c.slug}`, c.name));
    return (primary, slug) => (slug ? m.get(`${primary}|${slug}`) || slug : null);
  }, [cats]);

  // Active categories available to a given profession (edit dropdown).
  const optionsFor = useMemo(() => {
    const byPrimary = {};
    cats.forEach((c) => {
      if (c.is_active === false) return;
      (byPrimary[c.primary_category] ||= []).push(c);
    });
    return (primary) => byPrimary[primary] || [];
  }, [cats]);

  const startEdit = (s) => {
    if (!s.profiles?.primary_category) {
      toast.error("Host has no profession set — cannot assign a category");
      return;
    }
    setEditingId(s.id);
  };

  const saveCategory = async (s, value) => {
    setSavingId(s.id);
    try {
      const { data } = await adminUpdateService(s.id, { category: value });
      setServices((list) => list.map((x) => (x.id === s.id ? { ...x, ...data } : x)));
      setEditingId(null);
      toast.success(value ? "Category updated" : "Category cleared");
    } catch (e) {
      toast.error(e.response?.data?.message || "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this service?")) return;
    try {
      await adminDeleteService(id);
      setServices((list) => list.filter((s) => s.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed");
    }
  };

  if (loading) return <div className="text-center py-12 adm-t3">Loading...</div>;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="All Services"
        subtitle={`${services.length} services on the platform.`}
        actions={
          <Link to="/admin/services/categories"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium bg-[#960D32] text-white hover:bg-[#e54900] transition-colors">
            <Ic d={IC.layers} size={15} />All Service Categories
          </Link>
        }
      />

      <div className="adm-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="adm-table w-full text-sm fb-table">
            <thead className="text-left text-xs adm-t3 uppercase">
              <tr>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Service Category</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Host</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y adm-border">
              {services.map((s) => {
                const username = s.profiles?.username;
                const primary = s.profiles?.primary_category;
                const catLabel = labelFor(primary, s.category);
                const editing = editingId === s.id;
                return (
                  <tr key={s.id}>
                    {/* Service — links to the public service page */}
                    <td data-label="Service" className="px-4 py-3">
                      {username && s.slug ? (
                        <a href={`/${username}/${s.slug}`} target="_blank" rel="noreferrer"
                          className="font-medium adm-t1 hover:text-[#960D32] hover:underline">
                          {s.title}
                        </a>
                      ) : (
                        <span className="font-medium adm-t1">{s.title}</span>
                      )}
                    </td>

                    {/* Service Category — inline editable */}
                    <td data-label="Service Category" className="px-4 py-3">
                      {editing ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            autoFocus
                            defaultValue={s.category || ""}
                            disabled={savingId === s.id}
                            onChange={(e) => saveCategory(s, e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] adm-t1 bg-white focus:ring-2 focus:ring-[#960D32]/30 focus:border-[#960D32] outline-none max-w-[200px]">
                            <option value="">— No category —</option>
                            {optionsFor(primary).map((c) => (
                              <option key={c.id} value={c.slug}>{c.name}</option>
                            ))}
                          </select>
                          <IconBtn icon={IC.x} label="Cancel" onClick={() => setEditingId(null)} />
                        </div>
                      ) : catLabel ? (
                        <Badge tone="neutral">{catLabel}</Badge>
                      ) : (
                        <span className="text-xs adm-t3 italic">Not set</span>
                      )}
                    </td>

                    {/* Duration */}
                    <td data-label="Duration" className="px-4 py-3 adm-t2 tabular-nums whitespace-nowrap">
                      {s.duration} min
                    </td>

                    {/* Mode — icon only */}
                    <td data-label="Mode" className="px-4 py-3">
                      <ModeIcon mode={s.meeting_mode} />
                    </td>

                    {/* Host — links to the public profile */}
                    <td data-label="Host" className="px-4 py-3 text-xs adm-t2">
                      {username ? (
                        <a href={`/${username}`} target="_blank" rel="noreferrer"
                          className="block hover:text-[#960D32]">
                          <span className="font-medium adm-t1">{s.profiles?.name}</span>
                          <span className="block adm-t3">@{username}</span>
                        </a>
                      ) : (
                        <span className="adm-t3">{s.profiles?.name || "—"}</span>
                      )}
                    </td>

                    {/* Price */}
                    <td data-label="Price" className="px-4 py-3 font-medium adm-t1 whitespace-nowrap">
                      {s.price === 0 ? "Free" : `₹${s.price}`}
                    </td>

                    {/* Status */}
                    <td data-label="Status" className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge tone={s.is_active ? "ok" : "neutral"}>
                          {s.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {s.is_indexable === false && <Badge tone="danger">No-index</Badge>}
                      </div>
                    </td>

                    {/* Actions — Edit · SEO · Delete */}
                    <td data-label="Actions" className="px-4 py-3">
                      <div className="flex items-center gap-0.5 justify-end">
                        <IconBtn icon={IC.pencil} label="Edit category" onClick={() => startEdit(s)} />
                        <IconBtn icon={IC.globe} label="SEO settings" onClick={() => setSeoEntity(s)} />
                        <IconBtn icon={IC.trash} label="Delete service" tone="danger" onClick={() => handleDelete(s.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {seoEntity && (
        <SeoDrawer
          kind="service"
          entity={seoEntity}
          onClose={() => setSeoEntity(null)}
          onSaved={handleSeoSaved}
        />
      )}
    </div>
  );
};

export default AdminServices;
