import { useState } from 'react';
import Reveal from '../../../components/home/Reveal';
import Tabs from '../../../components/dashboard/ui/Tabs';
import ServiceCard from '../../../components/guest/ServiceCard';
export default function S06Sides({ hostCtx }) {
  const [tab, setTab] = useState('client');
  const h = hostCtx.activeHost; const sv = h.services[0];
  const cardService = { id: sv.id, slug: sv.slug, title: sv.title, description: sv.short_description, price: sv.price, currency: 'INR',
    coverImage: h.cover_image, hostName: h.name, hostUsername: h.username, hostAvatar: h.profile_image, avgRating: 5, reviewCount: 12,
    area: 'Online', meetingMode: sv.meeting_mode, url: '#', badges: { isNew: true, availableThisWeek: true } };
  return (
    <div>
      <Reveal><h2 className="font-heading text-3xl sm:text-4xl">Beautiful on <span className="text-primary">both sides</span>.</h2></Reveal>
      <div className="mt-5 max-w-xs"><Tabs tabs={[{ value: 'client', label: 'Your client' }, { value: 'host', label: 'You' }]} value={tab} onChange={setTab} /></div>
      <div className="mt-6 max-w-md">
        {tab === 'client'
          ? <ServiceCard service={cardService} rank={1} />
          : <div className="page-card p-5 grid gap-3">
              <div className="flex justify-between"><span className="text-sm text-muted">This week</span><span className="font-heading font-bold text-primary">₹12,400</span></div>
              {['Strategy Session · Tue 3:00 PM', 'Discovery Call · Wed 11:00 AM', 'Deep Dive · Fri 2:00 PM'].map((r) => (
                <div key={r} className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full bg-primary" />{r}</div>
              ))}
            </div>}
      </div>
    </div>
  );
}
