import { Link } from 'react-router-dom';
import { Play, Search, Check, Mic, Video, Phone, ArrowRight } from 'lucide-react';
import './solutionsHero.css';

export default function SolutionsHeroVisual() {
  return (
    <div className="solutions-hero-visual">
      <Link to="/how-it-works" aria-label="See how it works" className="solutions-hero-visual__guide">
        <span><Play size={11} fill="currentColor" aria-hidden="true" /></span> How it works
      </Link>
      <div role="img" aria-label="Discover an expert, schedule a session, and meet online" className="solutions-hero-visual__scene">
        <div className="solutions-hero-visual__browser" aria-hidden="true">
          <div className="solutions-hero-visual__chrome"><i /><i /><i /><span /><small>Preview</small></div>
          <div className="solutions-hero-visual__steps"><span>1. Discover</span><ArrowRight size={12} /><span>2. Schedule</span><ArrowRight size={12} /><span>3. Meet</span></div>
        </div>
        <svg className="solutions-hero-visual__path" viewBox="0 0 500 430" fill="none" aria-hidden="true">
          <path d="M116 230 V310 Q116 324 132 324 H227 M268 172 H384 Q400 172 400 188 V236" stroke="#c8bcb8" strokeWidth="1.5" strokeDasharray="3 4" />
          <path d="m222 320 5 4-5 4m174-97 4 5 4-5" stroke="#c8bcb8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <div className="solutions-hero-visual__discover" aria-hidden="true">
          <div className="solutions-hero-visual__mascot"><img src="/about/mascot-purple.png" alt="" width="256" height="256" /></div>
          <strong>Find your expert</strong>
          <span className="solutions-hero-visual__tiny-search"><Search size={10} /> Architects & designers</span>
        </div>

        <div className="solutions-hero-visual__schedule" aria-hidden="true">
          <div className="solutions-hero-visual__expert">
            <img src="/images/solutions/sample-architect.webp" alt="" width="64" height="72" />
            <div><strong>Meera K.</strong><span>Architect</span><small>1:1 consultation</small></div>
          </div>
          <div className="solutions-hero-visual__session"><span>Residential</span><span>Commercial</span></div>
          <div className="solutions-hero-visual__slots"><span>Mon, 10:00 AM</span><span>Tue, 2:30 PM</span></div>
          <span className="solutions-hero-visual__book">Book a session <Check size={11} /></span>
          <small className="solutions-hero-visual__sample">Sample booking</small>
        </div>

        <div className="solutions-hero-visual__meet" aria-hidden="true">
          <div className="solutions-hero-visual__video">
            <img className="solutions-hero-visual__portrait" src="/images/solutions/sample-architect.webp" alt="" width="180" height="180" />
            <span className="solutions-hero-visual__video-label"><Video size={9} /> Video session <b>Live</b></span>
            <div className="solutions-hero-visual__friends"><img src="/about/mascot-green.png" alt="" /><img src="/about/mascot-orange.png" alt="" /></div>
            <div className="solutions-hero-visual__call-tools"><span><Mic size={10} /></span><span><Video size={10} /></span><span><Phone size={10} /></span></div>
          </div>
          <strong>Connect live</strong>
        </div>
      </div>
    </div>
  );
}
