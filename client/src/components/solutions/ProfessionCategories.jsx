import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Paintbrush, Landmark, Heart, Dumbbell, GraduationCap, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { CATEGORIES } from '../../data/solutionProfessions';
import './professionCategories.css';

const FILTERS = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'design', label: 'Design & Architecture', icon: Paintbrush },
  { id: 'finance', label: 'Finance & Law', icon: Landmark },
  { id: 'health', label: 'Health & Wellness', icon: Heart },
  { id: 'sports', label: 'Sports & Fitness', icon: Dumbbell },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'creative', label: 'Events & Creative', icon: CalendarDays },
];

export default function ProfessionCategories() {
  const [filter, setFilter] = useState('all');
  const [position, setPosition] = useState(0);
  const [maximum, setMaximum] = useState(0);
  const track = useRef(null);
  const drag = useRef(null);
  const moved = useRef(false);
  const interaction = useRef({ hovered: false, focused: false });
  const professions = filter === 'all' ? CATEGORIES : CATEGORIES.filter((item) => item.group === filter);

  const measure = () => {
    const el = track.current;
    if (!el) return;
    setPosition(el.scrollLeft);
    setMaximum(Math.max(0, el.scrollWidth - el.clientWidth));
  };

  useEffect(() => {
    const el = track.current;
    el.scrollLeft = 0;
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [filter]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const el = track.current;
      if (!el || document.hidden || interaction.current.hovered || interaction.current.focused || drag.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const end = el.scrollWidth - el.clientWidth;
      if (end < 2) return;
      if (el.scrollLeft >= end - 2) {
        el.scrollTo({ left: 0, behavior: 'instant' });
      } else {
        const gap = parseFloat(getComputedStyle(el).columnGap) || 16;
        el.scrollBy({ left: el.firstElementChild.offsetWidth + gap, behavior: 'smooth' });
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [filter]);

  const scroll = (direction) => {
    const el = track.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direction * (el.firstElementChild.offsetWidth + 16), behavior: reduced ? 'instant' : 'smooth' });
  };

  const chooseFilter = (id) => {
    setFilter(id);
    moved.current = false;
  };

  const moveTab = (event, index) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % FILTERS.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + FILTERS.length) % FILTERS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = FILTERS.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    chooseFilter(FILTERS[next].id);
    document.getElementById(`profession-tab-${FILTERS[next].id}`).focus();
  };

  return (
    <div
      className="profession-browser"
      onFocusCapture={() => { interaction.current.focused = true; }}
      onBlurCapture={(event) => { interaction.current.focused = event.currentTarget.contains(event.relatedTarget); }}
    >
      <div className="profession-browser__heading">
        <div>
          <p className="profession-browser__eyebrow">Choose your path</p>
          <h2>Explore professionals<br className="hidden sm:block" /> by category</h2>
        </div>
        <p className="profession-browser__intro">From industry veterans to niche specialists, find the right expert for your goals.</p>
      </div>

      <div role="tablist" aria-label="Filter professions" className="profession-browser__filters">
        {FILTERS.map(({ id, label, icon: Icon }, index) => (
          <button key={id} id={`profession-tab-${id}`} type="button" role="tab" aria-selected={filter === id} aria-controls="profession-results" tabIndex={filter === id ? 0 : -1} onClick={() => chooseFilter(id)} onKeyDown={(event) => moveTab(event, index)}>
            <Icon size={17} strokeWidth={1.6} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div id="profession-results" role="tabpanel" aria-labelledby={`profession-tab-${filter}`} className="profession-browser__stage">
        <button type="button" aria-label="Previous professions" className="profession-browser__arrow profession-browser__arrow--previous" disabled={position < 2} onClick={() => scroll(-1)}><ChevronLeft size={20} /></button>
        <div
          ref={track}
          role="region"
          aria-label="Profession categories"
          tabIndex={0}
          className="profession-browser__track"
          onScroll={measure}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
              event.preventDefault();
              scroll(event.key === 'ArrowRight' ? 1 : -1);
            }
          }}
          onPointerDown={(event) => {
            moved.current = false;
            if (event.pointerType !== 'mouse' || event.button !== 0) return;
            drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const delta = event.clientX - drag.current.x;
            if (Math.abs(delta) > 6) {
              moved.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              event.currentTarget.scrollLeft = drag.current.left - delta;
            }
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onPointerLeave={() => { drag.current = null; }}
          onClickCapture={(event) => { if (moved.current) { event.preventDefault(); moved.current = false; } }}
          onDragStart={(event) => event.preventDefault()}
        >
          {professions.map(({ label, sub, to, image, tags }) => (
            <Link key={to} to={to} className="profession-browser__card" draggable="false" onMouseEnter={() => { interaction.current.hovered = true; }} onMouseLeave={() => { interaction.current.hovered = false; }}>
              <img src={image} alt="" loading="lazy" width={720} height={480} draggable="false" />
              <div className="profession-browser__card-copy">
                <h3>{label}</h3>
                <p>{sub}</p>
                <ul aria-label="Specialties">{tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
              </div>
            </Link>
          ))}
        </div>
        <button type="button" aria-label="Next professions" className="profession-browser__arrow profession-browser__arrow--next" disabled={maximum - position < 2} onClick={() => scroll(1)}><ChevronRight size={20} /></button>
      </div>


    </div>
  );
}
