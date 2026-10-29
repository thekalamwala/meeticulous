import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { USE_CASES_CONFIG } from './useCasesConfig';

// ── UseCaseCard ───────────────────────────────────────────────────────────────

const UseCaseCard = ({ item, onClick }) => {
  const Icon = item.icon;
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={item.href}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex items-start gap-3 rounded-xl p-3.5 transition-all duration-200 hover:shadow-sm hover:-translate-y-px hover:no-underline overflow-hidden"
      aria-label={item.label}
    >
      {/* Curtain reveal — slides in from left on hover */}
      <span
        className="pointer-events-none absolute inset-0 rounded-xl transition-transform duration-300"
        style={{
          backgroundColor: `${item.color}08`,
          transform: hovered ? 'translateX(0)' : 'translateX(-100%)',
        }}
        aria-hidden="true"
      />

      {/* Icon — bg + color flip to solid on hover via inline style */}
      <span
        className={`relative mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${item.iconBg} ${item.iconColor}`}
        style={hovered ? { backgroundColor: item.color, color: '#fff', transform: 'scale(1.1)' } : {}}
      >
        <Icon size={17} strokeWidth={2} />
      </span>

      {/* Text */}
      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className="block text-[13px] font-semibold leading-snug transition-colors duration-150"
            style={{ color: hovered ? item.color : '#111827' }}
          >
            {item.label}
          </span>
          {item.badge && (
            <span
              className="shrink-0 inline-block px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wide leading-none"
              style={{ backgroundColor: `${item.color}18`, color: item.color }}
            >
              {item.badge}
            </span>
          )}
        </span>
        <span className="block text-[11.5px] leading-snug text-gray-500 mt-0.5">
          {item.desc}
        </span>
      </span>
    </Link>
  );
};

// ── UseCaseFooter ─────────────────────────────────────────────────────────────

const UseCaseFooter = ({ onClose }) => (
  <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between bg-gray-50/60">
    <p className="text-[11.5px] text-gray-400">
      Trusted by creators across India
    </p>
    <Link
      to="/explore"
      onClick={onClose}
      className="flex items-center gap-1 text-[12px] font-semibold text-[#2E1065] hover:underline hover:no-underline focus-visible:outline-none"
    >
      Browse all creators
      <ChevronRight size={13} strokeWidth={2.5} />
    </Link>
  </div>
);

// ── UseCasesMegaMenu ──────────────────────────────────────────────────────────

const UseCasesMegaMenu = () => {
  const [open, setOpen]         = useState(false);
  const [rendered, setRendered] = useState(false);
  const location                = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close on outside click
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (!e.target.closest('[data-megamenu]')) close();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <div className="relative flex items-stretch" data-megamenu>
      {/* Trigger — click only */}
      <button
        type="button"
        onClick={() => { setRendered(true); setOpen((o) => !o); }}
        aria-expanded={open}
        aria-haspopup="menu"
        data-megamenu
        className={[
          'group relative flex items-center gap-1 px-3.5 text-[12.5px] font-medium transition-colors outline-none',
          'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2E1065]',
          open ? 'text-[#2E1065]' : 'text-gray-500 hover:text-[#2E1065]',
        ].join(' ')}
      >
        <Layers
          size={16}
          className={open ? 'text-[#2E1065]' : 'text-gray-400 group-hover:text-[#2E1065]/80'}
        />
        Explore
        <ChevronDown
          size={13}
          strokeWidth={2.5}
          className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Mega panel — portaled to body, fixed below 56px navbar */}
      {rendered && createPortal(
        <div
          data-megamenu
          className={[
            'fixed top-14 left-0 right-0 z-[49] flex justify-center px-4 transition-all duration-200',
            open
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-2 pointer-events-none',
          ].join(' ')}
          role="menu"
          aria-label="Explore"
        >
          <div className="w-full max-w-[860px] bg-white rounded-2xl border border-gray-200 shadow-[0_16px_48px_rgba(0,0,0,0.12)] overflow-hidden">
            <div className="p-5">
              <p className="pb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Browse by Industry
              </p>
              <div className="grid grid-cols-2 gap-0.5">
                {USE_CASES_CONFIG.map((item) => (
                  <UseCaseCard key={item.label} item={item} onClick={close} />
                ))}
              </div>
            </div>
            <UseCaseFooter onClose={close} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default UseCasesMegaMenu;
export { UseCaseCard, UseCaseFooter };
