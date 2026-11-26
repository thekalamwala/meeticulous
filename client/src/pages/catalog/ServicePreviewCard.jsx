// Live preview of a service as a guest will see its card, for the Kept item
// editor (desktop: sticky right column; phone: the "Preview" sheet).
//
// It shows only what the host typed. The guest's total (booking fee + GST) is
// worked out by the server at checkout and never here, so the price line says
// the fee is added in words, not in a number we would have to compute.
import { useState } from 'react';
import { CalendarClock, Clock, Video, MapPin, Phone } from 'lucide-react';
import { inr, cn } from '../../components/dashboard/ui/v2';

const MODE = {
  online: { label: 'Online', Icon: Video },
  offline: { label: 'In person', Icon: MapPin },
  phone: { label: 'Phone call', Icon: Phone },
};

export default function ServicePreviewCard({ form, feeOnly, hostName, className = '' }) {
  const [broken, setBroken] = useState(false);
  const title = (form.title || '').trim();
  const blurb = (form.short_description || '').trim();
  const minutes = form.duration === 0 ? Number(form.custom_duration) || 0 : Number(form.duration) || 0;
  const mode = MODE[form.service_type] || MODE.online;
  const price = Number(form.price) || 0;
  const onRequest = !!form.price_on_request;

  let big; let small = null;
  if (onRequest) { big = 'Price on request'; small = 'Guests book first, then you agree a price.'; }
  else if (feeOnly || price === 0) { big = 'Free'; small = feeOnly ? 'Guests pay only the booking fee.' : null; }
  else { big = inr(price); small = 'Booking fee is added at checkout.'; }

  return (
    <article className={cn('overflow-hidden rounded-[24px] bg-white', className)} aria-label="Preview of your service card">
      {form.thumbnail_url && !broken ? (
        <img src={form.thumbnail_url} alt="" onError={() => setBroken(true)} className="aspect-[16/9] w-full object-cover" />
      ) : (
        <span aria-hidden="true" className="grid aspect-[16/9] w-full place-items-center bg-blush"
          style={{ backgroundImage: 'url(/brand/ds/03-patterns/mt-pattern-dots-on-blush.svg)', backgroundSize: '44px' }}>
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-maroon"><CalendarClock className="h-7 w-7" strokeWidth={1.9} /></span>
        </span>
      )}
      <div className="flex flex-col gap-2 p-5">
        {hostName && <p className="mb-0 truncate text-[13px] font-semibold text-faint">{hostName}</p>}
        <h3 className={cn('mb-0 line-clamp-2 font-display text-[20px] font-bold leading-tight tracking-[-0.02em]', title ? 'text-ink' : 'text-faint')}>
          {title || 'Your service title'}
        </h3>
        <p className={cn('mb-0 line-clamp-3 text-[14px] leading-relaxed', blurb ? 'text-muted' : 'text-faint')}>
          {blurb || 'One or two lines on what a guest gets from this session.'}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-cream px-2.5 py-1 text-[13px] font-semibold text-muted">
            <Clock className="h-3.5 w-3.5" strokeWidth={2.4} />{minutes ? `${minutes} min` : 'Length not set'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-cream px-2.5 py-1 text-[13px] font-semibold text-muted">
            <mode.Icon className="h-3.5 w-3.5" strokeWidth={2.4} />{mode.label}
          </span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3 border-t border-neutral-200 pt-4">
          <div className="min-w-0">
            <p className="mb-0 truncate font-display text-[24px] font-extrabold tabular-nums tracking-[-0.02em] text-maroon">{big}</p>
            {small && <p className="mb-0 text-[13px] text-faint">{small}</p>}
          </div>
          <span className="shrink-0 rounded-[12px] bg-maroon px-4 py-2.5 text-[14px] font-semibold text-white">Book</span>
        </div>
      </div>
    </article>
  );
}
