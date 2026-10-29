import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, Navigate, useNavigate, Link } from 'react-router-dom';
import Ic from '../admin/Ic';
import { IC, NAV, PATH_LABELS, QUICK_ACTIONS } from '../admin/adminNav';
import { filterTree } from '../admin/navHelpers';
import StackSidebar from '../admin/StackSidebar';
import CommandPalette from '../admin/CommandPalette';
import NotificationBell from '../admin/NotificationBell';
import AdminEscalationRinger from '../admin/AdminEscalationRinger';
import { useAdminTheme } from '../admin/useAdminTheme';
import { adminOpsSummary } from '../../services/api';

// SECURITY: Admin session is completely isolated in 'bas_admin' localStorage key.
// Guard checks type === 'admin' — a vendor/user session cannot pass this check.
const getAdminSession = () => {
  try { return JSON.parse(localStorage.getItem('bas_admin') || 'null'); } catch { return null; }
};

const isValidAdminSession = (s) => s && s.type === 'admin' && s.token;

const AdminLayout = ({ children }) => {
  const session  = getAdminSession();
  const location = useLocation();
  const navigate = useNavigate();

  // ── SECURITY GUARD ────────────────────────────────────────────
  // Reject anything that isn't a valid admin session.
  if (!isValidAdminSession(session)) {
    return <Navigate to="/hello-sloth" replace />;
  }

  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [theme, toggleTheme] = useAdminTheme();
  const dark = theme === 'dark';
  const [showQuick,   setShowQuick]   = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [counts,      setCounts]      = useState({}); // { opsSummaryKey: count }
  const quickRef   = useRef(null);
  const profileRef = useRef(null);

  // 3-level stacked nav, permission-filtered from the config (single source of truth).
  const nav = useMemo(() => filterTree(NAV, session), [session]);

  // Live attention counts feed the rail dots + sidebar pills. Same endpoint the
  // NotificationBell uses; each sub-count is server-side try/caught with a 0
  // fallback, so this never throws the shell.
  useEffect(() => {
    let alive = true;
    adminOpsSummary()
      .then(({ data }) => {
        if (!alive) return;
        const map = {};
        (data?.attention || []).forEach(a => { map[a.key] = a.count; });
        setCounts(map);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('bas_admin');
    navigate('/hello-sloth');
  };

  useEffect(() => {
    const h = e => {
      if (quickRef.current   && !quickRef.current.contains(e.target))   setShowQuick(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close drawer on navigation + lock body scroll while open
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const breadcrumbs = (() => {
    const segs = location.pathname.split('/').filter(Boolean);
    const result = []; let acc = '';
    segs.forEach(seg => {
      acc += '/' + seg;
      const label = PATH_LABELS[seg];
      if (label) result.push({ label, to: acc });
    });
    return result;
  })();

  return (
    <div className={`admin-shell adm-canvas min-h-screen ${dark ? 'dark' : ''}`} style={{ fontFamily:"'Poppins',system-ui,sans-serif" }}>
      <AdminEscalationRinger />

      {/* Desktop stacked sidebar (lg+) */}
      <StackSidebar nav={nav} pathname={location.pathname} counts={counts}
        onOpenPalette={() => setPaletteOpen(true)} onLogout={handleLogout} />

      {/* Mobile drawer — every visible section stacked (rail + sidebar collapse into one) */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[272px] flex flex-col bg-[#17171A] transition-transform duration-300 lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 h-[60px] border-b border-[#1E0B4D] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:'#2E1065' }}>
              <Ic d={IC.zap} size={12} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-white font-bold text-sm">Meeticulous</span>
          </div>
          <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-gray-500 hover:text-white p-1 rounded"><Ic d={IC.x} size={16} /></button>
        </div>
        <StackSidebar variant="drawer" nav={nav} pathname={location.pathname} counts={counts}
          onNavigate={() => setMobileOpen(false)} onLogout={handleLogout} />
        <div className="border-t border-[#1E0B4D] flex-shrink-0 p-3 space-y-0.5">
          <Link to="/dashboard" className="flex items-center gap-2.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/[0.04] transition-colors text-[12px] px-2.5 py-2">
            <Ic d={IC.external} size={14} /><span>Host Dashboard</span>
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-2.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-500/[0.05] transition-colors text-[12px] px-2.5 py-2">
            <Ic d={IC.logout} size={14} /><span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col min-h-screen lg:ml-[272px]">
        <header className="adm-header sticky top-0 z-20 backdrop-blur h-[60px] flex items-center gap-3 px-4 md:px-5 flex-shrink-0">
          <button onClick={() => setMobileOpen(o => !o)} aria-label="Open menu"
            className="p-1.5 rounded-lg adm-t3 adm-hoverable transition-colors flex-shrink-0 lg:hidden">
            <Ic d={IC.hamb} size={17} />
          </button>

          <nav className="hidden sm:flex items-center gap-1 text-[13px] adm-t3 flex-1 min-w-0">
            {breadcrumbs.length === 0
              ? <span className="font-semibold adm-t1">Dashboard</span>
              : breadcrumbs.map((crumb, i) => (
                <span key={crumb.to} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <Ic d={IC.chevR} size={10} className="text-gray-300 flex-shrink-0" />}
                  {i === breadcrumbs.length - 1
                    ? <span className="font-semibold adm-t1 truncate">{crumb.label}</span>
                    : <Link to={crumb.to} className="hover:opacity-80 truncate transition-colors">{crumb.label}</Link>}
                </span>
              ))
            }
          </nav>

          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
            <button onClick={() => setPaletteOpen(true)} className="btn hidden md:flex items-center gap-2 px-3 py-1.5 adm-chip adm-hoverable transition-colors text-[12px] w-40 max-w-[40vw]">
              <Ic d={IC.search} size={13} /><span>Search...</span>
              <span className="ml-auto text-[10px] adm-t3 font-mono adm-chip px-1 rounded">⌘K</span>
            </button>

            <NotificationBell />

            <div className="relative" ref={quickRef}>
              <button onClick={() => setShowQuick(o => !o)} title="Quick Actions"
                className={`p-2 rounded-lg transition-colors ${showQuick ? 'bg-[#2E1065]/10 text-[#2E1065]' : 'adm-t3 adm-hoverable'}`}>
                <Ic d={IC.zap} size={16} />
              </button>
              {showQuick && (
                <div className="absolute right-0 top-full mt-2 adm-card rounded-xl shadow-xl w-52 z-50 overflow-hidden">
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quick Actions</p>
                  {QUICK_ACTIONS.map(a => (
                    <Link key={a.to} to={a.to} onClick={() => setShowQuick(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] adm-t2 adm-hoverable transition-colors">
                      <div className="w-6 h-6 rounded-md adm-chip flex items-center justify-center flex-shrink-0">
                        <Ic d={IC[a.icon]} size={12} className="text-gray-500" />
                      </div>
                      {a.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <button onClick={toggleTheme} title={dark ? 'Light mode' : 'Dark mode'}
              className="p-2 rounded-lg adm-t3 adm-hoverable transition-colors">
              <Ic d={dark ? IC.sun : IC.moon} size={16} />
            </button>

            <div className="relative" ref={profileRef}>
              <button onClick={() => setShowProfile(o => !o)}
                className={`flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg transition-colors ${showProfile ? 'adm-chip' : 'adm-hoverable'}`}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background:'#2E1065' }}>
                  {(session.name || session.username || 'A')[0].toUpperCase()}
                </div>
                <div className="hidden md:block text-left leading-none">
                  <p className="text-[12px] font-semibold adm-t1">{session.name || 'Super Admin'}</p>
                  <p className="text-[10px] adm-t3 mt-0.5">@{session.username || 'admin'}</p>
                </div>
                <Ic d={IC.chevD} size={11} className="text-gray-400 hidden md:block" />
              </button>
              {showProfile && (
                <div className="absolute right-0 top-full mt-2 adm-card rounded-xl shadow-xl w-52 z-50 overflow-hidden">
                  <div className="px-3 py-2.5 border-b adm-border">
                    <p className="text-[13px] font-semibold adm-t1">{session.name || 'Super Admin'}</p>
                    <p className="text-[11px] adm-t3">@{session.username || 'admin'}</p>
                  </div>
                  <div className="py-1">
                    <Link to="/admin/settings" onClick={() => setShowProfile(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-[13px] adm-t2 adm-hoverable transition-colors">
                      <Ic d={IC.gear} size={13} className="adm-t3" />Settings
                    </Link>
                  </div>
                  <div className="border-t adm-border py-1">
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-500 hover:bg-[var(--adm-danger-bg)] transition-colors">
                      <Ic d={IC.logout} size={13} />Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-5 md:p-7">
          <div className="max-w-[1360px] mx-auto">{children}</div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} session={session} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};

export default AdminLayout;
