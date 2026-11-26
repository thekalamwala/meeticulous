// Settings → Account (Kept). Account-only fields, founder call 2026-11-26:
// name, birthday (private), how you sign in, your link, the booking rules
// (guest reschedule fee, Google Maps link for in-person) and discovery (listed /
// hidden, search keywords). Search keywords and the Maps link have no home in
// Grow's Your page (agreed with the Grow session), so they live here. How the PAGE looks (photo, cover, bio,
// social, colours, categories) lives in Grow → Your page.
//
// Saves go through the same PUT /host/profile as before, sending ONLY the fields
// shown here (the endpoint updates what it is given), so nothing on Your page can
// be overwritten from this screen.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Mail, Phone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile } from '../../services/api';
import { fieldError } from '../../utils/apiError';
import UsernameField from '../../components/dashboard/UsernameField';
import { Button, Select } from '../../components/dashboard/ui';
import { Panel } from '../../components/dashboard/ui/v2';
import { cn } from '../../components/dashboard/ui/cn';
import SettingsShell, { EASE, useIsDesktop } from './SettingsShell';

const pick = (u) => ({
  name: u?.name || '',
  date_of_birth: u?.date_of_birth ? String(u.date_of_birth).slice(0, 10) : '',
  reschedule_fee: Number(u?.reschedule_fee ?? 0),
  map_link: u?.map_link || '',
  is_indexable: u?.is_indexable !== false,
  tagline: u?.tagline || '', // NOT a public tagline: "Search keywords" (discovery)
});

const Label = ({ htmlFor, children, hint }) => (
  <div className="mb-1.5">
    <label htmlFor={htmlFor} className="block text-[13.5px] font-semibold text-ink lg:text-[14px]">{children}</label>
    {hint && <p className="mb-0 mt-0.5 text-[12.5px] text-muted lg:text-[13px]">{hint}</p>}
  </div>
);

/* A read-only fact row inside a card: icon chip · what it is · the value. */
const Fact = ({ icon: Icon, label, value, missing }) => (
  <li className="flex min-h-[52px] items-center gap-3 py-2">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-blush text-maroon"><Icon className="h-[18px] w-[18px]" strokeWidth={1.9} /></span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[12.5px] text-muted lg:text-[13px]">{label}</span>
      <span className={cn('block truncate text-[14px] lg:text-[15px]', value ? 'font-medium text-ink' : 'text-muted')}>{value || missing}</span>
    </span>
  </li>
);

/* A whole-row switch: the row is the tap target (≥56px), the track is drawn
 * inside it. 44×26 track, 20px knob travelling 18px, so it never leaves its track. */
export const SwitchRow = ({ checked, onChange, label, detail }) => (
  <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
    className="-mx-2 flex min-h-[56px] w-[calc(100%+1rem)] items-center gap-4 rounded-[12px] px-2 py-2 text-left transition-colors hover:bg-pink-50 active:bg-blush focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
    <span className="min-w-0 flex-1">
      <span className="block text-[13.5px] font-semibold text-ink lg:text-[14px]">{label}</span>
      {detail && <span className="mt-0.5 block text-[12.5px] text-muted lg:text-[13px]">{detail}</span>}
    </span>
    <span aria-hidden="true" className={cn('relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-200',
      checked ? 'bg-maroon' : 'bg-neutral-300')}>
      <span className={cn('absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow-[var(--shadow-sm)] transition-transform duration-200 ease-out motion-reduce:transition-none',
        checked && 'translate-x-[18px]')} />
    </span>
  </button>
);

/* Pinned save. Portaled to <body> so it sits OUTSIDE PullToRefresh (whose
 * transform would trap position:fixed) and floats above KeptTabBar's raised Grow
 * button on phones (77px bar + 28px rise + a gap). Desktop: bottom of the window. */
