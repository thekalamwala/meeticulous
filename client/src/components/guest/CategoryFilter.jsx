/**
 * CategoryFilter.jsx
 * Horizontal scrollable category chips for the Explore page.
 * Props:
 *   categories  — [{ id, label, slug, icon_url? }]
 *   selected    — currently selected slug ('' = All)
 *   onChange    — fn(slug)
 */
export default function CategoryFilter({ categories = [], selected = '', onChange }) {
  const all = [{ id: '__all__', label: 'All', slug: '' }, ...categories];

  return (
    <div className="relative">
      {/* Fade the right edge so a scrollable row reads as scrollable. MUST match
          the page background (Explore is bg-surface); fading to the old cream
          left a visible smudge once the page went white. Only at sm+ where the
          row scrolls sideways — on mobile the row wraps, so no fade. */}
      <div className="pointer-events-none absolute right-0 top-0 z-10 hidden h-full w-12
                      bg-gradient-to-l from-surface to-transparent sm:block" />

      {/* Mobile: wrap onto multiple lines (no sideways scroll). sm+: single
          sideways-scrolling row. */}
      <div className="flex flex-wrap gap-2 pb-1 sm:flex-nowrap sm:overflow-x-auto sm:scrollbar-hide">
        {all.map((cat) => {
          const active = cat.slug === selected;
          return (
            <button
              key={cat.id}
              onClick={() => onChange(cat.slug)}
              // Selection reads as fill vs outline rather than shadow depth —
              // same pill language as /blog. Only used by Explore.
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5
                          text-[13px] font-semibold leading-none transition-colors duration-150
                          ${active
                            ? 'bg-ink text-white'
                            : 'border border-black/10 bg-white text-muted hover:bg-black/[0.04] hover:text-ink'
                          }`}
            >
              {cat.icon_url && (
                <img src={cat.icon_url} alt="" className="w-4 h-4 object-contain" />
              )}
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
