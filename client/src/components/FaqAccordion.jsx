import { useId, useState } from 'react';

// Accordion FAQ. Answers stay in the DOM when collapsed (grid 0fr→1fr transition, NOT
// unmounted) so crawlers / AI answer engines still read every answer — the whole point
// of the FAQ for AEO. Each question is a real heading (h3 by default — the WAI-ARIA
// accordion pattern: heading > button), so the page outline carries every question.
// Themable via `colors` ({ text, secondary, card, border }).
export default function FaqAccordion({ faqs = [], colors = {}, defaultOpen = 0, headingLevel = 3 }) {
  const [open, setOpen] = useState(defaultOpen);
  const uid = useId();
  const C = colors;
  const H = `h${headingLevel}`;
  if (!faqs.length) return null;

  return (
    <div className="space-y-3">
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="rounded-xl overflow-hidden"
            style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <H className="m-0 font-sans text-base font-normal tracking-normal">
              <button
                type="button"
                id={`${uid}-q${i}`}
                aria-controls={`${uid}-a${i}`}
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
            </H>
            {/* grid-rows trick keeps the answer mounted at all times; only its row
                height animates, so collapsed answers remain in the DOM for crawlers. */}
            <div
              id={`${uid}-a${i}`}
              role="region"
              aria-labelledby={`${uid}-q${i}`}
              className="grid transition-[grid-template-rows] duration-300 ease-in-out"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="px-4 pb-4 text-sm leading-relaxed" style={{ color: C.secondary }}>{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
