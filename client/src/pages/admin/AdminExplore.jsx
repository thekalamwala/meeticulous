/**
 * AdminExplore.jsx
 * Manage all Explore page revenue placements.
 * Tabs: Featured Slots | Sponsored Keywords | Collections | Boosts | Verified Badges
 */
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Ic from '../../components/admin/Ic';
import { IC } from '../../components/admin/adminNav';
import { Btn, PageHeader } from '../../components/admin/ui';
import {
  adminGetExploreFeatured, adminCreateExploreFeatured, adminDeleteExploreFeatured,
  adminGetExploreCollections, adminCreateExploreCollection, adminUpdateExploreCollection,
  adminAddToExploreCollection, adminRemoveFromExploreCollection,
  adminGetExploreBoosts, adminCreateExploreBoost, adminRevokeExploreBoost,
  adminGetExploreVerified, adminGrantExploreVerified, adminRevokeExploreVerified,
  adminGetExploreKeywords, adminCreateExploreKeyword, adminRevokeExploreKeyword,
} from '../../services/api';

// ── Shared empty-state ────────────────────────────────────────
const Empty = ({ label }) => (
  <div className="text-center py-12 border-2 border-dashed adm-border rounded-2xl">
    <p className="adm-t3 text-sm font-medium">{label}</p>
  </div>
);

// ── Shared section card ───────────────────────────────────────
const Section = ({ children }) => (
  <div className="adm-card rounded-2xl p-6 space-y-4">
    {children}
  </div>
);

