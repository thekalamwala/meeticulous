import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Mail, Phone, User, Lock, Cake } from "lucide-react";
import { getMe, updateMe, uploadImage } from "../services/api";
import { useAuth } from "../context/AuthContext";
import AccountModeToggle from "../components/common/AccountModeToggle";
import toast from "react-hot-toast";
import PetalSpinner from "../components/common/PetalSpinner";

// /profile — end-user (guest) profile: view + edit.
// Editable today: name, phone, profile photo (columns exist on `profiles`).
// DOB + gender are shown but disabled — they need a DB migration before they
// can be persisted (see the gap list). Email is the auth identity → read-only.

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

// Defined at module scope on purpose: a component declared inside CustomerProfile
// gets a new function identity every render, so React unmounts+remounts its
// subtree each keystroke — the input loses focus and the value/placeholder reset.
const Field = ({ icon: Icon, label, children, hint }) => (
  <div>
    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink/40">
      <Icon size={13} strokeWidth={2.2} /> {label} {hint && <span className="font-medium normal-case tracking-normal text-ink/30">· {hint}</span>}
    </label>
    {children}
  </div>
);

const inputCls =
  "w-full rounded-xl border-2 border-neutral-200 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-ink outline-none transition focus:border-maroon/40 focus:ring-[3px] focus:ring-rose disabled:bg-neutral-50 disabled:text-ink/45";

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

  return (
    <>
      <AccountModeToggle />
      <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-[24px] font-extrabold leading-none tracking-[-0.04em] text-maroon">My profile</h1>
            <p className="mt-1.5 text-[13px] font-medium text-ink/55">Manage your personal details.</p>
          </div>
          {!editing && !loading && (
            <button onClick={() => setEditing(true)}
              className="whitespace-nowrap rounded-full border-2 border-neutral-200 px-3.5 py-1.5 text-[12px] font-bold text-ink/65 transition hover:border-maroon/40 hover:text-maroon focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">Edit</button>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <PetalSpinner size={40} />
          </div>
        ) : (
          <div className="flex flex-col gap-5 rounded-2xl border-2 border-neutral-200 bg-white p-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {form.profile_image ? (
                  <img src={form.profile_image} alt="" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <span className="grid h-16 w-16 select-none place-items-center rounded-full bg-maroon font-display text-[20px] font-extrabold text-white">
                    {form.name ? form.name[0].toUpperCase() : "U"}
                  </span>
                )}
                {editing && (
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-neutral-200 bg-white text-ink/55 shadow-sm transition hover:text-maroon">
                    {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} strokeWidth={2} />}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-[16px] font-extrabold tracking-[-0.02em] text-ink">{form.name || "Your name"}</p>
                <p className="truncate text-[12px] font-medium text-ink/50">{form.email}</p>
              </div>
            </div>

            <div className="grid gap-4 pt-1 sm:grid-cols-2">
              <Field icon={User} label="Full name">
                <input className={inputCls} disabled={!editing} value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Your name" />
              </Field>
              <Field icon={Phone} label="Phone number">
                <input className={inputCls} disabled={!editing} value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91…" />
              </Field>
              <Field icon={Mail} label="Email" hint="can't be changed">
                <input className={inputCls} disabled value={form.email} />
              </Field>
              <Field icon={Cake} label="Date of birth" hint="private — for your birthday wish">
                <input type="date" className={inputCls} disabled={!editing} value={form.date_of_birth}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
              </Field>
            </div>

            {editing && (
              <div className="flex items-center gap-3 border-t-2 border-neutral-200 pt-3">
                <button onClick={onSave} disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-maroon px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose disabled:opacity-60">
                  {saving && <Loader2 size={15} className="animate-spin" />} Save changes
                </button>
                <button onClick={() => setEditing(false)} disabled={saving}
                  className="text-[13px] font-semibold text-ink/55 transition hover:text-ink">Cancel</button>
              </div>
            )}
          </div>
        )}

        <p className="mt-4 flex items-center gap-2 rounded-xl bg-cream p-3 text-[11.5px] font-medium text-ink/55">
          <Lock size={14} className="shrink-0 text-maroon" strokeWidth={2} /> Your details are private and never shown to hosts beyond your bookings.
        </p>
    </>
  );
};

export default CustomerProfile;
