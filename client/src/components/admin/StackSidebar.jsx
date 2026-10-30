// client/src/components/admin/StackSidebar.jsx
// The 3-level stacked admin sidebar — ONE column, push/pop, no second lane.
// Reads the NAV tree only (never hardcodes a link). Clicking an AREA or MODULE
// replaces the list in place and adds a `‹ back` affordance; a LEAF navigates.
// The open depth is derived from the URL on every route change, so deep links,
// refresh and the browser Back button all land at the right level.
//
// Density: weight decreases and chrome drops as you descend — L1/L2 carry an icon,
// L3 leaves reserve the indent but omit the glyph. Colours/fonts unchanged.
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Ic from './Ic';
import { IC } from './adminNav';
import { itemActive, rollupBadge, formatBadge, resolveChain } from './navHelpers';

// key → node index for every branch (areas + modules) in the visible tree.
const indexBranches = (nav) => {
  const map = {};
  const walk = (nodes) => (nodes || []).forEach(n => {
    if (n.children) { if (n.key) map[n.key] = n; walk(n.children); }
  });
  walk(nav);
  return map;
};

const DANGER = 'var(--adm-danger, #DC2626)';

// One row: a branch (button that pushes) or a leaf (Link that navigates).
const NavRow = ({ node, area, pathname, counts, onNavigate, onOpen }) => {
  const isBranch = !!node.children;
  const active = !isBranch && itemActive(pathname, node);
  const count = rollupBadge(node, counts);
  const cls = `w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#960D32]/50 ${active ? 'font-semibold' : 'text-gray-300 hover:text-gray-100 hover:bg-white/[0.04]'}`;

  const icon = node.icon
    ? <Ic d={IC[node.icon]} size={16} strokeWidth={active ? 2.1 : 1.75}
        style={active ? { color: area.color } : undefined}
        className={active ? '' : 'text-gray-500'} />
    : <span className="w-[14px] flex-shrink-0" aria-hidden="true" />; // L3 leaf: keep indent, drop glyph

  const inner = (
    <>
      {icon}
      <span className="flex-1 truncate">{node.label}</span>
      {isBranch ? (
        <>
          {count > 0 && <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: DANGER }} />}
          <Ic d={IC.chevR} size={15} className="text-gray-500 flex-shrink-0" />
        </>
      ) : count > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white flex-shrink-0" style={{ background: DANGER }}>
          {formatBadge(count)}
        </span>
      )}
    </>
  );

  if (isBranch) return <button type="button" onClick={() => onOpen(node.key)} className={cls}>{inner}</button>;
  return (
    <Link to={node.to} onClick={onNavigate} aria-current={active ? 'page' : undefined}
      className={cls} style={active ? { background: `${area.color}1f`, color: area.color } : undefined}>
      {inner}
    </Link>
  );
};

