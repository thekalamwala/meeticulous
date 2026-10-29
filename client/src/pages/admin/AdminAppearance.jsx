import { useState, useEffect } from "react";
import { adminGetAppearance, adminUpdateAppearance, adminUploadImage } from "../../services/api";
import toast from "react-hot-toast";
import BackgroundCurator from "../../components/admin/BackgroundCurator";
import { PageHeader, Card, Btn } from "../../components/admin/ui";

const MODES = [
  { key: "icon_text", label: "Icon + Text", hint: "Brand mark plus the “Meeticulous” wordmark." },
  { key: "image",     label: "Image",       hint: "A single full logo lockup image." },
  { key: "festive",   label: "Festive",     hint: "Seasonal logo — switch on manually, switch back after." },
];

// Which image slot each mode uses.
const SLOT = { icon_text: "icon_url", image: "logo_image_url", festive: "festive_logo_url" };

const SLOTS = [
  { field: "icon_url",         label: "Icon mark",   note: "Square mark used in Icon + Text mode." },
  { field: "logo_image_url",   label: "Logo image",  note: "Full lockup used in Image mode." },
  { field: "festive_logo_url", label: "Festive logo", note: "Seasonal lockup used in Festive mode." },
];

const AdminAppearance = () => {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [backgrounds, setBackgrounds] = useState({});
  const [defaultBackground, setDefaultBackground] = useState(null);

  // The save response returns `backgrounds` as an enabled-only array, so we
  // re-seed the editable raw map from a fresh appearance payload instead.
  const seedBackgrounds = (data) => {
    setBackgrounds(data?.backgrounds || {});
    setDefaultBackground(data?.default_background || null);
  };

  useEffect(() => {
    adminGetAppearance()
      .then(({ data }) => {
        setForm(data);
        seedBackgrounds(data);
      })
      .catch(() => toast.error("Failed to load appearance settings"))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleUpload = async (field, file) => {
    if (!file) return;
    setUploading(field);
    try {
      const { data } = await adminUploadImage(file, "branding");
      set(field, data.url);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Upload failed");
    } finally {
      setUploading("");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await adminUpdateAppearance({
        ...form,
        backgrounds,
        default_background: defaultBackground,
      });
      setForm(data);
      // Refetch to restore the full raw backgrounds map (save response returns
      // it as an enabled-only array, not the editable map).
      try {
        const { data: fresh } = await adminGetAppearance();
        seedBackgrounds(fresh);
      } catch {
        /* keep current background state if the refetch fails */
      }
      toast.success("Appearance saved");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <div className="text-center py-12 adm-t3">Loading…</div>;

  const activeUrl = form[SLOT[form.navbar_logo_mode]];

  return (
    <div className="max-w-2xl">
      <PageHeader title="Appearance" subtitle="Manage the navbar logo shown across the website." />

      <Card className="space-y-6">
        {/* Mode selector */}
        <div>
          <label className="block text-sm font-medium adm-t1 mb-2">Active navbar logo</label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => set("navbar_logo_mode", m.key)}
                className={`btn px-3 py-2 text-sm font-medium border ${
                  form.navbar_logo_mode === m.key
                    ? "bg-gray-900 text-white border-gray-900"
                    : "adm-card adm-t2 adm-border adm-hoverable"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs adm-t3 mt-1.5">
            {MODES.find((m) => m.key === form.navbar_logo_mode)?.hint}
          </p>
        </div>

        {/* Live preview */}
        <div>
          <label className="block text-sm font-medium adm-t1 mb-2">Preview</label>
          <div className="border adm-border rounded-lg p-4 bg-[var(--adm-hover)] flex items-center gap-2.5 min-h-[56px]">
            {form.navbar_logo_mode === "icon_text" ? (
              <>
                {form.icon_url && <img src={form.icon_url} alt="" className="h-[26px] w-[26px] rounded block" />}
                <span className="text-[15px] font-bold text-[#1E0B4D] tracking-tight">Meeticulous</span>
              </>
            ) : activeUrl ? (
              <img src={activeUrl} alt="Meeticulous" className="h-7 w-auto block" />
            ) : (
              <span className="text-sm adm-t3">No image for this mode yet — upload one below.</span>
            )}
          </div>
        </div>

        {/* Image slots */}
        <div className="space-y-4 border-t adm-border pt-4">
          {SLOTS.map(({ field, label, note }) => (
            <div key={field} className="flex items-center gap-3">
              <div className="w-16 h-12 border adm-border rounded bg-[var(--adm-hover)] flex items-center justify-center overflow-hidden shrink-0">
                {form[field]
                  ? <img src={form[field]} alt="" className="max-h-10 max-w-[60px] object-contain" />
                  : <span className="text-[10px] adm-t3">none</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium adm-t1">{label}</p>
                <p className="text-xs adm-t3 truncate">{note}</p>
              </div>
              <label className="btn btn--outline px-3 py-2 text-sm font-medium adm-t2 adm-hoverable cursor-pointer whitespace-nowrap">
                {uploading === field ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploading === field}
                  onChange={(e) => handleUpload(field, e.target.files?.[0])}
                />
              </label>
            </div>
          ))}
        </div>

        {/* Backgrounds */}
        <div className="border-t adm-border pt-4">
          <label className="block text-sm font-medium adm-t1 mb-1">Backgrounds</label>
          <p className="text-xs adm-t3 mb-3">
            Curate the animated host-page backgrounds. Enable a type, tune its look, and pick a default.
          </p>
          <BackgroundCurator
            value={{ backgrounds, default_background: defaultBackground }}
            onChange={(v) => {
              setBackgrounds(v.backgrounds);
              setDefaultBackground(v.default_background);
            }}
          />
        </div>

        <div className="flex justify-end pt-2 border-t adm-border">
          <Btn onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save appearance settings"}
          </Btn>
        </div>
      </Card>
    </div>
  );
};

export default AdminAppearance;