const Input = ({ label, ...props }) => (
  <label className="block">
    <span className="text-xs font-bold adm-t1 uppercase tracking-wide mb-1 block">{label}</span>
    <input className="w-full border-2 adm-border rounded-lg px-3 py-2 text-sm font-medium
                      adm-card outline-none focus:border-[#2E1065] transition-colors" {...props} />
  </label>
);

// ── TAB: Featured Slots ───────────────────────────────────────
function FeaturedTab() {
  const [slots, setSlots]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({ vendor_id: '', slot_position: 1, starts_at: '', ends_at: '', price_paid: '', notes: '' });
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGetExploreFeatured();
      setSlots(res.data.slots || []);
    } catch { toast.error('Failed to load featured slots'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.vendor_id || !form.starts_at || !form.ends_at) return toast.error('Fill all required fields');
    setSaving(true);
    try {
      await adminCreateExploreFeatured(form);
      toast.success('Featured slot created');
      setForm({ vendor_id: '', slot_position: 1, starts_at: '', ends_at: '', price_paid: '', notes: '' });
      load();
    } catch { toast.error('Failed to create slot'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Remove this featured slot?')) return;
    try { await adminDeleteExploreFeatured(id); toast.success('Removed'); load(); }
    catch { toast.error('Failed to remove'); }
  };

  return (
    <div className="space-y-6">
      <Section>
        <h3 className="font-bold adm-t1 flex items-center gap-2"><Ic d={IC.star} size={16} className="text-[#2E1065]" /> Add Featured Slot</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Host ID *" value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))} placeholder="profiles.id (UUID)" />
          <div>
            <span className="text-xs font-bold adm-t1 uppercase tracking-wide mb-1 block">Slot Position (1–5) *</span>
            <select value={form.slot_position} onChange={e => setForm(f => ({ ...f, slot_position: Number(e.target.value) }))}
              className="w-full border-2 adm-border rounded-lg px-3 py-2 text-sm font-medium adm-card outline-none">
              {[1,2,3,4,5].map(n => <option key={n} value={n}>Slot {n}</option>)}
            </select>
          </div>
          <Input label="Starts at *" type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
          <Input label="Ends at *"   type="datetime-local" value={form.ends_at}   onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
          <Input label="Price paid (₹)" type="number" value={form.price_paid} onChange={e => setForm(f => ({ ...f, price_paid: e.target.value }))} />
          <Input label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <Btn onClick={create} disabled={saving} icon={IC.plus}>{saving ? 'Saving…' : 'Add Slot'}</Btn>
      </Section>

      <Section>
        <h3 className="font-bold adm-t1">Active Featured Slots ({slots.length})</h3>
        {loading ? <p className="text-sm adm-t3">Loading…</p> : slots.length === 0 ? <Empty label="No featured slots yet" /> : (
          <div className="space-y-2">
            {slots.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 border-2 adm-border rounded-lg adm-chip">
                <div>
                  <p className="font-bold text-sm adm-t1">Slot {s.slot_position} — {s.profiles?.name || s.vendor_id}</p>
                  <p className="text-xs adm-t3">{new Date(s.starts_at).toLocaleDateString()} → {new Date(s.ends_at).toLocaleDateString()} · ₹{s.price_paid}</p>
                </div>
                <Btn variant="danger" size="sm" onClick={() => remove(s.id)} icon={IC.trash} />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── TAB: Sponsored Keywords ───────────────────────────────────
function KeywordsTab() {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState({ vendor_id: '', keyword: '', bid_amount: '', starts_at: '', ends_at: '' });
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await adminGetExploreKeywords(); setKeywords(r.data.keywords || []); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.vendor_id || !form.keyword || !form.starts_at || !form.ends_at) return toast.error('Fill all fields');
    setSaving(true);
    try { await adminCreateExploreKeyword(form); toast.success('Keyword created'); setForm({ vendor_id: '', keyword: '', bid_amount: '', starts_at: '', ends_at: '' }); load(); }
    catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const revoke = async (id) => {
    try { await adminRevokeExploreKeyword(id); toast.success('Revoked'); load(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <Section>
        <h3 className="font-bold adm-t1 flex items-center gap-2"><Ic d={IC.tag} size={16} className="text-[#2E1065]" /> Add Sponsored Keyword</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Host ID *" value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))} />
          <Input label="Keyword / Category slug *" value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} placeholder="e.g. yoga, fitness" />
          <Input label="Bid amount (₹) *" type="number" value={form.bid_amount} onChange={e => setForm(f => ({ ...f, bid_amount: e.target.value }))} />
          <div />
          <Input label="Starts at *" type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
          <Input label="Ends at *"   type="datetime-local" value={form.ends_at}   onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
        </div>
        <Btn onClick={create} disabled={saving} icon={IC.plus}>{saving ? 'Saving…' : 'Add Keyword'}</Btn>
      </Section>
      <Section>
        <h3 className="font-bold adm-t1">Active Sponsorships ({keywords.length})</h3>
        {loading ? <p className="text-sm adm-t3">Loading…</p> : keywords.length === 0 ? <Empty label="No sponsored keywords yet" /> : (
          <div className="space-y-2">
            {keywords.map(k => (
              <div key={k.id} className="flex items-center justify-between p-3 border-2 adm-border rounded-lg">
                <div>
                  <p className="font-bold text-sm adm-t1">"{k.keyword}" → {k.profiles?.name || k.vendor_id}</p>
                  <p className="text-xs adm-t3">₹{k.bid_amount}/period · until {new Date(k.ends_at).toLocaleDateString()}</p>
                </div>
                <Btn variant="danger" size="sm" onClick={() => revoke(k.id)} icon={IC.trash} />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── TAB: Collections ──────────────────────────────────────────
function CollectionsTab() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [form, setForm]               = useState({ title: '', subtitle: '', slug: '', icon_emoji: '✨', is_paid: false });
  const [saving, setSaving]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await adminGetExploreCollections(); setCollections(r.data.collections || []); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.title || !form.slug) return toast.error('Title and slug are required');
    setSaving(true);
    try { await adminCreateExploreCollection(form); toast.success('Collection created'); setForm({ title: '', subtitle: '', slug: '', icon_emoji: '✨', is_paid: false }); load(); }
    catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const toggle = async (col) => {
    try { await adminUpdateExploreCollection(col.id, { is_active: !col.is_active }); load(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <Section>
        <h3 className="font-bold adm-t1 flex items-center gap-2"><Ic d={IC.bookmark} size={16} className="text-[#2E1065]" /> New Collection</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Input label="Slug *"  value={form.slug}  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}  placeholder="e.g. top-picks" />
          <Input label="Subtitle" value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
          <Input label="Icon emoji" value={form.icon_emoji} onChange={e => setForm(f => ({ ...f, icon_emoji: e.target.value }))} />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <input type="checkbox" checked={form.is_paid} onChange={e => setForm(f => ({ ...f, is_paid: e.target.checked }))} className="accent-[#2E1065]" />
          Paid collection (hosts paid to be included)
        </label>
        <Btn onClick={create} disabled={saving} icon={IC.plus}>{saving ? 'Saving…' : 'Create Collection'}</Btn>
      </Section>
      <Section>
        <h3 className="font-bold adm-t1">Collections ({collections.length})</h3>
        {loading ? <p className="text-sm adm-t3">Loading…</p> : collections.length === 0 ? <Empty label="No collections yet" /> : (
          <div className="space-y-3">
            {collections.map(col => (
              <div key={col.id} className="border-2 adm-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm adm-t1">{col.icon_emoji} {col.title} {col.is_paid && <span className="text-[10px] bg-[#2E1065] text-white px-1.5 py-0.5 rounded ml-1">Paid</span>}</p>
                    <p className="text-xs adm-t3">{col.subtitle} · {(col.explore_collection_vendors || []).length} hosts</p>
                  </div>
                  <Btn variant={col.is_active ? 'ghost' : 'primary'} size="sm" onClick={() => toggle(col)}>
                    {col.is_active ? 'Deactivate' : 'Activate'}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── TAB: Boosts ───────────────────────────────────────────────
function BoostsTab() {
  const [boosts, setBoosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({ vendor_id: '', boost_type: 'standard', starts_at: '', ends_at: '', price_paid: '' });
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await adminGetExploreBoosts(); setBoosts(r.data.boosts || []); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.vendor_id || !form.starts_at || !form.ends_at) return toast.error('Fill all fields');
    setSaving(true);
    try { await adminCreateExploreBoost(form); toast.success('Boost created'); setForm({ vendor_id: '', boost_type: 'standard', starts_at: '', ends_at: '', price_paid: '' }); load(); }
    catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const revoke = async (id) => {
    try { await adminRevokeExploreBoost(id); toast.success('Boost revoked'); load(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <Section>
        <h3 className="font-bold adm-t1 flex items-center gap-2"><Ic d={IC.zap} size={16} className="text-[#FFB703]" /> Add Boost</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Host ID *" value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))} />
          <div>
            <span className="text-xs font-bold adm-t1 uppercase tracking-wide mb-1 block">Boost Type *</span>
            <select value={form.boost_type} onChange={e => setForm(f => ({ ...f, boost_type: e.target.value }))}
              className="w-full border-2 adm-border rounded-lg px-3 py-2 text-sm font-medium adm-card outline-none">
              <option value="standard">Standard (1.5×)</option>
              <option value="premium">Premium (2.5×)</option>
            </select>
          </div>
          <Input label="Starts at *" type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
          <Input label="Ends at *"   type="datetime-local" value={form.ends_at}   onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
          <Input label="Price paid (₹)" type="number" value={form.price_paid} onChange={e => setForm(f => ({ ...f, price_paid: e.target.value }))} />
        </div>
        <Btn onClick={create} disabled={saving} icon={IC.plus}>{saving ? 'Saving…' : 'Add Boost'}</Btn>
      </Section>
      <Section>
        <h3 className="font-bold adm-t1">Active Boosts ({boosts.length})</h3>
        {loading ? <p className="text-sm adm-t3">Loading…</p> : boosts.length === 0 ? <Empty label="No active boosts" /> : (
          <div className="space-y-2">
            {boosts.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 border-2 adm-border rounded-lg">
                <div>
                  <p className="font-bold text-sm adm-t1">{b.profiles?.name || b.vendor_id} · {b.boost_type === 'premium' ? '2.5×' : '1.5×'}</p>
                  <p className="text-xs adm-t3">until {new Date(b.ends_at).toLocaleDateString()} · ₹{b.price_paid}</p>
                </div>
                <Btn variant="danger" size="sm" onClick={() => revoke(b.id)} icon={IC.trash} />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── TAB: Verified Badges ──────────────────────────────────────
function VerifiedTab() {
  const [verified, setVerified] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState({ vendor_id: '', expires_at: '', price_paid: '' });
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await adminGetExploreVerified(); setVerified(r.data.verified || []); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const grant = async () => {
    if (!form.vendor_id) return toast.error('Host ID required');
    setSaving(true);
    try { await adminGrantExploreVerified(form); toast.success('Badge granted'); setForm({ vendor_id: '', expires_at: '', price_paid: '' }); load(); }
    catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const revoke = async (id) => {
    try { await adminRevokeExploreVerified(id); toast.success('Badge revoked'); load(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <Section>
        <h3 className="font-bold adm-t1 flex items-center gap-2"><Ic d={IC.badgeCheck} size={16} className="text-[#2E1065]" /> Grant Verified Badge</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Host ID *" value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))} />
          <Input label="Expires at (leave blank = never)" type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
          <Input label="Price paid (₹)" type="number" value={form.price_paid} onChange={e => setForm(f => ({ ...f, price_paid: e.target.value }))} />
        </div>
        <Btn onClick={grant} disabled={saving} icon={IC.checkCircle}>{saving ? 'Saving…' : 'Grant Badge'}</Btn>
      </Section>
      <Section>
        <h3 className="font-bold adm-t1">Verified Hosts ({verified.length})</h3>
        {loading ? <p className="text-sm adm-t3">Loading…</p> : verified.length === 0 ? <Empty label="No verified hosts yet" /> : (
          <div className="space-y-2">
            {verified.map(v => (
              <div key={v.id} className="flex items-center justify-between p-3 border-2 adm-border rounded-lg">
                <div className="flex items-center gap-2">
                  <Ic d={IC.badgeCheck} size={16} className="text-[#2E1065]" />
                  <div>
                    <p className="font-bold text-sm adm-t1">{v.profiles?.name || v.vendor_id}</p>
                    <p className="text-xs adm-t3">
                      {v.expires_at ? `Expires ${new Date(v.expires_at).toLocaleDateString()}` : 'Never expires'} · ₹{v.price_paid}
                    </p>
                  </div>
                </div>
                <Btn variant="danger" size="sm" onClick={() => revoke(v.id)} icon={IC.trash} />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
const TABS = [
  { key: 'featured',    label: 'Featured Slots',       icon: IC.star },
  { key: 'keywords',   label: 'Sponsored Keywords',   icon: IC.tag },
  { key: 'collections',label: 'Collections',          icon: IC.bookmark },
  { key: 'boosts',     label: 'Boosts',               icon: IC.zap },
  { key: 'verified',   label: 'Verified Badges',      icon: IC.badgeCheck },
];

export default function AdminExplore() {
  const [tab, setTab] = useState('featured');

  return (
    <div className="space-y-6">
      <PageHeader title="Explore Page" subtitle="Manage paid placements and revenue features on the public Explore page." />

      {/* Not-live warning. The public reads for these placements are stubs today —
          exploreController getFeatured/getCollections/getSponsored return []. So
          Featured Slots, Sponsored Keywords and Collections created here do NOT
          render on the public site yet. Remove this banner when those reads ship. */}
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
        ⚠️ Featured Slots, Sponsored Keywords and Collections don’t render on the public Explore page yet
        (their public endpoints return empty). Don’t sell these placements until the public reads are wired.
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-2 border-b-2 adm-border pb-0">
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-2 border-b-0 rounded-t-lg
                          transition-colors
                          ${active
                            ? 'adm-card adm-border text-[#2E1065]'
                            : 'adm-chip border-transparent adm-t3 hover:text-[color:var(--adm-text-1)]'
                          }`}
            >
              <Ic d={t.icon} size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'featured'     && <FeaturedTab />}
        {tab === 'keywords'    && <KeywordsTab />}
        {tab === 'collections' && <CollectionsTab />}
        {tab === 'boosts'      && <BoostsTab />}
        {tab === 'verified'    && <VerifiedTab />}
      </div>
    </div>
  );
}