export const SaveBar = ({ show, saving, onSave, onDiscard }) => {
  const reduce = useReducedMotion();
  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div key="save" role="region" aria-label="Unsaved changes"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }} transition={{ duration: 0.2, ease: EASE }}
          className="dash fixed inset-x-3 bottom-[calc(116px+env(safe-area-inset-bottom,0px))] z-[60] mx-auto flex max-w-[560px] items-center gap-2 rounded-[20px] bg-white p-2.5 pl-4 shadow-[var(--shadow-lg)] lg:bottom-6 lg:left-[calc(232px+2rem)] lg:right-8 lg:mx-0 lg:max-w-[760px]">
          <p className="mb-0 min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">Unsaved changes</p>
          <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>Discard</Button>
          <Button type="button" size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default function AccountPane({ root = false }) {
  const { user, updateUser } = useAuth();
  const desktop = useIsDesktop();
  const base = useMemo(() => pick(user), [user]);
  const [form, setForm] = useState(base);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(base), [base]);

  const dirty = Object.keys(base).some((k) => form[k] !== base[k]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // Same unsaved-changes guard the old page had: a refresh with edits pending warns.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async () => {
    if (!form.name.trim()) { toast.error('Please add your name.'); return; }
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.keys(base).filter((k) => form[k] !== base[k]).map((k) => [k, form[k]]));
      const { data } = await updateProfile(payload);
      updateUser({ ...user, ...(data && typeof data === 'object' && !data.preview ? data : payload), token: user.token, refresh_token: user.refresh_token });
      toast.success('Saved');
    } catch (err) {
      toast.error(fieldError(err, 'Could not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  // Phone root list: the shell renders it; nothing of this pane mounts.
  if (root && !desktop) return <SettingsShell pane="account" root />;

  return (
    <SettingsShell pane="account" sub="Who you are to us, and your rules for guests.">
      <Panel title="You">
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="acct-name">Name</Label>
            <div className="mt-input"><input id="acct-name" type="text" autoComplete="name" autoCapitalize="words" maxLength={80}
              value={form.name} onChange={(e) => set('name')(e.target.value)} /></div>
          </div>
          <div>
            <Label htmlFor="acct-dob" hint="Only used to wish you on the day. Never shown to guests.">Birthday</Label>
            <div className="mt-input sm:max-w-[260px]"><input id="acct-dob" type="date" autoComplete="bday"
              value={form.date_of_birth} onChange={(e) => set('date_of_birth')(e.target.value)} /></div>
          </div>
        </div>
      </Panel>

      <Panel title="How you sign in" subtitle="With Google or LinkedIn. There is no password to manage.">
        <ul className="mb-0 list-none divide-y divide-neutral-200/70 p-0">
          <Fact icon={Mail} label="Email" value={user?.email} missing="No email on your account" />
          <Fact icon={Phone} label="WhatsApp number" value={user?.phone || user?.whatsapp_number}
            missing="Not added yet" />
        </ul>
      </Panel>

      <Panel title="Your link" subtitle="The address guests use to book you.">
        <UsernameField user={user} onChanged={(username) => updateUser({ ...user, username })} />
      </Panel>

      <Panel title="Booking rules">
        <div className="flex flex-col gap-5">
          <div>
            <Label htmlFor="acct-fee" hint="A guest's first reschedule is always free. The platform keeps this fee.">Guest reschedule fee</Label>
            <Select id="acct-fee" value={form.reschedule_fee} onChange={(e) => set('reschedule_fee')(Number(e.target.value))}>
              <option value={0}>Free</option>
              <option value={10}>₹10 from the second reschedule</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="acct-map" hint="Shown to guests who book an in-person service.">Google Maps link</Label>
            <div className="mt-input"><input id="acct-map" type="url" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false}
              placeholder="https://maps.app.goo.gl/…" value={form.map_link} onChange={(e) => set('map_link')(e.target.value.trim())} /></div>
          </div>
        </div>
      </Panel>

      <Panel title="Being found">
        <div className="flex flex-col gap-5">
          <SwitchRow checked={form.is_indexable} onChange={set('is_indexable')} label="Show me in Explore and search"
            detail={form.is_indexable
              ? 'Guests can find you on Meeticulous and on Google.'
              : 'Hidden. Only people with your link can find and book you.'} />
          <div>
            <Label htmlFor="acct-keywords" hint="Words guests might search for. Not shown on your page.">Search keywords</Label>
            <div className="mt-input"><input id="acct-keywords" type="text" maxLength={100} enterKeyHint="done"
              placeholder="e.g. prenatal yoga, Hindi" value={form.tagline} onChange={(e) => set('tagline')(e.target.value)} /></div>
          </div>
        </div>
      </Panel>

      {/* Room so the last card can scroll clear of the floating save bar. */}
      {dirty && <div aria-hidden="true" className="h-16" />}
      <SaveBar show={dirty} saving={saving} onSave={save} onDiscard={() => setForm(base)} />
    </SettingsShell>
  );
}
