import { useState, useEffect } from "react";
import {
  getMyMembership, saveMembership, publishMembership,
  addMembershipTier, updateMembershipTier, deleteMembershipTier, getHostMembers,
} from "../services/api";
import { useFeature } from "../context/FeatureContext";
import BackButton from "../components/common/BackButton";
import { Plus, Trash2, Lock, Users } from "lucide-react";
import toast from "react-hot-toast";
import {
  PageHeader, Card, Button, FormField, Input, Textarea, Select, Sheet,
  Badge, StatusBadge, EmptyState, ErrorState, ConfirmSheet,
} from "../components/dashboard/ui";

const MAX_TIERS = 3;
const emptyTier = { name: "", type: "paid", price_inr: "", perks: "" };

const perksToText = (perks) => (Array.isArray(perks) ? perks.join("\n") : "");
const textToPerks = (t) => String(t || "").split("\n").map((s) => s.trim()).filter(Boolean);

export default function Memberships() {
  const on = useFeature("community_memberships");
  const [program, setProgram] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState({ name: "", blurb: "", cover_url: "" });
  const [tierForm, setTierForm] = useState(emptyTier);
  const [editingTier, setEditingTier] = useState(null);
  const [showTier, setShowTier] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState(null);

  const fetchProgram = async () => {
    setLoadError(false);
    try {
      const { data } = await getMyMembership();
      setProgram(data.program || null);
      if (data.program) {
        setForm({ name: data.program.name, blurb: data.program.blurb || "", cover_url: data.program.cover_url || "" });
        getHostMembers().then(({ data: m }) => setMembers(m)).catch(() => {});
      }
    } catch { setLoadError(true); }
  };
  useEffect(() => { if (on) fetchProgram(); }, [on]);

  if (!on) return (
    <div className="mx-auto max-w-2xl p-4">
      <BackButton />
      <EmptyState icon={Lock} title="Memberships are coming soon"
        description="Turn your attention into recurring revenue with free and paid membership tiers." />
    </div>
  );

  const tiers = program?.tiers || [];
  const liveTiers = tiers.filter((t) => t.status === "live").length;

  const saveProgram = async () => {
    if (!form.name.trim()) return toast.error("Give your membership a name");
    setSaving(true);
    try {
      const { data } = await saveMembership(form);
      setProgram(data.program);
      toast.success("Saved");
    } catch (e) { toast.error(e?.response?.data?.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const togglePublish = async () => {
    const goLive = program?.status !== "live";
    try {
      const { data } = await publishMembership(goLive);
      setProgram((p) => ({ ...p, status: data.program.status }));
      toast.success(goLive ? "Membership is live" : "Moved to draft");
    } catch (e) { toast.error(e?.response?.data?.message || "Could not update"); }
  };

  const openAddTier = () => { setTierForm(emptyTier); setEditingTier(null); setShowTier(true); };
  const openEditTier = (t) => {
    setTierForm({ name: t.name, type: t.type, price_inr: t.price_inr == null ? "" : String(t.price_inr), perks: perksToText(t.perks) });
    setEditingTier(t); setShowTier(true);
  };

  const submitTier = async () => {
    const payload = {
      name: tierForm.name, type: tierForm.type,
      price_inr: tierForm.type === "paid" ? Number(tierForm.price_inr) : null,
      perks: textToPerks(tierForm.perks),
    };
    if (!payload.name.trim()) return toast.error("Tier name required");
    if (payload.type === "paid" && !(payload.price_inr > 0)) return toast.error("Set a price for the paid tier");
    try {
      if (editingTier) await updateMembershipTier(editingTier.id, payload);
      else await addMembershipTier(payload);
      setShowTier(false);
      await fetchProgram();
    } catch (e) { toast.error(e?.response?.data?.message || "Could not save tier"); }
  };

  const toggleTierLive = async (t) => {
    try { await updateMembershipTier(t.id, { status: t.status === "live" ? "draft" : "live" }); await fetchProgram(); }
    catch (e) { toast.error(e?.response?.data?.message || "Could not update tier"); }
  };

  const removeTier = async () => {
    try { await deleteMembershipTier(confirmDelete.id); setConfirmDelete(null); await fetchProgram(); }
    catch (e) { toast.error(e?.response?.data?.message || "Could not delete"); }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      <BackButton />
      <PageHeader title="Memberships" subtitle="Run one program with up to three tiers. Free and paid." />

      {loadError && <ErrorState onRetry={fetchProgram} />}

      <Card className="space-y-3">
        <FormField label="Program name">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Inner Circle" />
        </FormField>
        <FormField label="Blurb" hint="What members get, in a sentence.">
          <Textarea value={form.blurb} onChange={(e) => setForm((f) => ({ ...f, blurb: e.target.value }))} rows={2} />
        </FormField>
        <div className="flex items-center justify-between gap-2">
          <Button onClick={saveProgram} disabled={saving}>{program ? "Save program" : "Create program"}</Button>
          {program && (
            <div className="flex items-center gap-2">
              <StatusBadge status={program.status} />
              <Button variant="secondary" onClick={togglePublish}>
                {program.status === "live" ? "Unpublish" : "Publish"}
              </Button>
            </div>
          )}
        </div>
        {program && program.status !== "live" && liveTiers === 0 && (
          <p className="text-sm text-ink/60">Publish at least one tier, then go live.</p>
        )}
      </Card>

      {program && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">Tiers <span className="text-ink/50 text-sm">({tiers.length}/{MAX_TIERS})</span></h3>
            {tiers.length < MAX_TIERS && (
              <Button variant="secondary" onClick={openAddTier}><Plus size={16} /> Add tier</Button>
            )}
          </div>

          {tiers.length === 0 && (
            <EmptyState icon={Users} title="No tiers yet" description="Add a free or paid tier to give members something to join." />
          )}

          {tiers.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-ink/10 p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  <Badge>{t.type === "free" ? "Free" : `₹${t.price_inr}/mo`}</Badge>
                  <StatusBadge status={t.status} />
                </div>
                {Array.isArray(t.perks) && t.perks.length > 0 && (
                  <ul className="mt-1 text-sm text-ink/60 list-disc pl-4">{t.perks.map((p, i) => <li key={i}>{p}</li>)}</ul>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => toggleTierLive(t)}>{t.status === "live" ? "Unpublish" : "Publish"}</Button>
                <Button variant="ghost" onClick={() => openEditTier(t)}>Edit</Button>
                <button onClick={() => setConfirmDelete(t)} className="text-ink/40 hover:text-maroon" aria-label="Delete tier"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {program && members && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">Members</h3>
            <div className="text-right text-sm">
              <div className="font-semibold text-maroon">{members.member_count || 0} active</div>
              {members.mrr > 0 && <div className="text-ink/60">₹{members.mrr}/mo</div>}
            </div>
          </div>
          {(!members.members || members.members.length === 0) ? (
            <p className="text-sm text-ink/60">No members yet.</p>
          ) : (
            <ul className="divide-y divide-ink/5">
              {members.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <span className="text-sm">{m.member.name}</span>
                  <span className="flex items-center gap-2">
                    {m.tier && <Badge>{m.tier.name}</Badge>}
                    <StatusBadge status={m.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Sheet open={showTier} onClose={() => setShowTier(false)} title={editingTier ? "Edit tier" : "Add tier"}>
        <div className="space-y-3 px-2 pb-2">
          <FormField label="Tier name">
            <Input value={tierForm.name} onChange={(e) => setTierForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Premium" />
          </FormField>
          <FormField label="Type">
            <Select value={tierForm.type} onChange={(e) => setTierForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="paid">Paid</option>
              <option value="free">Free</option>
            </Select>
          </FormField>
          {tierForm.type === "paid" && (
            <FormField label="Price (₹ / month)">
              <Input type="number" min="1" value={tierForm.price_inr}
                onChange={(e) => setTierForm((f) => ({ ...f, price_inr: e.target.value }))} />
            </FormField>
          )}
          <FormField label="Perks" hint="One per line.">
            <Textarea rows={3} value={tierForm.perks} onChange={(e) => setTierForm((f) => ({ ...f, perks: e.target.value }))} />
          </FormField>
          <Button full size="lg" onClick={submitTier}>Save tier</Button>
        </div>
      </Sheet>

      <ConfirmSheet open={!!confirmDelete} danger title="Delete tier?"
        message={confirmDelete ? `"${confirmDelete.name}" will be removed.` : ""}
        confirmLabel="Delete" onConfirm={removeTier} onClose={() => setConfirmDelete(null)} />
    </div>
  );
}
