import Reveal from '../../../components/home/Reveal';
import { CATEGORY_DEMOS } from '../demoData';
export default function S08Who({ hostCtx }) {
  const active = hostCtx.category;
  return (
    <div className="text-center">
      <Reveal><h2 className="font-heading text-3xl sm:text-4xl">Built for <span className="text-primary">people like you</span>.</h2></Reveal>
      <Reveal delay={0.1}><p className="mt-3 text-muted">Tap a profession — the live demo re-skins to match.</p></Reveal>
      <div className="mt-7 grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-3">
        {CATEGORY_DEMOS.map((c) => (
          <button key={c.key} onClick={() => hostCtx.setCategory(c.key)}
            className={`page-card px-4 py-3 text-sm font-medium flex items-center gap-2 justify-center ${active === c.key ? 'ring-2 ring-primary' : ''}`}>
            <span>{c.icon}</span>{c.label}
          </button>
        ))}
      </div>
      {active && <p className="mt-6 text-sm text-muted">The booking demo now shows a <span className="text-primary font-medium">{CATEGORY_DEMOS.find((c) => c.key === active)?.label}</span> example.</p>}
    </div>
  );
}
