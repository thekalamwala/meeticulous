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

  const Field = ({ icon: Icon, label, children, hint }) => (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
        <Icon size={13} /> {label} {hint && <span className="text-gray-300">· {hint}</span>}
      </label>
      {children}
    </div>
  );

  const inputCls =
    "w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:border-[#960D32] focus:ring-1 focus:ring-[#960D32] outline-none disabled:bg-gray-50 disabled:text-gray-400";

  return (
    <>
      <AccountModeToggle />
      <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Profile</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your personal details.</p>
          </div>
          {!editing && !loading && (
            <button onClick={() => setEditing(true)}
              className="text-sm font-medium text-[#960D32] hover:underline whitespace-nowrap">Edit</button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <PetalSpinner size={40} />
          </div>
        ) : (
          <div className="bg-white border rounded-2xl p-5 sm:p-6 space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {form.profile_image ? (
                  <img src={form.profile_image} alt="" className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#960D32] text-white text-2xl font-bold select-none">
                    {form.name ? form.name[0].toUpperCase() : "U"}
                  </span>
                )}
                {editing && (
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border shadow flex items-center justify-center text-gray-600 hover:text-[#960D32]">
                    {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{form.name || "Your name"}</p>
                <p className="text-sm text-gray-400 truncate">{form.email}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-1">
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
              <div className="flex items-center gap-3 pt-2 border-t">
                <button onClick={onSave} disabled={saving}
                  className="btn inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#960D32] hover:bg-[#2A1416] disabled:opacity-60">
                  {saving && <Loader2 size={15} className="animate-spin" />} Save changes
                </button>
                <button onClick={() => setEditing(false)} disabled={saving}
                  className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            )}
          </div>
        )}

        <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-4">
          <Lock size={12} /> Your details are private and never shown to hosts beyond your bookings.
        </p>
    </>
  );
};

export default CustomerProfile;
