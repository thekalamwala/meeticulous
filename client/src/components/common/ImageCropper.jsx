import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import toast from 'react-hot-toast';
import { uploadImage } from '../../services/api';
import { HostAvatar, HostCover } from './HostAvatar';

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_ZOOM = 3;               // 3× beyond cover-fit

// Export targets — fixed output px so files are predictable & small regardless
// of the on-screen frame size. Profile is square; cover is a 3:1 banner.
const TARGET = {
  profile: { w: 512, h: 512 },
  cover: { w: 1500, h: 500 },
};

// ── Pure geometry (exported for unit tests) ──────────────────────────────────
// Smallest scale that makes the image fully COVER the frame (no empty edges).
export const coverFitScale = (natW, natH, frameW, frameH) => {
  if (!natW || !natH) return 1;
  return Math.max(frameW / natW, frameH / natH);
};

// Clamp the image's top-left offset so the frame is always fully covered — the
// image can never be dragged/zoomed to reveal an empty edge. imgW/imgH are the
// scaled image dimensions.
export const clampOffset = (offset, imgW, imgH, frameW, frameH) => ({
  // when imgW >= frameW: x ∈ [frameW - imgW, 0]; else centre it.
  x: imgW >= frameW ? Math.min(0, Math.max(frameW - imgW, offset.x)) : (frameW - imgW) / 2,
  y: imgH >= frameH ? Math.min(0, Math.max(frameH - imgH, offset.y)) : (frameH - imgH) / 2,
});

/**
 * ImageCropper — premium masked crop editor (pan · zoom · pinch · live preview).
 *
 * Props (backward-compatible; name/themeColor/avatarUrl are additive):
 *   aspect      - 1 = square profile (circular mask), else banner (3 = cover)
 *   folder      - storage sub-folder: 'profiles' | 'covers' | 'services'
 *   currentUrl  - existing image shown before a new file is chosen
 *   onUploaded  - fn(url) after successful upload
 *   onClose     - fn() to dismiss
 *   label       - e.g. "Profile Photo"
 *   name        - host name (drives the live-preview initials/label)
 *   themeColor  - host theme colour (live-preview fallback tint / cover gradient)
 *   avatarUrl   - host avatar, shown in the COVER preview's header mock
 */
