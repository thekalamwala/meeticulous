// /services — SEO index of all professions that have bookable services.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, collectionPageJsonLd, breadcrumbJsonLd } from '../../utils/seo';
import { getServicesDirectory } from '../../services/api';
import { iconFor } from '../../config/professionIcons';

export default function ServicesDirectory() {
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    getServicesDirectory().then((res) => setGroups(res.data.groups)).catch(() => setGroups([]));
  }, []);

  const professionItems = (groups || [])
    .flatMap((g) => g.professions || [])
    .map((p) => ({ name: p.label, url: `/services/${p.slug}` }));

  return (
    <div className="app-container py-12">
      <Seo
        title="Browse Services by Profession | Meeticulous"
        description="Find bookable services from photographers, coaches, designers, tutors and more — compare professionals and book online."
        image={ogCard('services')}
        canonical={`${SITE_URL}/services`}
        jsonLd={[
          collectionPageJsonLd({
            name: 'Browse Services by Profession | Meeticulous',
            description: 'Find bookable services from photographers, coaches, designers, tutors and more — compare professionals and book online.',
            url: '/services',
            items: professionItems,
          }),
          breadcrumbJsonLd({ items: [{ name: 'Home', path: '/' }, { name: 'Services', path: '/services' }] }),
        ]}
      />
      <h1 className="font-heading text-[2.1rem] font-extrabold leading-[1.12] tracking-tight text-[#2A1416] xl:text-[2.7rem]">
        What do you want to get done?
      </h1>
      {groups === null ? (
        <div className="py-16 text-[#64748b]">Loading…</div>
      ) : (
        groups.map((g) => (
          <section key={g.group_label} className="mt-10">
            <h2 className="font-heading text-xl font-bold text-[#2A1416]">{g.group_label}</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {g.professions.map((p) => {
                const Icon = iconFor(p.slug, null);
                return (
                  <Link
                    key={p.slug}
                    to={`/services/${p.slug}`}
                    className="flex items-center gap-3 bg-white border-2 border-[#2A1416] rounded-[6px] p-4
                               shadow-[4px_4px_0_#2A1416] transition-transform duration-150 hover:-translate-y-1"
                  >
                    <Icon size={20} className="text-[#2A1416] shrink-0" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold text-[#2A1416]">{p.label}</span>
                      <span className="block text-xs text-[#64748b]">{p.serviceCount} services</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
