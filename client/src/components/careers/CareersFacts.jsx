import { Globe2, MapPin, Briefcase, Users, Clock } from 'lucide-react';
import { getOpenJobs } from './careersContent';

// Quiet fact strip under the hero (in place of a logo wall — every item here is
// a real fact from careersContent, nothing invented).
export default function CareersFacts() {
  const open = getOpenJobs().length;
  const facts = [
    { Icon: Globe2, label: 'Remote-first' },
    { Icon: MapPin, label: 'India' },
    { Icon: Clock, label: 'Full-time' },
    { Icon: Briefcase, label: open ? `${open} open role${open === 1 ? '' : 's'}` : 'Always hiring' },
    { Icon: Users, label: 'Small team' },
  ];

  return (
    <section aria-label="Working at Meeticulous" className="border-y border-black/5 bg-white px-5 py-8 sm:px-8">
      <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-ink/40">Working at Meeticulous</p>
      <ul className="mx-auto mt-5 flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {facts.map(({ Icon, label }) => (
          <li key={label} className="inline-flex items-center gap-2 font-heading text-base font-semibold text-ink/45 sm:text-lg">
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
