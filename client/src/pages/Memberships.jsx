import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMyMembership, saveMembership, publishMembership,
  updateMembershipTier, deleteMembershipTier, getHostMembers,
} from "../services/api";
import { useFeature } from "../context/FeatureContext";
import BackButton from "../components/common/BackButton";
import { Plus, Trash2, Lock, Users, Check } from "lucide-react";
import toast from "react-hot-toast";
import {
  PageHeader, Card, Button, FormField, Input, Textarea,
  Badge, StatusBadge, EmptyState, ErrorState, ConfirmSheet,
  FieldStyle, cn,
} from "../components/dashboard/ui";
import useFeatureFlags from "../hooks/useFeatureFlags";
import {
  KeptPage, KeptHeader, CardGrid, PhotoCard, CardSwitch, KeptEmpty,
  KeptError, KeptSkeleton, KeptCard, PinnedAction, pinnedBtn, primaryBtn, quietBtn,
} from "./catalog/KeptKit";
import { MAX_TIERS, tierSlots } from "./catalog/TierEditor";

// Tiers are added and edited on their own routes (catalog/TierEditor).
const ADD_TIER = "/dashboard/memberships/tier/add-new";
const editTierPath = (t) => `/dashboard/memberships/tier/edit/${t.id}`;

export default function Memberships() {
  const on = useFeature("community_memberships");
  const navigate = useNavigate();
  const [program, setProgram] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState({ name: "", blurb: "", cover_url: "" });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
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
  const slots = tierSlots(tiers);
  const canAddTier = !!program && (slots.paid || slots.free);
  const openAddTier = () => navigate(ADD_TIER);
  const openEditTier = (t) => navigate(editTierPath(t));

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
    setPublishing(true);
    try {
      const { data } = await publishMembership(goLive);
      setProgram((p) => ({ ...p, status: data.program.status }));
      toast.success(goLive ? "Membership is live" : "Moved to draft");
    } catch (e) { toast.error(e?.response?.data?.message || "Could not update"); }
    finally { setPublishing(false); }
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
    const isLive = program?.status === "live";
    return (
      <KeptPage pinned={canAddTier}>
        <KeptHeader title="Memberships"
          sub={!fetched ? "Loading your membership…" : program ? `${program.name} · ${isLive ? "live" : "draft"} · ${tiers.length} of ${MAX_TIERS} tiers` : "One program: up to 2 paid tiers and 1 free, billed monthly."}
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
                <button type="button" onClick={saveProgram} disabled={saving} className={primaryBtn}>{saving ? "Saving…" : program ? "Save program" : "Create program"}</button>
                {program && (
                  <button type="button" onClick={togglePublish} disabled={publishing} className={quietBtn}>{isLive ? "Move to draft" : "Go live"}</button>
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
                <section aria-label="Tiers" className="flex flex-col gap-3">
                  <p className="mb-0 text-[13.5px] font-semibold text-muted">Tiers · {tiers.length} of {MAX_TIERS} · up to 2 paid and 1 free</p>
                  <CardGrid label="Your tiers">
                    {tiers.map((t) => {
                      const perks = Array.isArray(t.perks) ? t.perks : [];
                      return (
                        <PhotoCard key={t.id} onOpen={() => openEditTier(t)} image={t.cover_url} icon={Users}
                          eyebrow={t.type === "free" ? "Free tier" : "Paid tier"}
                          title={t.name}
                          price={t.type === "free" ? "Free" : `₹${Number(t.price_inr).toLocaleString("en-IN")}/mo`}
                          footer={<CardSwitch checked={t.status === "live"} onChange={() => toggleTierLive(t)} word={t.status === "live" ? "Live" : "Draft"}
                            label={`${t.status === "live" ? "Move" : "Publish"} ${t.name}${t.status === "live" ? " to draft" : ""}`} />}>
                          {t.description && <span className="mt-1 line-clamp-2 text-[13.5px] text-muted">{t.description}</span>}
                          {perks.length > 0 ? (
                            <span className="mt-3 flex flex-col gap-1.5">
                              {perks.map((pk, i) => (
                                <span key={i} className="flex items-start gap-2 text-[13.5px] text-ink">
                                  <span aria-hidden="true" className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-pink-50 text-maroon"><Check className="h-3 w-3" strokeWidth={3} /></span>
                                  <span className="min-w-0">{pk}</span>
                                </span>
                              ))}
                            </span>
                          ) : <span className="mt-3 text-[13px] text-faint">No perks listed yet</span>}
                        </PhotoCard>
                      );
                    })}
                  </CardGrid>
                </section>
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

        <PinnedAction show={canAddTier}>
          <button type="button" onClick={openAddTier} className={pinnedBtn}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add a tier</button>
        </PinnedAction>
      </KeptPage>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      <BackButton />
      <PageHeader title="Memberships" subtitle="Run one program: up to 2 paid tiers and 1 free." />

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
              <Button variant="secondary" onClick={togglePublish} disabled={publishing}>
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
            {canAddTier && (
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

      <ConfirmSheet open={!!confirmDelete} danger title="Delete tier?"
        message={confirmDelete ? `"${confirmDelete.name}" will be removed.` : ""}
        confirmLabel="Delete" onConfirm={removeTier} onClose={() => setConfirmDelete(null)} />
    </div>
  );
}
