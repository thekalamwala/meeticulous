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
  FieldStyle, cn,
} from "../components/dashboard/ui";
import useFeatureFlags from "../hooks/useFeatureFlags";
import {
  KeptPage, KeptHeader, KeptList, KeptRow, RowThumb, RowSwitch, IconAction, KeptEditor, KeptEmpty,
  KeptError, KeptSkeleton, KeptCard, PinnedAction, pinnedBtn, primaryBtn, quietBtn,
} from "./catalog/KeptKit";

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
  const [fetched, setFetched] = useState(false); // first load finished (Kept skeleton)
  // Kept look (dashboard_v2). Same state and handlers; only the shell differs.
  const { flags } = useFeatureFlags();
  const kept = !!flags?.dashboard_v2;

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
    finally { setFetched(true); }
  };
  useEffect(() => { if (on) fetchProgram(); }, [on]);

  if (!on && kept) return (
    <KeptPage pinned={false}>
      <KeptHeader title="Memberships" sub="A monthly fee for ongoing access." />
      <KeptEmpty icon={Lock} title="Memberships are coming soon"
        sub="Turn your attention into recurring revenue with free and paid membership tiers." />
    </KeptPage>
  );
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

  if (kept) {
    const canAddTier = !!program && tiers.length < MAX_TIERS;
    const isLive = program?.status === "live";
    return (
      <KeptPage pinned={canAddTier && !showTier}>
        <KeptHeader title="Memberships"
          sub={!fetched ? "Loading your membership…" : program ? `${program.name} · ${isLive ? "live" : "draft"} · ${tiers.length} of ${MAX_TIERS} tiers` : "One program, up to three tiers. Free and paid, billed monthly."}
          action={canAddTier ? <button type="button" onClick={openAddTier} className={primaryBtn}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add tier</button> : null} />

        {!fetched ? <KeptSkeleton rows={2} /> : loadError && !program ? (
          <KeptError what="membership details" onRetry={fetchProgram} />
        ) : (
          <>
            <KeptCard title={program ? "Your program" : "Start your program"}
              sub={program ? null : "Name it first. You add tiers and go live after."}
              action={program ? (
                <span className={cn("rounded-[8px] px-2.5 py-1 text-[12.5px] font-semibold", isLive ? "bg-pink-50 text-maroon" : "bg-cream text-muted")}>
                  {isLive ? "Live" : "Draft"}
                </span>
              ) : null}>
              <FieldStyle.Provider value="filled">
                <div className="space-y-1">
                  <FormField label="Program name">
                    <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Inner Circle" />
                  </FormField>
                  <FormField label="Blurb" hint="What members get, in a sentence.">
                    <Textarea value={form.blurb} onChange={(e) => setForm((f) => ({ ...f, blurb: e.target.value }))} rows={2} />
                  </FormField>
                </div>
              </FieldStyle.Provider>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={saveProgram} disabled={saving} className={primaryBtn}>{program ? "Save program" : "Create program"}</button>
                {program && (
                  <button type="button" onClick={togglePublish} className={quietBtn}>{isLive ? "Move to draft" : "Go live"}</button>
                )}
              </div>
              {program && !isLive && liveTiers === 0 && (
                <p className="mb-0 mt-3 text-[13.5px] text-muted">Turn on at least one tier, then go live.</p>
              )}
            </KeptCard>

            {program && (
              tiers.length === 0 ? (
                <KeptEmpty icon={Users} title="No tiers yet" sub="Add a free or paid tier to give members something to join."
                  action={<button type="button" onClick={openAddTier} className={primaryBtn}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add a tier</button>} />
              ) : (
                <KeptList label="Tiers" head={<p className="mb-0 mr-auto text-[13.5px] font-semibold text-muted">Tiers · {tiers.length} of {MAX_TIERS}</p>}>
                  {tiers.map((t) => {
                    const perks = Array.isArray(t.perks) ? t.perks : [];
                    return (
                      <KeptRow key={t.id} onOpen={() => openEditTier(t)}
                        thumb={<RowThumb icon={Users} />}
                        title={t.name}
                        detail={perks.length ? perks.join(" · ") : "No perks listed yet"}
                        price={t.type === "free" ? "Free" : `₹${Number(t.price_inr).toLocaleString("en-IN")}/mo`}
                        note={t.type === "free" ? null : "billed monthly"}
                        trailing={(
                          <>
                            <RowSwitch checked={t.status === "live"} onChange={() => toggleTierLive(t)} word={t.status === "live" ? "Live" : "Draft"}
                              label={`${t.status === "live" ? "Move" : "Publish"} ${t.name}${t.status === "live" ? " to draft" : ""}`} />
                            <IconAction danger label={`Delete ${t.name}`} onClick={() => setConfirmDelete(t)} />
                          </>
                        )} />
                    );
                  })}
                </KeptList>
              )
            )}

            {program && members && (
              <KeptCard title="Members"
                action={(
                  <div className="text-right">
                    <p className="mb-0 font-display text-[20px] font-extrabold tabular-nums text-maroon">{members.member_count || 0} active</p>
                    {members.mrr > 0 && <p className="mb-0 text-[13px] text-muted">₹{Number(members.mrr).toLocaleString("en-IN")}/mo</p>}
                  </div>
                )}>
                {(!members.members || members.members.length === 0) ? (
                  <p className="mb-0 text-[14px] text-muted">No one has joined yet. Members show here as they sign up.</p>
                ) : (
                  <ul className="-mx-5 divide-y divide-neutral-200 sm:-mx-6">
                    {members.members.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                        <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-ink">{m.member.name}</span>
                        {m.tier && <span className="shrink-0 truncate rounded-[8px] bg-cream px-2.5 py-1 text-[12.5px] font-semibold text-muted">{m.tier.name}</span>}
                        <StatusBadge status={m.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </KeptCard>
            )}
          </>
        )}

        <KeptEditor open={showTier} onClose={() => setShowTier(false)} formId="tier-form" saving={false}
          title={editingTier ? "Edit tier" : "Add tier"} subtitle={editingTier ? tierForm.name || undefined : "Members pick a tier when they join."}
          saveLabel="Save tier"
          onDelete={editingTier ? () => { setShowTier(false); setConfirmDelete(editingTier); } : undefined}>
          <form id="tier-form" onSubmit={(e) => { e.preventDefault(); submitTier(); }} className="space-y-1">
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
                <Input type="number" inputMode="decimal" min="1" value={tierForm.price_inr}
                  onChange={(e) => setTierForm((f) => ({ ...f, price_inr: e.target.value }))} />
              </FormField>
            )}
            <FormField label="Perks" hint="One per line.">
              <Textarea rows={4} value={tierForm.perks} onChange={(e) => setTierForm((f) => ({ ...f, perks: e.target.value }))} />
            </FormField>
          </form>
        </KeptEditor>

        <ConfirmSheet open={!!confirmDelete} danger title="Delete tier?"
          message={confirmDelete ? `"${confirmDelete.name}" will be removed.` : ""}
          confirmLabel="Delete" onConfirm={removeTier} onClose={() => setConfirmDelete(null)} />

        <PinnedAction show={canAddTier && !showTier}>
          <button type="button" onClick={openAddTier} className={pinnedBtn}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add a tier</button>
        </PinnedAction>
      </KeptPage>
    );
  }

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
