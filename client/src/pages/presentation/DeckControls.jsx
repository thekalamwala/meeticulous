import { useState } from 'react';

export default function DeckControls({ index, total, onPrev, onNext, onJump, onToggleOverview }) {
  const [copied, setCopied] = useState(false);
  const fullscreen = () => { const el = document.documentElement; if (!document.fullscreenElement) el.requestFullscreen?.(); else document.exitFullscreen?.(); };
  const share = async () => {
    const url = window.location.href;
    try { if (navigator.share) { await navigator.share({ title: 'Meeticulous', url }); return; } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <>
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button onClick={onToggleOverview} className="btn btn--outline !px-3 !py-2 text-sm" aria-label="Slide overview">☰</button>
        <button onClick={share} className="btn btn--outline !px-3 !py-2 text-sm" aria-label="Share link">{copied ? 'Copied!' : 'Share'}</button>
        <button onClick={fullscreen} className="btn btn--outline !px-3 !py-2 text-sm" aria-label="Toggle fullscreen">⤢</button>
      </div>
      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-ink/5 bg-canvas/85 px-3 py-1.5 shadow-sm backdrop-blur-sm">
        <button onClick={onPrev} disabled={index === 0} className="btn btn--outline !p-2 disabled:opacity-30" aria-label="Previous slide">‹</button>
        <div className="flex items-center gap-1.5" aria-label="Slides">
          {Array.from({ length: total }).map((_, i) => (
            <button key={i} onClick={() => onJump(i)} aria-label={`Go to slide ${i + 1}`} aria-current={i === index ? 'true' : undefined}
              className={`h-2 rounded-full transition-all ${i === index ? 'bg-primary' : 'bg-ink/20'}`}
              style={{ width: i === index ? 22 : 8 }} />
          ))}
        </div>
        <button onClick={onNext} disabled={index === total - 1} className="btn btn--outline !p-2 disabled:opacity-30" aria-label="Next slide">›</button>
      </div>
    </>
  );
}
