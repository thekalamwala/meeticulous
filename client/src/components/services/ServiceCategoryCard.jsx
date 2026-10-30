// ServiceCategoryCard — one bookable service on a /services/:profession SEO page.
// Visual sibling of VendorCard (client/src/components/guest/VendorCard.jsx) — same
// Friendly Brutalism border/shadow/radius tokens (2px #2A1416 border, 6px radius,
// hard offset shadow). This app does not use Tailwind dark: variants (no darkMode
// config, no dark: usage in pages) so none are added here.
import { Link } from 'react-router-dom';
import { iconFor } from '../../config/professionIcons';

export default function ServiceCategoryCard({ service, profession }) {
  const Icon = iconFor(profession, service.icon);
  return (
    <div className="flex flex-col gap-3 bg-white border-2 border-[#2A1416] rounded-[6px] p-5
                     shadow-[4px_4px_0_#2A1416] transition-transform duration-150 hover:-translate-y-1">
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-10 h-10 border-2 border-[#2A1416] rounded-[4px] bg-[#F8FAFC]">
          <Icon size={20} className="text-[#2A1416]" aria-hidden="true" />
        </span>
        <h3 className="font-heading text-[15px] font-bold text-[#2A1416] leading-tight">{service.name}</h3>
      </div>
      <p className="text-[13px] text-[#64748b] leading-snug">{service.description}</p>
      <Link
        to={`/explore?category=${encodeURIComponent(profession)}&service=${encodeURIComponent(service.slug)}`}
        className="btn-primary mt-auto text-center text-[13px] px-4"
      >
        Find Professionals
      </Link>
    </div>
  );
}