const ImageCropper = ({
  aspect = 1, folder = 'uploads', currentUrl, onUploaded, onClose,
  label = 'Image', name = '', themeColor, avatarUrl,
}) => {
  const isProfile = aspect === 1;
  const stageRef  = useRef(null);
  const canvasRef = useRef(null);
  const fileRef   = useRef(null);
  const pointers  = useRef(new Map());   // pointerId -> {x,y}
  const gesture   = useRef(null);        // active pinch: {dist, zoom}
  const dragRef   = useRef(null);        // active drag: {x,y} = pointer - offset

  const [imgEl, setImgEl]       = useState(null);
  const [zoom, setZoom]         = useState(1);      // 1 = cover-fit, up to MAX_ZOOM
  const [offset, setOffset]     = useState({ x: 0, y: 0 });
  const [frame, setFrame]       = useState({ w: 320, h: 320 });
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName]   = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const natW = imgEl?.naturalWidth || 0;
  const natH = imgEl?.naturalHeight || 0;
  const fit  = coverFitScale(natW, natH, frame.w, frame.h);
  const scale = fit * zoom;
  const imgW = natW * scale;
  const imgH = natH * scale;

  // Frame follows the stage width so it fits every screen (responsive, premium).
  useLayoutEffect(() => {
    const measure = () => {
      const stageW = stageRef.current?.clientWidth || 320;
      const w = Math.max(200, Math.min(stageW - 32, isProfile ? 360 : 560));
      setFrame({ w, h: isProfile ? w : Math.round(w / aspect) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [aspect, isProfile]);

  // Keep the frame CENTRE pinned while zooming (premium feel), then re-clamp so
  // the frame stays covered. On a fresh load prevScale is null → just centre.
  const prevScale = useRef(null);
  useEffect(() => {
    if (!imgEl) return;
    const s = fit * zoom;
    setOffset((o) => {
      let next = o;
      if (prevScale.current && prevScale.current !== s) {
        const cx = frame.w / 2, cy = frame.h / 2, r = s / prevScale.current;
        next = { x: cx - (cx - o.x) * r, y: cy - (cy - o.y) * r };
      }
      return clampOffset(next, natW * s, natH * s, frame.w, frame.h);
    });
    prevScale.current = s;
  }, [imgEl, zoom, frame.w, frame.h, fit, natW, natH]);

  // Draw + emit a live preview data URL.
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !imgEl) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, frame.w, frame.h);
    ctx.drawImage(imgEl, offset.x, offset.y, imgW, imgH);
    setPreviewUrl(cv.toDataURL('image/jpeg', 0.85));
  }, [imgEl, offset, imgW, imgH, frame.w, frame.h]);

  useEffect(() => { draw(); }, [draw]);

  const loadFile = (file) => {
    if (!ALLOWED.includes(file.type)) { toast.error('Please choose a JPG, PNG, or WEBP image'); return; }
    if (file.size > MAX_SIZE)         { toast.error('That image is over 2 MB — pick a smaller one'); return; }
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      prevScale.current = null; // fresh basis → the effect centres cleanly
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setImgEl(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { toast.error("Couldn't read that image — try another file"); URL.revokeObjectURL(url); };
    img.src = url;
  };
  const onFileChange = (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); };

  // ── Pointer gestures: single-pointer drag, two-pointer pinch ───────────────
  const onPointerDown = (e) => {
    if (!imgEl) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      dragRef.current = null;
    } else {
      dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    }
  };
  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(Math.max(1, Math.min(MAX_ZOOM, gesture.current.zoom * (dist / gesture.current.dist))));
    } else if (dragRef.current) {
      const next = { x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y };
      setOffset(clampOffset(next, imgW, imgH, frame.w, frame.h));
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    gesture.current = null;
    dragRef.current = null; // re-armed on next down → no jump when a finger lifts
  };

  // Mouse-wheel zoom (desktop).
  const onWheel = (e) => {
    if (!imgEl) return;
    e.preventDefault();
    setZoom((z) => Math.max(1, Math.min(MAX_ZOOM, z - e.deltaY * 0.0015)));
  };

  const handleSave = async () => {
    if (!imgEl || uploading) return;
    setUploading(true);
    try {
      const t = isProfile ? TARGET.profile : TARGET.cover;
      const out = document.createElement('canvas');
      out.width = t.w; out.height = t.h;
      const k = t.w / frame.w; // display → export scale
      out.getContext('2d').drawImage(imgEl, offset.x * k, offset.y * k, imgW * k, imgH * k);
      const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Failed to process image');

      const file = new File([blob], `${folder}-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await uploadImage(fd, folder);
      onUploaded(data.url);
      toast.success(`${label} updated`);
      onClose();
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.message || err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  // Esc to close.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !uploading) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, uploading]);

  const ratioText = isProfile ? 'Square · shown as a circle' : '3:1 banner · top of your profile';

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose} role="dialog" aria-modal="true" aria-label={`Edit ${label}`}>
      <div
        className="flex w-full flex-col bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl"
        style={{ maxHeight: '100dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-900">Edit {label}</h3>
            <p className="text-[11px] text-gray-400">{ratioText}</p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — scrolls if short screens; stage + live preview */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:flex-row sm:p-5">
          {/* STAGE */}
          <div ref={stageRef} className="flex flex-1 flex-col items-center justify-center">
            {imgEl ? (
              <>
                <div className="relative touch-none select-none" style={{ width: frame.w, height: frame.h }}
                  onPointerDown={onPointerDown} onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}>
                  <canvas ref={canvasRef} width={frame.w} height={frame.h}
                    className="block cursor-grab active:cursor-grabbing bg-gray-900"
                    style={{ width: frame.w, height: frame.h, borderRadius: isProfile ? '9999px' : 12 }} />
                  {/* Mask: dims everything outside the exact final shape (WYSIWYG). */}
                  <div className="pointer-events-none absolute inset-0"
                    style={{
                      borderRadius: isProfile ? '9999px' : 12,
                      boxShadow: '0 0 0 9999px rgba(17,17,17,0.55)',
                      outline: '2px solid rgba(255,255,255,0.9)',
                    }} />
                </div>

                {/* Zoom control */}
                <div className="mt-4 flex w-full max-w-sm items-center gap-3">
                  <span aria-hidden="true" className="text-xs text-gray-400">–</span>
                  <input type="range" min="1" max={MAX_ZOOM} step="0.01" value={zoom}
                    aria-label="Zoom" onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="flex-1 accent-primary" />
                  <span aria-hidden="true" className="text-sm text-gray-400">+</span>
                  <span className="w-10 text-right text-xs tabular-nums text-gray-500">{zoom.toFixed(1)}×</span>
                </div>
                <p className="mt-2 text-center text-[11px] text-gray-400">Drag to reposition · scroll or pinch to zoom</p>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="mt-3 text-xs font-medium text-gray-500 underline-offset-2 hover:text-primary hover:underline">
                  Choose a different photo
                </button>
              </>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 p-10 text-gray-400 transition-colors hover:border-primary hover:text-primary"
                style={{ minHeight: 240 }}>
                {currentUrl ? (
                  <img src={currentUrl} alt="Current" className="mb-1 h-20 w-20 rounded-full object-cover opacity-70" />
                ) : (
                  <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                <span className="text-sm font-semibold">Click to choose a photo</span>
                <span className="text-xs opacity-70">JPG, PNG or WEBP · up to 2 MB</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden" onChange={onFileChange} />
          </div>

          {/* LIVE PREVIEW */}
          {imgEl && (
            <div className="flex flex-shrink-0 flex-col items-center gap-3 sm:w-56">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Preview</p>
              {isProfile ? (
                <div className="flex items-center gap-4">
                  <HostAvatar src={previewUrl} name={name} themeColor={themeColor} size={80} shape="circle" decorative
                    className="border-2 border-white shadow" />
                  <HostAvatar src={previewUrl} name={name} themeColor={themeColor} size={40} shape="circle" decorative
                    className="border border-white shadow" />
                </div>
              ) : (
                <div className="w-full max-w-[220px] overflow-hidden rounded-xl border bg-white shadow-sm">
                  <HostCover src={previewUrl} themeColor={themeColor} className="w-full" />
                  <div className="relative z-10 -mt-6 flex justify-center">
                    <HostAvatar src={avatarUrl} name={name} themeColor={themeColor} size={48} shape="rounded" decorative
                      className="border-2 border-white shadow" />
                  </div>
                  <p className="truncate px-3 pb-3 pt-1 text-center text-xs font-semibold text-gray-800">
                    {name || 'Your name'}
                  </p>
                </div>
              )}
              <p className="text-center text-[11px] text-gray-400">
                {isProfile ? 'How your avatar appears' : 'How your profile header appears'}
              </p>
            </div>
          )}
        </div>

        {/* Sticky footer — always visible (fixes the hidden-Save bug) */}
        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t bg-white px-5 py-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={onClose} disabled={uploading}
            className="btn btn--outline px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={!imgEl || uploading}
            className="btn inline-flex items-center gap-2 bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-40">
            {uploading && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {uploading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
