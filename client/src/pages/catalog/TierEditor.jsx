// Add / edit a membership tier on its own route:
//   /dashboard/memberships/tier/add-new     /dashboard/memberships/tier/edit/:id
// A tier = cover image, name, price per month, a description and a perks
// checklist. Rules (server enforces the same): at most 3 tiers, at most 2 paid,
// at most 1 free — so a 3rd tier can only be the free one. A tier's type is
// fixed once created (the API never changes it).
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import {
  getMyMembership, addMembershipTier, updateMembershipTier, deleteMembershipTier,
} from '../../services/api';
import { useFeature } from '../../context/FeatureContext';
import ThumbnailCropper from '../../components/common/ThumbnailCropper';
import { FormField, Input, Textarea, ConfirmSheet, cn } from '../../components/dashboard/ui';
import { EditorPage, EditorSection, KeptError, KeptSkeleton, IconAction, quietBtn } from './KeptKit';

export const MAX_TIERS = 3;
export const MAX_PAID_TIERS = 2;
const MAX_PERKS = 12; // server sanitizePerks cap

/** What a new tier may be, given the tiers that exist. */
export function tierSlots(tiers = []) {
  const paid = tiers.filter((t) => t.type === 'paid').length;
  const free = tiers.filter((t) => t.type === 'free').length;
  const room = tiers.length < MAX_TIERS;
  return { paid: room && paid < MAX_PAID_TIERS, free: room && free < 1 };
}

const emptyForm = (type) => ({ name: '', type, price_inr: '', description: '', cover_url: '', perks: [''] });
const fromTier = (t) => ({
  name: t.name, type: t.type, price_inr: t.price_inr == null ? '' : String(t.price_inr),
  description: t.description || '', cover_url: t.cover_url || '',
  perks: Array.isArray(t.perks) && t.perks.length ? [...t.perks] : [''],
});

