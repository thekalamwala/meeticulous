import { useState } from 'react';

// Accordion FAQ. Answers stay in the DOM when collapsed (grid 0fr→1fr transition, NOT
// unmounted) so crawlers / AI answer engines still read every answer — the whole point
// of the FAQ for AEO. Themable via `colors` ({ text, secondary, card, border }).
export default function FaqAccordion({ faqs = [], colors = {}, defaultOpen = 0 }) {
  const [open, setOpen] = useState(defaultOpen);
  const C = colors;
  if (!faqs.length) return null;

  return (
    <dl className="space-y-3">
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="rounded-xl overflow-hidden"
            style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <dt>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left"
              >
                <span className="text-sm font-semibold" style={{ color: C.text }}>{f.q}</span>
                <svg
                  className={`w-4 h-4 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
                  style={{ color: C.secondary }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </dt>
            {/* grid-rows trick keeps the answer mounted at all times; only its row
                height animates, so collapsed answers remain in the DOM for crawlers. */}
            <dd
              className="grid transition-[grid-template-rows] duration-300 ease-in-out"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="px-4 pb-4 text-sm leading-relaxed" style={{ color: C.secondary }}>{f.a}</p>
              </div>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
