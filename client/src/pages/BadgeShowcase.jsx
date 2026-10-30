import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getVendorBadges, getVendorBadgeDetail } from '../services/api';
import Seo from '../components/common/Seo';
import { SITE_URL } from '../utils/seo';
import PetalSpinner from '../components/common/PetalSpinner';

/**
 * Public badge showcase — domain.com/:username/badges
 * Unauthenticated, indexable, mobile-first. Negative badges are filtered
 * server-side; this page never sees them.
 */
const BadgeShowcase = () => {
  const { username } = useParams();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);        // badge detail
  const [modalLoading, setModalLoading] = useState(false);
  const modalRef = useRef(null);
  const lastFocused = useRef(null);

  useEffect(() => {
    setLoading(true);
    getVendorBadges(username)
      .then((r) => setData(r.data))
      .catch((e) => setNotFound(e?.response?.status === 404))
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (data?.vendor?.name) document.title = `${data.vendor.name} — Badges | Meeticulous`;
  }, [data]);

  const openModal = async (badge) => {
    lastFocused.current = document.activeElement;
    setModalLoading(true);
    setModal({ ...badge, rank: null });
    try {
      const r = await getVendorBadgeDetail(username, badge.id);
      setModal(r.data);
    } catch { /* keep basic info */ }
    setModalLoading(false);
  };

  const closeModal = useCallback(() => {
    setModal(null);
    lastFocused.current?.focus?.();
  }, []);

  // Escape close + focus trap
  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => {
      if (e.key === 'Escape') return closeModal();
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    modalRef.current?.querySelector('button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [modal, closeModal]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFBF7]">
      <PetalSpinner size={48} />
    </div>
  );

  if (notFound || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFBF7] px-6 text-center">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Page not found</h1>
      <p className="text-sm text-gray-500 mb-6">This badge showcase doesn't exist.</p>
      <Link to="/" className="text-[#960D32] font-semibold text-sm hover:underline">← Back to Meeticulous</Link>
    </div>
  );

  const { vendor, badges, total } = data;

  return (
    <div className="min-h-screen bg-[#FFFBF7]" style={{ fontFamily: "'Inter Tight',sans-serif" }}>
      <Seo
        title={`${vendor.name} — Badges | Meeticulous`}
        description={`Badges and achievements earned by ${vendor.name} on Meeticulous.`}
        canonical={`${SITE_URL}/${username}/badges`}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          {vendor.profile_image
            ? <img src={vendor.profile_image} alt={vendor.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow" />
            : <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#960D32] to-amber-400 flex items-center justify-center text-white text-2xl font-extrabold">{vendor.name?.[0] || '?'}</div>}
          <div>
            <Link to={`/${vendor.username}`} className="text-xl sm:text-2xl font-extrabold text-gray-900 hover:text-[#960D32] transition-colors">{vendor.name}</Link>
            <p className="text-sm text-gray-500">{total} badge{total === 1 ? '' : 's'} earned</p>
          </div>
        </header>

        {/* Grid: 2 cols mobile → 3 tablet → 5 desktop */}
        {badges.length === 0 ? (
          <p className="text-center text-gray-400 py-16 text-sm">No badges earned yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {badges.map((b) => (
              <button key={b.id} onClick={() => openModal(b)}
                className={`bg-white rounded text-left p-4 border shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[#960D32] ${b.is_bas_team ? 'border-[#960D32]/50 ring-1 ring-[#960D32]/20' : 'border-gray-200'}`}
                style={{ borderRadius: 4 }}>
                {b.image_url
                  ? <img src={b.image_url} alt={`${b.name} badge`} className="w-14 h-14 mx-auto mb-3 object-contain" />
                  : <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-xl font-extrabold text-[#960D32]">{b.name[0]}</div>}
                <p className="text-xs sm:text-sm font-bold text-gray-800 text-center leading-tight">{b.name}</p>
                {b.is_bas_team && <p className="text-[9px] text-center font-bold text-[#960D32] mt-1 uppercase tracking-wider">BAS Team</p>}
              </button>
            ))}
          </div>
        )}

        <footer className="mt-12 text-center text-[11px] text-gray-400">
          Verified by <Link to="/" className="font-semibold text-[#960D32] hover:underline">Meeticulous</Link>
        </footer>
      </div>

      {/* Modal — no page reload, focus trapped, Escape/outside-click close, full-screen on mobile */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={closeModal}
          role="dialog" aria-modal="true" aria-label={`${modal.name} badge details`}>
          <div ref={modalRef} onClick={(e) => e.stopPropagation()}
            className="bg-white w-full h-full sm:h-auto sm:max-w-md sm:rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center relative">
            <button onClick={closeModal} aria-label="Close"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-lg leading-none">×</button>
            {modal.image_url
              ? <img src={modal.image_url} alt={`${modal.name} badge`} className="w-24 h-24 object-contain mb-4" />
              : <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-4xl font-extrabold text-[#960D32] mb-4">{modal.name[0]}</div>}
            <h2 className="text-xl font-extrabold text-gray-900">{modal.name}</h2>
            {modal.is_bas_team && <p className="text-[10px] font-bold text-[#960D32] uppercase tracking-widest mt-1">BAS Team Endorsement</p>}
            {modalLoading ? (
              <p className="text-xs text-gray-400 mt-3">Loading…</p>
            ) : (
              <>
                {modal.rank && <p className="text-sm font-bold text-gray-700 mt-2">Unlock rank #{modal.rank}</p>}
                {modal.description && <p className="text-sm text-gray-500 mt-3 max-w-xs">{modal.description}</p>}
                {modal.earned_at && <p className="text-xs text-gray-400 mt-4">Earned {new Date(modal.earned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgeShowcase;
