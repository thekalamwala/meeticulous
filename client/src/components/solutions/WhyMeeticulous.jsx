import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, ShieldCheck, CalendarCheck, LockKeyhole, Heart } from 'lucide-react';
import './whyMeeticulous.css';

const FEATURES = [
  { title: 'Verified experts', eyebrow: 'Trusted experts', body: 'Real professionals, real experience. Discover verified hosts, explore their services, and find the right person for your next step.', tags: ['Public profiles', 'Clear service details', 'Book online'], mascot: 'orange', icon: ShieldCheck, badge: 'Verified hosts', next: 'Flexible scheduling' },
  { title: 'Flexible scheduling', eyebrow: 'Your time, your terms', body: 'Choose an available slot that fits your day. Book directly from a professional’s page without the back-and-forth.', tags: ['Live availability', 'Book your own slot', 'Automatic reminders'], mascot: 'purple', icon: CalendarCheck, badge: 'Your time', next: 'Secure payments' },
  { title: 'Secure payments', eyebrow: 'Simple, secure bookings', body: 'See the price before you book, pay online with UPI or card, and keep your booking confirmation in one place.', tags: ['UPI & cards', 'Upfront prices', 'Booking confirmation'], mascot: 'blue', icon: LockKeyhole, badge: 'Pay securely', next: 'For every goal' },
  { title: 'For every goal', eyebrow: 'A little help goes a long way', body: 'Learn a skill, get advice, or make your next move. Find professionals across work, learning, creativity and wellbeing.', tags: ['Learn something new', 'Get expert advice', 'Make progress'], mascot: 'green', icon: Heart, badge: 'Keep growing', next: 'Verified experts' },
];

export default function WhyMeeticulous() {
  const [active, setActive] = useState(0);
  const interaction = useRef({ hovered: false, focused: false, startX: null, swiped: false });
  const advance = (direction) => setActive((value) => (value + direction + FEATURES.length) % FEATURES.length);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || interaction.current.hovered || interaction.current.focused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      setActive((value) => (value + 1) % FEATURES.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="solutions-why px-5 py-16 sm:px-8 lg:py-24" aria-labelledby="solutions-why-heading">
      <div className="solutions-why__layout">
        <div className="solutions-why__intro">
          <p className="solutions-why__eyebrow">Why Meeticulous</p>
          <h2 id="solutions-why-heading">More than a<br /> booking — it’s a<br /> better way to<br /> grow.</h2>
          <div className="solutions-why__controls">
            <div className="solutions-why__arrows">
              <button type="button" aria-label="Previous feature" onClick={() => advance(-1)}><ChevronLeft size={17} /></button>
              <button type="button" aria-label="Next feature" onClick={() => advance(1)}><ChevronRight size={17} /></button>
            </div>
            <div className="solutions-why__auto"><strong>Next feature</strong><span>Auto-play</span></div>
          </div>
        </div>

        <div
          className="solutions-why__deck"
          role="region"
          aria-label="Why Meeticulous features"
          onMouseEnter={() => { interaction.current.hovered = true; }}
          onMouseLeave={() => { interaction.current.hovered = false; }}
          onFocusCapture={() => { interaction.current.focused = true; }}
          onBlurCapture={(event) => { interaction.current.focused = event.currentTarget.contains(event.relatedTarget); }}
          onPointerDown={(event) => {
            interaction.current.startX = event.clientX;
            interaction.current.swiped = false;
          }}
          onPointerMove={(event) => {
            const start = interaction.current.startX;
            if (start !== null && Math.abs(event.clientX - start) > 8) event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerUp={(event) => {
            const start = interaction.current.startX;
            interaction.current.startX = null;
            if (start !== null && Math.abs(event.clientX - start) > 45) {
              interaction.current.swiped = true;
              advance(event.clientX < start ? 1 : -1);
            }
          }}
          onPointerCancel={() => { interaction.current.startX = null; }}
          onClickCapture={(event) => {
            if (interaction.current.swiped) {
              event.preventDefault();
              event.stopPropagation();
              interaction.current.swiped = false;
            }
          }}
        >
          {FEATURES.map((feature, index) => {
            const depth = (index - active + FEATURES.length) % FEATURES.length;
            const Icon = feature.icon;
            return (
              <article key={feature.title} className={`solutions-why__card ${depth === 0 ? 'is-front' : ''}`} style={{ '--depth': depth, zIndex: FEATURES.length - depth }} onClick={(event) => {
                if (event.target.closest('button')) return;
                if (depth === 0) advance(1);
                else setActive(index);
              }}>
                <button type="button" className="solutions-why__card-tab" aria-label={`Show ${feature.title}`} onClick={() => setActive(index)}>
                  {depth === 0 ? feature.eyebrow : feature.title}
                </button>
                <div className="solutions-why__card-content" hidden={depth !== 0}>
                  <div className="solutions-why__copy">
                    <h3>{feature.title}</h3>
                    <p>{feature.body}</p>
                    <ul>{feature.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
                  </div>
                  <div className="solutions-why__illustration" aria-hidden="true">
                    <img src={`/about/mascot-${feature.mascot}.png`} alt="" width="256" height="256" draggable="false" />
                    <span className="solutions-why__badge"><Icon size={16} />{feature.badge}</span>
                  </div>
                  <button type="button" className="solutions-why__next" onClick={() => advance(1)}>Next up: {feature.next} <ArrowRight size={12} /></button>
                </div>
                {depth > 0 && <img className="solutions-why__peek" src={`/about/mascot-${feature.mascot}.png`} alt="" width="64" height="64" draggable="false" />}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