// One panel = the current level's header + its rows (with optional group labels).
const Panel = ({ node, area, isRoot, pathname, counts, onNavigate, onOpen, onBack }) => {
  let lastGroup = null;
  return (
    <div className="adm-stack-panel absolute inset-0 flex flex-col overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      <div className="h-11 flex items-center gap-1.5 px-1.5 flex-shrink-0 sticky top-0 z-[1] bg-[#17171A]">
        {isRoot ? (
          <span className="px-2 text-[11px] font-bold tracking-[0.14em] uppercase text-gray-500 select-none">Meeticulous Admin</span>
        ) : (
          <>
            <button type="button" onClick={onBack} aria-label="Back"
              className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors">
              <Ic d={IC.chevL} size={17} strokeWidth={2.1} />
            </button>
            <span className="text-[13px] font-bold text-white truncate" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{node.label}</span>
          </>
        )}
      </div>
      <nav className="px-2 pb-4 flex flex-col gap-0.5">
        {(node.children || []).map(child => {
          const grp = child.group && child.group !== lastGroup ? child.group : null;
          if (child.group) lastGroup = child.group;
          return (
            <div key={child.key || child.to} style={{ display: 'contents' }}>
              {grp && <p className="px-2.5 pt-3.5 pb-1 text-[10.5px] font-bold tracking-[0.13em] uppercase text-gray-500 select-none">{grp}</p>}
              <NavRow node={child} area={area} pathname={pathname} counts={counts} onNavigate={onNavigate} onOpen={onOpen} />
            </div>
          );
        })}
      </nav>
    </div>
  );
};

const STYLE = `
@keyframes admStackIn { from { opacity:0; transform:translateX(10px) } to { opacity:1; transform:none } }
.adm-stack-panel { animation: admStackIn .22s cubic-bezier(.4,0,.2,1) }
@media (prefers-reduced-motion: reduce) { .adm-stack-panel { animation: none } }
`;

const StackSidebar = ({ nav, pathname, counts, onNavigate, onOpenPalette, onLogout, variant = 'desktop' }) => {
  const branches = useMemo(() => indexBranches(nav), [nav]);
  const chainKeys = useMemo(() => resolveChain(pathname, nav).chain.map(n => n.key), [pathname, nav]);
  const [openKeys, setOpenKeys] = useState(chainKeys);

  // Snap the open depth to the active route's chain on every navigation, so a deep
  // link or refresh opens at the right level and leaf clicks stay on their panel.
  useEffect(() => { setOpenKeys(chainKeys); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (key) => setOpenKeys(k => [...k, key]);
  const back = () => setOpenKeys(k => k.slice(0, -1));

  const isRoot = openKeys.length === 0;
  const node = isRoot ? { children: nav } : (branches[openKeys[openKeys.length - 1]] || { children: nav });
  const area = isRoot ? { color: '#960D32' } : (branches[openKeys[0]] || { color: '#960D32' });

  const panels = (
    <div className="relative flex-1 overflow-hidden">
      <Panel key={isRoot ? '__root' : openKeys.join('/')}
        node={node} area={area} isRoot={isRoot || node === undefined}
        pathname={pathname} counts={counts} onNavigate={onNavigate} onOpen={open} onBack={back} />
    </div>
  );

  if (variant === 'drawer') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <style>{STYLE}</style>
        {panels}
      </div>
    );
  }

  return (
    <aside className="hidden lg:flex flex-col w-[272px] flex-shrink-0 fixed inset-y-0 left-0 z-30 bg-[#17171A] border-r border-[#232327]">
      <style>{STYLE}</style>
      <div className="h-[60px] flex items-center gap-2.5 px-4 flex-shrink-0 border-b border-[#2A1416]">
        <Link to="/super-dashboard" title="Meeticulous Admin"
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#960D32' }}>
          <Ic d={IC.zap} size={13} className="text-white" strokeWidth={2.5} />
        </Link>
        <span className="text-white font-bold text-[13px]">Meeticulous</span>
        <span className="ml-auto text-[10px] font-bold text-gray-400 bg-white/[0.06] px-2 py-0.5 rounded-full">Admin</span>
      </div>
      <button type="button" onClick={onOpenPalette}
        className="mx-3 mt-2.5 mb-1.5 h-[34px] rounded-lg border border-[#232327] flex items-center gap-2 px-2.5 text-gray-500 hover:text-gray-300 hover:border-[#2c2c30] transition-colors text-[12.5px]">
        <Ic d={IC.search} size={13} /><span>Search…</span>
        <span className="ml-auto text-[10px] font-mono border border-[#232327] rounded px-1">⌘K</span>
      </button>
      {panels}
      <div className="border-t border-[#2A1416] flex-shrink-0 p-2 space-y-0.5">
        <Link to="/dashboard" className="flex items-center gap-2.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/[0.04] transition-colors text-[12.5px] px-2.5 py-2">
          <Ic d={IC.external} size={14} /><span>Host Dashboard</span>
        </Link>
        <button type="button" onClick={onLogout}
          className="w-full flex items-center gap-2.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-500/[0.05] transition-colors text-[12.5px] px-2.5 py-2">
          <Ic d={IC.logout} size={14} /><span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};

export default StackSidebar;
