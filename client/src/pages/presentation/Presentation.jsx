import { useState, useRef } from 'react';
import { useHideChrome } from '../../context/ChromeContext';
import { SLIDES } from './slides';
import { useDeckNav } from './useDeckNav';
import { usePresentationHost } from './usePresentationHost';
import { CATEGORY_DEMOS } from './demoData';
import Deck from './Deck';
import DeckControls from './DeckControls';
import SlideOverview from './SlideOverview';

export default function Presentation() {
  useHideChrome();
  const { index, next, prev, go } = useDeckNav(SLIDES);
  const hostCtx = usePresentationHost();
  const [overview, setOverview] = useState(false);
  const [category, setCategory] = useState(null); // null = the real/live host
  const activeHost = category
    ? (CATEGORY_DEMOS.find((c) => c.key === category)?.host || hostCtx.host)
    : hostCtx.host;
  const ctx = { ...hostCtx, activeHost, category, setCategory };
  const prevIndex = useRef(index);
  const direction = index >= prevIndex.current ? 1 : -1;
  prevIndex.current = index;

  return (
    <main className="fixed inset-0 overflow-hidden bg-canvas text-ink" style={{ fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
      <p className="sr-only" aria-live="polite">Slide {index + 1} of {SLIDES.length}: {SLIDES[index].title}</p>
      <Deck slides={SLIDES} index={index} direction={direction} hostCtx={ctx} onSwipe={(d) => (d > 0 ? next() : prev())} />
      <DeckControls index={index} total={SLIDES.length} onPrev={prev} onNext={next} onJump={go}
        onToggleOverview={() => setOverview(true)} />
      {overview && <SlideOverview slides={SLIDES} index={index} onJump={go} onClose={() => setOverview(false)} />}
    </main>
  );
}
