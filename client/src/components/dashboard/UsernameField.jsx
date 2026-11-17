import { useState, useRef } from "react";
import { Pencil, Info } from "lucide-react";
import toast from "react-hot-toast";
import { changeUsername, checkUsername } from "../../services/api";

// Gated, permanent username control for the dashboard profile page.
//
// Rules (enforced server-side; mirrored here for UX):
//   - Username is permanent and changes go ONLY through this control.
//   - Requires a verified WhatsApp number.
//   - Max 2 changes per rolling 365 days, >= 6 months between changes.
//   - Display name (Creator Name) is editable independently and is NOT this.
//
// Props: user (auth user), onChanged(newUsername) to sync auth state.
export default function UsernameField({ user, onChanged, variant = "default" }) {
  const current = user?.username || "";
  const verified = !!user?.whatsapp_verified;

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [status, setStatus] = useState(null); // { available, reason }
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState(false); // inline variant: rules popover
  const debounceRef = useRef(null);

  const rulesText = verified
    ? "Permanent handle — at most twice a year, 6 months apart. Old links redirect here."
    : "Verify your WhatsApp number to claim a custom username. Changeable twice a year, with at least 6 months between changes. Old links keep working.";

  const onType = (e) => {
    const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setValue(v);
    setStatus(null);
    clearTimeout(debounceRef.current);
    if (!v || v === current) return;
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await checkUsername(v);
        setStatus(data);
      } catch {
        /* ignore transient check errors */
      }
    }, 400);
  };

  const save = async () => {
    if (!value || value === current) return setEditing(false);
    setSaving(true);
    try {
      const { data } = await changeUsername(value);
      toast.success("Username changed. Your old link now redirects here.");
      onChanged?.(data.username);
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not change username.");
    } finally {
      setSaving(false);
    }
  };

  // Inline variant — lives on the profile card next to location. Same gated logic
  // (WhatsApp-verified, availability check, rate limits); editor + rules open as
  // popovers so it fits one line.
  if (variant === "inline") {
    // In-place edit (Twitter/Facebook style): the handle itself becomes an input,
    // commits on Enter/blur, cancels on Esc. cancelRef skips the blur-save on Esc.
    const cancelRef = { current: false };
    const onKey = (e) => {
      if (e.key === "Escape") { cancelRef.current = true; e.target.blur(); }
      if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
    };
    const onBlur = () => {
      if (cancelRef.current) { cancelRef.current = false; setEditing(false); setValue(current); setStatus(null); return; }
      if (status && !status.available) return; // keep editing on a taken handle
      save();
    };
    return (
      <span className="relative inline-flex items-center gap-1 text-neutral-400">
        <span className="shrink-0">meeticulous.com/</span>
        {editing ? (
          <input type="text" autoFocus value={value} onChange={onType} onBlur={onBlur} onKeyDown={onKey}
            size={Math.max(8, value.length + 1)} placeholder="your-handle"
            aria-label="Profile username"
            className="min-w-0 rounded-md border-2 border-maroon/40 bg-white px-1.5 py-0.5 text-sm text-ink focus:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/40" />
        ) : (
          <button type="button" disabled={!verified}
            onClick={() => { setValue(current); setInfo(false); setEditing(true); }}
            title={verified ? "Change your handle" : undefined}
            className="group inline-flex items-center gap-1 text-left disabled:cursor-default">
            <span className="truncate text-neutral-500">{current || "your-handle"}</span>
            {verified && <Pencil className="h-3.5 w-3.5 shrink-0 text-neutral-300 opacity-0 transition group-hover:opacity-100" strokeWidth={2.25} />}
          </button>
        )}

        {editing && status && value !== current && (
          <span className={`shrink-0 text-xs ${status.available ? "text-green-600" : "text-red-600"}`}>
            {saving ? "…" : status.available ? "✓" : (status.reason || "taken")}
          </span>
        )}

        {!editing && (
          <button type="button" onClick={() => setInfo((o) => !o)}
            title="Username rules" aria-label="Username rules"
            className="shrink-0 text-neutral-300 transition hover:text-maroon">
            <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        )}

        {info && (
          <>
            <button type="button" aria-hidden="true" tabIndex={-1} onClick={() => setInfo(false)}
              className="fixed inset-0 z-10 cursor-default" />
            <div className="absolute left-0 top-full z-20 mt-1.5 w-64 rounded-2xl border-2 border-maroon/10 bg-white p-3 text-xs leading-snug text-neutral-600 shadow-lg">
              {rulesText}
            </div>
          </>
        )}
      </span>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1">Profile URL</label>

      {!editing ? (
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-lg border bg-gray-50">
            <span className="shrink-0 px-3 py-2 text-sm text-gray-400 border-r">meeticulous.com/</span>
            <span className="truncate px-3 py-2 text-sm">{current || "—"}</span>
          </div>
          {verified ? (
            <button type="button" onClick={() => { setValue(current); setEditing(true); }}
              className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50">
              Change
            </button>
          ) : null}
        </div>
      ) : (
        <div>
          <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border focus-within:ring-2 focus-within:ring-primary sm:flex-row">
            <span className="shrink-0 bg-gray-50 px-3 py-2 text-sm text-gray-400 border-b sm:border-b-0 sm:border-r">meeticulous.com/</span>
            <input type="text" autoFocus value={value} onChange={onType}
              className="flex-1 px-3 py-2 text-sm focus:outline-none"
              placeholder="your-new-handle" />
          </div>

          {status && value !== current ? (
            <p className={`mt-1 text-xs ${status.available ? "text-green-600" : "text-red-600"}`}>
              {status.available ? "Available" : (status.reason || "Unavailable")}
            </p>
          ) : null}

          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={save}
              disabled={saving || !value || value === current || (status && !status.available)}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save username"}
            </button>
            <button type="button" onClick={() => { setEditing(false); setValue(current); setStatus(null); }}
              className="rounded-lg border px-3 py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {!verified ? (
        <p className="mt-1 text-xs text-gray-500">
          Verify your WhatsApp number to claim a custom username. Changeable twice a
          year, with at least 6 months between changes. Old links keep working.
        </p>
      ) : (
        <p className="mt-1 text-xs text-gray-500">
          Permanent handle — at most twice a year, 6 months apart. Old links redirect here.
        </p>
      )}
    </div>
  );
}
