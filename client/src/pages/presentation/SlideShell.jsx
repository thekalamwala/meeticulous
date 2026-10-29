// Interactive controls inside a slide (booking demo, tabs, toggles, profession
// chips) live inside the deck's horizontal drag surface (see Deck.jsx). Without
// this guard, framer-motion's pointerdown starts a swipe gesture and eats the
// control's click/tap — the whole "try it yourself" demo becomes unreliable,
// especially on touch. Stopping propagation only when the pointer lands on an
// interactive element keeps swipe-to-navigate working on empty slide areas.
const INTERACTIVE = 'button, a, input, select, textarea, [role="tab"], [role="switch"], [contenteditable="true"]';
const stopSwipeOnControls = (e) => {
  if (e.target.closest?.(INTERACTIVE)) e.stopPropagation();
};

export default function SlideShell({ eyebrow, children, className = '' }) {
  return (
    <section className="h-full w-full overflow-y-auto overflow-x-hidden" onPointerDown={stopSwipeOnControls}>
      {/* pb clears the fixed bottom control bar so tall slides (demo) never hide content behind it */}
      <div className="min-h-full grid place-items-center px-5 pt-16 pb-28 sm:pt-20 sm:pb-28">
        <div className={`w-full ${className}`} style={{ maxWidth: 'min(100%, 64rem)' }}>
          {eyebrow && (
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
