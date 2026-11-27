import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Lock } from "lucide-react";
import { getMe, updateMe, uploadImage } from "../services/api";
import { useAuth } from "../context/AuthContext";
import AccountModeToggle from "../components/common/AccountModeToggle";
import { PageHeading, Panel, cn } from "../components/dashboard/ui/v2";
import toast from "react-hot-toast";
import { btnPrimary, btnQuiet, btnSoft, ring } from "./guest/GuestKit";

// /user/profile — guest profile: view + edit (Kept).
// Editable: name, phone, profile photo, date of birth. Email is the auth
// identity → read-only.

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

// Defined at module scope on purpose: a component declared inside CustomerProfile
// gets a new function identity every render, so React unmounts+remounts its
// subtree each keystroke — the input loses focus and the value/placeholder reset.
const Field = ({ label, hint, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[13px] font-medium text-muted">{label}{hint && <span className="text-faint"> · {hint}</span>}</span>
    {children}
  </label>
);

const inputCls = cn(
  "h-11 w-full rounded-[12px] border-0 bg-cream px-3.5 text-[15px] text-ink outline-none transition",
  "focus:ring-[3px] focus:ring-rose disabled:bg-neutral-100 disabled:text-muted",
);

const CustomerProfile = () => {
  const { user, updateUser } = useAuth();
  const fileRef = useRef(null);

  const [form, setForm] = useState({ name: "", phone: "", email: "", profile_image: "", date_of_birth: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    getMe()
      .then(({ data }) => setForm({
        name: data.name || "",
        phone: data.phone || "",
        email: data.email || "",
        profile_image: data.profile_image || "",
        date_of_birth: data.date_of_birth || "",
      }))
      .catch(() => {
        // Fall back to cached auth user if the refresh fails
        if (user) setForm((f) => ({ ...f, name: user.name || "", email: user.email || "", phone: user.phone || "", profile_image: user.profile_image || "" }));
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (file.size > MAX_SIZE_BYTES) return toast.error("Image must be under 2MB.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const { data } = await uploadImage(fd, "user-profiles");
      setForm((f) => ({ ...f, profile_image: data.url }));
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!form.name.trim()) return toast.error("Name cannot be empty.");
    setSaving(true);
    try {
      const { data } = await updateMe({
        name: form.name.trim(),
        phone: form.phone.trim(),
        profile_image: form.profile_image,
        date_of_birth: form.date_of_birth || null,
      });
      updateUser({ name: data.name, phone: data.phone, profile_image: data.profile_image });
      toast.success("Profile updated");
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Profile" sub="Your personal details."
        action={!editing && !loading && <button type="button" onClick={() => setEditing(true)} className={btnSoft}>Edit</button>} />
      <AccountModeToggle />

      {loading ? (
        <div aria-hidden="true" className="h-80 animate-pulse rounded-[24px] bg-white" />
      ) : (
        <Panel>
          <div className="flex items-center gap-4">
            <div className="relative">
              {form.profile_image ? (
                <img src={form.profile_image} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <span className="grid h-16 w-16 select-none place-items-center rounded-full bg-maroon font-display text-[22px] font-extrabold text-white">
                  {form.name ? form.name[0].toUpperCase() : "U"}
                </span>
              )}
              {editing && (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Change photo"
                  className={cn("absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-white text-muted shadow-[var(--shadow-sm)] transition hover:text-maroon", ring)}>
                  {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} strokeWidth={2} />}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
            </div>
            <div className="min-w-0">
              <p className="mb-0 truncate font-display text-[20px] font-bold tracking-[-0.02em] text-ink">{form.name || "Your name"}</p>
              <p className="mb-0 truncate text-[14px] text-muted">{form.email}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input className={inputCls} disabled={!editing} value={form.name} onChange={set("name")} placeholder="Your name" />
            </Field>
            <Field label="Phone number">
              <input className={inputCls} disabled={!editing} value={form.phone} onChange={set("phone")} placeholder="+91…" inputMode="tel" />
            </Field>
            <Field label="Email" hint="can't be changed">
              <input className={inputCls} disabled value={form.email} />
            </Field>
            <Field label="Date of birth" hint="private, for your birthday wish">
              <input type="date" className={inputCls} disabled={!editing} value={form.date_of_birth}
                max={new Date().toISOString().slice(0, 10)} onChange={set("date_of_birth")} />
            </Field>
          </div>

          {editing && (
            <div className="mt-6 flex items-center gap-2 border-t border-neutral-200 pt-5">
              <button type="button" onClick={onSave} disabled={saving} className={btnPrimary}>
                {saving && <Loader2 size={15} className="animate-spin" />} Save changes
              </button>
              <button type="button" onClick={() => setEditing(false)} disabled={saving} className={btnQuiet}>Cancel</button>
            </div>
          )}
        </Panel>
      )}

      <p className="mb-0 flex items-center gap-2 text-[13px] text-muted">
        <Lock size={14} className="shrink-0 text-maroon" strokeWidth={2} /> Your details are private and never shown to hosts beyond your bookings.
      </p>
    </div>
  );
};

export default CustomerProfile;