export default function TierEditor() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const on = useFeature('community_memberships');
  const back = '/dashboard/memberships';

  const [form, setForm] = useState(null);
  const [slots, setSlots] = useState({ paid: false, free: false });
  const [status, setStatus] = useState('loading'); // loading | ready | missing | full | noProgram | error
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = () => {
    setStatus('loading');
    getMyMembership()
      .then(({ data }) => {
        const program = data?.program;
        if (!program) { setStatus('noProgram'); return; }
        const tiers = program.tiers || [];
        if (isEdit) {
          const hit = tiers.find((t) => String(t.id) === String(id));
          if (!hit) { setStatus('missing'); return; }
          setForm(fromTier(hit)); setStatus('ready'); return;
        }
        const s = tierSlots(tiers);
        setSlots(s);
        if (!s.paid && !s.free) { setStatus('full'); return; }
        setForm(emptyForm(s.paid ? 'paid' : 'free')); setStatus('ready');
      })
      .catch(() => setStatus('error'));
  };
  useEffect(() => { if (on) load(); }, [on, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!on || status === 'noProgram' || status === 'full') return <Navigate to={back} replace />;

  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));
  const setPerk = (i, v) => setForm((s) => ({ ...s, perks: s.perks.map((p, idx) => (idx === i ? v : p)) }));
  const addPerk = () => setForm((s) => ({ ...s, perks: [...s.perks, ''] }));
  const removePerk = (i) => setForm((s) => ({ ...s, perks: s.perks.length > 1 ? s.perks.filter((_, idx) => idx !== i) : [''] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      price_inr: form.type === 'paid' ? Number(form.price_inr) : null,
      perks: form.perks.map((p) => p.trim()).filter(Boolean),
      description: form.description.trim() || null,
      cover_url: form.cover_url || null,
    };
    if (!payload.name) { toast.error('Give the tier a name'); return; }
    if (form.type === 'paid' && !(payload.price_inr > 0)) { toast.error('Set a monthly price for the paid tier'); return; }
    setSaving(true);
    try {
      if (isEdit) await updateMembershipTier(id, payload);
      else await addMembershipTier({ ...payload, type: form.type });
      toast.success(isEdit ? 'Tier saved' : 'Tier added. Turn it on when you are ready.');
      navigate(back);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save tier');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try { await deleteMembershipTier(id); toast.success('Tier deleted'); navigate(back); }
    catch (err) { toast.error(err?.response?.data?.message || 'Could not delete'); }
  };

  const page = (body) => (
    <EditorPage back={back} backLabel="Memberships"
      title={isEdit ? (form?.name.trim() || 'Edit tier') : 'New tier'}
      sub={isEdit ? 'Members see changes as soon as you save.' : 'Members pick a tier when they join. Up to 2 paid tiers, plus 1 free.'}
      formId="tier-form" saving={saving} saveLabel={isEdit ? 'Save changes' : 'Add tier'}
      onCancel={() => navigate(back)} onDelete={isEdit && status === 'ready' ? () => setConfirmDelete(true) : undefined}
      deleteLabel="Delete tier">
      {body}
    </EditorPage>
  );

  if (status === 'loading') return page(<KeptSkeleton rows={4} />);
  if (status === 'error') return page(<KeptError what="membership" onRetry={load} />);
  if (status === 'missing') return page(<KeptError what="tier (it may have been deleted)" onRetry={() => navigate(back)} />);

  const typeBtn = (t, label, enabled) => (
    <button type="button" disabled={!enabled} aria-pressed={form.type === t} onClick={() => set('type', t)}
      className={cn('h-11 flex-1 rounded-[12px] px-4 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none',
        form.type === t ? 'bg-maroon text-white' : 'bg-cream text-muted hover:bg-blush hover:text-maroon')}>
      {label}
    </button>
  );

  return page(<>
    <form id="tier-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
      <EditorSection title="Tier">
        {!isEdit && (
          <div>
            <p className="mb-2 text-[13.5px] font-semibold text-ink">Type</p>
            <div className="flex gap-2">
              {typeBtn('paid', 'Paid', slots.paid)}
              {typeBtn('free', 'Free', slots.free)}
            </div>
            {(!slots.paid || !slots.free) && (
              <p className="mb-0 mt-2 text-[13px] text-muted">
                {!slots.paid ? 'You already have 2 paid tiers, so this one is free.' : 'You already have a free tier.'}
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Name" htmlFor="tier-name" className="mb-0">
            <Input id="tier-name" required maxLength={80} placeholder="e.g. Inner circle" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </FormField>
          {form.type === 'paid' ? (
            <FormField label="Price (₹ / month)" htmlFor="tier-price" className="mb-0">
              <Input id="tier-price" type="number" inputMode="numeric" min={1} required value={form.price_inr} onChange={(e) => set('price_inr', e.target.value)} />
            </FormField>
          ) : (
            <div>
              <p className="mb-1 text-[13.5px] font-semibold text-ink">Price</p>
              <p className="mb-0 text-[14px] text-muted">Free. Anyone signed in can join.</p>
            </div>
          )}
        </div>
        <FormField label="Description" htmlFor="tier-desc" hint="Who this tier is for, in a sentence or two." className="mb-0">
          <Textarea id="tier-desc" rows={3} maxLength={600} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </FormField>
      </EditorSection>

      <EditorSection title="Cover image" sub="16:9. Shown at the top of the tier's card.">
        <ThumbnailCropper value={form.cover_url} onChange={(url) => set('cover_url', url)} folder="covers" />
      </EditorSection>

      <EditorSection title="Perks" sub="What members of this tier get. Shown as a checklist.">
        <ul className="flex flex-col gap-2">
          {form.perks.map((p, i) => (
            <li key={i} className="flex items-center gap-1">
              <Input aria-label={`Perk ${i + 1}`} maxLength={200} placeholder="e.g. Monthly group call" value={p} onChange={(e) => setPerk(i, e.target.value)} />
              <IconAction icon={X} label={`Remove perk ${i + 1}`} onClick={() => removePerk(i)} />
            </li>
          ))}
        </ul>
        {form.perks.length < MAX_PERKS && (
          <button type="button" onClick={addPerk} className={quietBtn}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add perk</button>
        )}
      </EditorSection>
    </form>
    <ConfirmSheet open={confirmDelete} danger title="Delete tier?"
      message={`"${form.name}" will be removed.`} confirmLabel="Delete" onConfirm={doDelete} onClose={() => setConfirmDelete(false)} />
  </>);
}
