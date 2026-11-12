// Shared FAQ block for the 10 bespoke feature pages.
//
// Layout: two columns — a sticky heading on the LEFT and the accordion on the
// RIGHT (stacks to one column on mobile). The accordion is CONTROLLED, so only
// ONE item is open at a time (opening one closes the rest), and each answer
// opens/closes with a smooth height transition using the CSS grid-template-rows
// 0fr↔1fr technique (declarative, no layout thrash; collapses to an instant
// toggle under prefers-reduced-motion). The answer text stays in the DOM when
// collapsed (height 0, not display:none) so it is still crawlable.
//
// Each page keeps its own look by passing class names + a render function for the
// summary row, so this component owns ONLY the layout and the open/close
// behaviour, never the palette.
//
// Props
//   heading            node   — themed heading, shown in the sticky left column
//   items              [{q,a}]
//   defaultOpen        number — index open on first paint (default 0; -1 = all shut)
//   renderSummary(f,i,open) -> node   — the clickable row's inner content
//   renderExtras(f,i,open)  -> node   — optional extra inside the item box (e.g. an
//                                       absolutely-positioned accent bar)
//   itemClassName      str    — the item box (border / bg / shadow / radius)
//   openItemClassName  str    — added to the item box while it is open
//   summaryClassName   str    — the <button> row (padding / flex / alignment)
//   answerClassName    str    — the answer paragraph
//   containerClassName str    — the outer grid wrapper (override max-width etc.)
//   listClassName      str    — the right column that holds the items
//   headingClassName   str    — the sticky left column wrapper
import { useId, useState } from 'react';

export default function FeatureFaq({
  heading,
  items,
  defaultOpen = 0,
  renderSummary,
  renderExtras,
  itemClassName = '',
  openItemClassName = '',
  summaryClassName = '',
  answerClassName = '',
  answerStyle,
  containerClassName = 'mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:gap-16',
  listClassName = 'grid gap-3',
  headingClassName = 'lg:sticky lg:top-24 lg:self-start',
}) {
  const [open, setOpen] = useState(defaultOpen);
  const idBase = useId();
  const cls = (v, isOpen) => (typeof v === 'function' ? v(isOpen) : v);

  return (
    <div className={containerClassName}>
      <div className={headingClassName}>{heading}</div>

      <div className={listClassName}>
        {items.map((f, i) => {
          const isOpen = open === i;
          const panelId = `${idBase}-p-${i}`;
          const btnId = `${idBase}-b-${i}`;
          return (
            <div key={f.q} className={`${cls(itemClassName, isOpen)} ${isOpen ? openItemClassName : ''}`}>
              {renderExtras && renderExtras(f, i, isOpen)}
              <button
                type="button"
                id={btnId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className={`w-full cursor-pointer text-left ${cls(summaryClassName, isOpen)}`}
              >
                {renderSummary(f, i, isOpen)}
              </button>
              <div
                id={panelId}
                role="region"
                aria-labelledby={btnId}
                className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
                style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <p className={answerClassName} style={answerStyle}>{f.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
