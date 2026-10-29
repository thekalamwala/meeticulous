export default function SlideOverview({ slides, index, onJump, onClose }) {
  return (
    <div className="absolute inset-0 z-30 bg-canvas/95 backdrop-blur-sm p-5 overflow-y-auto" role="dialog" aria-label="Slide overview">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-heading text-xl">Slides</h2>
        <button onClick={onClose} className="btn btn--outline !px-3 !py-2" aria-label="Close overview">✕</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {slides.map((s, i) => (
          <button key={s.key} onClick={() => { onJump(i); onClose(); }}
            className={`page-card text-left p-4 aspect-video flex flex-col justify-between ${i === index ? 'ring-2 ring-primary' : ''}`}>
            <span className="text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
            <span className="font-heading text-sm">{s.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
