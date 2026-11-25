import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getSpaces, adminPatchSpace } from '../../../services/communityApi';
import { Btn, Card, Skeleton } from '../../../components/admin/ui';
import { canModerate, errMsg } from './shared';
import MeetDropdown from '../../../components/ui/MeetDropdown';

const fld = 'border adm-border rounded-lg px-3 py-2 text-[12.5px] outline-none focus:ring-2 focus:ring-[#960D32]/30';

function SpaceForm({ s, can }) {
  const [f, setF] = useState({ name: s.name, description: s.description || '', post_policy: s.post_policy, reply_policy: s.reply_policy });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    try { await adminPatchSpace(s.key, { ...f, description: f.description || null }); toast.success('Saved'); } catch (e) { toast.error(errMsg(e)); }
  };
  const id = (k) => `${s.key}-${k}`;
  return (
    <Card className="!p-4 grid sm:grid-cols-2 gap-3 text-[12.5px] adm-t2">
      <label htmlFor={id('name')}>Name<input id={id('name')} value={f.name} maxLength={60} onChange={set('name')} disabled={!can} className={`${fld} w-full`} /></label>
      <label htmlFor={id('desc')}>Description<input id={id('desc')} value={f.description} maxLength={300} onChange={set('description')} disabled={!can} className={`${fld} w-full`} /></label>
      <label htmlFor={id('post')}>Who can post
        <MeetDropdown id={id('post')} ariaLabel="Who can post" value={f.post_policy} onChange={(v) => setF((p) => ({ ...p, post_policy: v }))} disabled={!can} className="w-full"
          options={['everyone', 'hosts', 'official'].map((p) => ({ value: p, label: p }))} /></label>
      <label htmlFor={id('reply')}>Who can reply
        <MeetDropdown id={id('reply')} ariaLabel="Who can reply" value={f.reply_policy} onChange={(v) => setF((p) => ({ ...p, reply_policy: v }))} disabled={!can} className="w-full"
          options={['everyone', 'hosts'].map((p) => ({ value: p, label: p }))} /></label>
      {can && <div><Btn size="sm" onClick={save}>Save {s.key}</Btn></div>}
    </Card>
  );
}

export default function SpacesTab() {
  const [spaces, setSpaces] = useState(null);
  useEffect(() => { getSpaces().then((d) => setSpaces(d.spaces || [])).catch(() => setSpaces([])); }, []);
  if (!spaces) return <Skeleton className="h-40" />;
  const can = canModerate();
  return <div className="space-y-3">{spaces.map((s) => <SpaceForm key={s.key} s={s} can={can} />)}</div>;
}
