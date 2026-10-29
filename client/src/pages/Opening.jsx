/**
 * Opening.jsx — the standalone /opening route (full-stage, no chrome).
 * Renders the shared ceremony. The same ceremony also runs as the site-wide
 * takeover overlay (components/opening/OpeningTakeover.jsx) during the window.
 */
import { useNavigate } from 'react-router-dom';
import Seo from '../components/common/Seo';
import { ogCard } from '../config/ogImages';
import OpeningCeremony from '../components/opening/OpeningCeremony';
import '../styles/opening.css';

export default function Opening() {
  const navigate = useNavigate();
  return (
    <>
      <Seo title="The Opening — Meeticulous" description="Cut the ribbon. Open Meeticulous. Put your name in stone, forever." image={ogCard('opening', 'png')} />
      <OpeningCeremony onExit={(reason) => { if (reason === 'skip') navigate('/'); }} />
    </>
  );
}
