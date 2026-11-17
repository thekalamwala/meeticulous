import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Quote, Plus, Pencil, Trash2, Lock } from "lucide-react";
import toast from "react-hot-toast";
import {
  getMyTestimonials, createTestimonial, updateTestimonial, deleteTestimonial,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { isFreePlan } from "../utils/themeUtils";
import {
  PageHeader, Card, Button, FormField, Input, Textarea,
  EmptyState, ErrorState, ConfirmSheet, buttonClasses,
} from "../components/dashboard/ui";

// Keep in sync with testimonialController.FREE_CAP (server is the source of truth;
// this is only for the UI gate — the 409 on create is the real enforcement).
const FREE_CAP = 3;
const emptyForm = { quote: "", author_name: "", author_role: "", author_image_url: "" };

export default function Testimonials() {
  const { user } = useAuth();
  const isFree = isFreePlan(user?.plan);

  const [items, setItems] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null); // id being edited, or null
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await getMyTestimonials();
      setItems(Array.isArray(data) ? data : []);
      setLoadError(null);
    } catch {
      setLoadError("error");
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const atCap = isFree && (items?.length || 0) >= FREE_CAP;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (t) => {
    setEditing(t.id);
    setForm({ quote: t.quote || "", author_name: t.author_name || "", author_role: t.author_role || "", author_image_url: t.author_image_url || "" });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); };

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      quote: form.quote.trim(),
      author_name: form.author_name.trim(),
      author_role: form.author_role.trim() || null,
      author_image_url: form.author_image_url.trim() || null,
    };
    setSaving(true);
    try {
      if (editing) {
        await updateTestimonial(editing, payload);
        toast.success("Testimonial updated");
      } else {
        await createTestimonial(payload);
        toast.success("Testimonial added");
      }
      closeForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save the testimonial");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await deleteTestimonial(confirmDel.id);
      setItems((list) => list.filter((x) => x.id !== confirmDel.id));
      setConfirmDel(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete the testimonial");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Testimonials"
        subtitle="Import praise you already have — WhatsApp messages, DMs, emails — and show it as a proof wall on your public profile. (These are host-provided and never affect your verified review rating.)"
        actions={
          !showForm && items?.length > 0 && !atCap ? (
            <Button variant="primary" onClick={openNew}>
              <Plus className="h-4 w-4" /> Add testimonial
            </Button>
          ) : null
        }
      />

      {loadError === "error" && <ErrorState message="Couldn't load your testimonials." onRetry={load} />}

      {/* Free-tier cap: Pro lock overlay (blur + upgrade CTA). */}
      {atCap && !showForm && (
        <Card padded={false} className="relative mb-5 overflow-hidden p-0">
          <div aria-hidden className="pointer-events-none select-none p-4 blur-[3px]">
            <div className="h-5 w-40 rounded-full bg-ink/10" />
            <div className="mt-3 h-16 rounded-xl bg-ink/5" />
          </div>
          <div className="absolute inset-0 grid place-items-center bg-white/55 p-4 backdrop-blur-[2px]">
            <div className="max-w-sm text-center">
              <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-maroon/10">
                <Lock className="h-5 w-5 text-maroon" />
              </div>
              <h3 className="mb-1 font-display font-bold text-maroon">You've hit the free limit</h3>
              <p className="mb-3 text-sm text-ink/70">
                Free plan shows up to {FREE_CAP} testimonials. Upgrade to Pro for an unlimited proof wall.
              </p>
              <Link to="/dashboard/upgrade?src=testimonials" className={buttonClasses({ variant: "primary" })}>
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </Card>
      )}

      {showForm && (
        <Card padded={false} className="mb-5 p-4">
          <form onSubmit={submit} className="space-y-4">
            <FormField label="Quote" htmlFor="t-quote" required>
              <Textarea id="t-quote" rows={4} value={form.quote} onChange={set("quote")}
                placeholder="“Working with them was the best decision for my brand…”" maxLength={2000} required />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Author name" htmlFor="t-name" required>
                <Input id="t-name" value={form.author_name} onChange={set("author_name")} placeholder="Priya Sharma" maxLength={120} required />
              </FormField>
              <FormField label="Author role" htmlFor="t-role" hint="Optional">
                <Input id="t-role" value={form.author_role} onChange={set("author_role")} placeholder="Founder, Acme Co." maxLength={160} />
              </FormField>
            </div>
            <FormField label="Author photo URL" htmlFor="t-img" hint="Optional">
              <Input id="t-img" type="url" value={form.author_image_url} onChange={set("author_image_url")} placeholder="https://…" />
            </FormField>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add testimonial"}
              </Button>
              <Button type="button" variant="ghost" disabled={saving} onClick={closeForm}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {items === null ? (
        <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
      ) : items.length === 0 && !showForm && loadError !== "error" ? (
        <EmptyState
          icon={Quote}
          title="No testimonials yet"
          description="Add praise you've already received to build a proof wall that lifts bookings."
          action={<Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> Add testimonial</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {(items || []).map((t) => (
            <Card key={t.id} padded={false} className="flex items-start gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-ink">“{t.quote}”</p>
                <div className="mt-1.5 text-xs text-gray-500">
                  <span className="font-semibold text-ink/80">{t.author_name}</span>
                  {t.author_role && ` · ${t.author_role}`}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => openEdit(t)} aria-label="Edit"
                  className="rounded-full p-2 text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setConfirmDel(t)} aria-label="Delete"
                  className="rounded-full p-2 text-ink/50 transition-colors hover:bg-rose/10 hover:text-rose">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmSheet
        open={!!confirmDel}
        title="Delete testimonial?"
        message="This removes it from your proof wall. This can't be undone."
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={doDelete}
        onClose={() => setConfirmDel(null)}
      />
    </div>
  );
}
