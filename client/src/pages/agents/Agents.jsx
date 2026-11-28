import { useEffect, useRef } from 'react';
import { useHideChrome } from '../../context/ChromeContext';
import Seo from '../../components/common/Seo';
import { SITE_URL } from '../../utils/seo';
import { startTerritory } from './territory';
import './agents.css';

// /agents — the four Meeticulous agents (Pal, Rupi, Ankur, Tara) start in the centre on every
// visit and claim the page tile by tile, forever. React renders the shell; territory.js drives
// the sprites and the canvas outside React's render loop.
export default function Agents() {
  useHideChrome();
  const fieldRef = useRef(null);
  const canvasRef = useRef(null);
  const barRef = useRef(null);
  const legendRef = useRef(null);

  useEffect(() => startTerritory({
    field: fieldRef.current,
    canvas: canvasRef.current,
    bar: barRef.current,
    legend: legendRef.current,
  }), []);

  return (
    <main className="agents-page" ref={fieldRef}>
      <Seo
        title="Meet the Meeticulous Agents — Pal, Rupi, Ankur & Tara"
        description="Pal books, Rupi collects payments, Ankur follows up on WhatsApp and Tara reads your numbers. Watch the four Meeticulous agents claim the page."
        canonical={`${SITE_URL}/agents`}
      />
      <canvas ref={canvasRef} aria-hidden="true" />
      <aside className="agents-hud" aria-label="Territory score">
        <h1>Meeticulous agents</h1>
        <p>Four agents, one page. Nobody gets to finish it. Hover or tap an agent.</p>
        <div className="agents-bar" ref={barRef} />
        <div className="agents-legend" ref={legendRef} />
      </aside>
    </main>
  );
}
