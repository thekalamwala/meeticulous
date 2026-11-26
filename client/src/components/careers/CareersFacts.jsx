import { Globe2, MapPin, Briefcase, Users, Clock } from 'lucide-react';
import { getOpenJobs } from './careersContent';
import './careersFacts.css';

// Quiet fact strip under the hero (in place of a logo wall — every item here is
// a real fact from careersContent, nothing invented).
export default function CareersFacts() {
  const open = getOpenJobs().length;
  const facts = [
    { Icon: Globe2, label: 'Remote-first', caption: 'Work style' },
    { Icon: MapPin, label: 'India', caption: 'Based in' },
    { Icon: Clock, label: 'Full-time', caption: 'Commitment' },
    { Icon: Briefcase, label: `${open} open role${open === 1 ? '' : 's'}`, caption: 'Opportunities', href: '#open-roles' },
    { Icon: Users, label: 'Small team', caption: 'Big ownership' },
  ];

  return (
    <section aria-label="Working at Meeticulous" className="careers-facts px-5 sm:px-8">
      <div className="careers-facts__layout">
        <h2>Working at<br className="hidden lg:block" /> Meeticulous</h2>
        <ul>
          {facts.map(({ Icon, label, caption, href }) => {
            const Tag = href ? 'a' : 'div';
            return (
              <li key={caption}>
                <Tag href={href} className="careers-facts__item">
                  <span className="careers-facts__icon"><Icon size={17} strokeWidth={1.6} aria-hidden="true" /></span>
                  <span className="careers-facts__copy"><span>{caption}</span><strong>{label}</strong></span>
                </Tag>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
