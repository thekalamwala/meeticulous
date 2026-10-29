// Shared 16:9 image cropper (extracted from ServiceForm's inline ThumbnailCropper).
// Cover-fit + drag + zoom on a 480x270 canvas; exports a cropped JPEG at outW x outH
// (default 1200x675) via canvas.toBlob and uploads through /api/upload/image.
//
// Props:
//   value    — current image URL (shown as preview)
//   onChange — (url) => void, called with the uploaded image URL
//   folder   — upload bucket folder (e.g. "services", "products")
//   label    — label node above the control
//   outW/outH — export resolution (16:9); default 1200x675
import { useState, useRef, useCallback, useEffect } from 'react';
import { uploadImage } from '../../services/api';
import toast from 'react-hot-toast';
import { Button } from '../dashboard/ui';

const ThumbnailCropper = ({ value, onChange, folder = 'services', label, outW = 1200, outH = 675 }) => {
  const canvasRef = useRef(null);
  const fileRef   = useRef(null);
  const [imgEl, setImgEl]       = useState(null);
  const [scale, setScale]       = useState(1);
  const [offset, setOffset]     = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]   = useState(value || '');

  const CANVAS_W = 480;
  const CANVAS_H = 270; // 16:9

  const draw = useCallback(() => {
    if (!imgEl || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.drawImage(imgEl, offset.x, offset.y, imgEl.naturalWidth * scale, imgEl.naturalHeight * scale);
    // NOTE: crop-guide border is CSS on the <canvas> element, NOT stroked here —
    // a canvas stroke bakes into the exported JPEG (permanent border on uploads).
  }, [imgEl, scale, offset]);

  useEffect(() => { draw(); }, [draw]);

  const loadFile = (file) => {
    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!ALLOWED.includes(file.type)) { toast.error('Only JPG, PNG, WEBP allowed'); return; }
    if (file.size > 2 * 1024 * 1024)  { toast.error('Max 2MB'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const fit = Math.max(CANVAS_W / img.naturalWidth, CANVAS_H / img.naturalHeight);
      setScale(fit);
      setOffset({ x: (CANVAS_W - img.naturalWidth * fit) / 2, y: (CANVAS_H - img.naturalHeight * fit) / 2 });
      setImgEl(img);
    };
    img.src = url;
  };

  const onMouse = (e) => {
    if (e.type === 'mousedown') { setDragging(true); setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y }); }
    if (e.type === 'mousemove' && dragging) setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    if (e.type === 'mouseup' || e.type === 'mouseleave') setDragging(false);
  };

  // Touch support
  const onTouch = (e) => {
    const t = e.touches[0];
    if (e.type === 'touchstart') { setDragging(true); setDragStart({ x: t.clientX - offset.x, y: t.clientY - offset.y }); }
    if (e.type === 'touchmove' && dragging) { e.preventDefault(); setOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y }); }
    if (e.type === 'touchend') setDragging(false);
  };

  const upload = async () => {
    if (!canvasRef.current) return;
    setUploading(true);
    try {
      // Render the same crop to a full-resolution offscreen canvas (outW x outH)
      // so the uploaded JPEG isn't limited to the 480x270 on-screen preview size.
      const ratio = outW / CANVAS_W;
      const out = document.createElement('canvas');
      out.width = outW; out.height = outH;
      const octx = out.getContext('2d');
      octx.drawImage(
        imgEl,
        offset.x * ratio, offset.y * ratio,
        imgEl.naturalWidth * scale * ratio, imgEl.naturalHeight * scale * ratio,
      );
      // Use backend /api/upload/image which runs as service role — no RLS issues
      const blob = await new Promise(res => out.toBlob(res, 'image/jpeg', 0.88));
      const file = new File([blob], `thumb-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await uploadImage(formData, folder);
      setPreview(data.url);
      onChange(data.url);
      setImgEl(null);
      toast.success('Thumbnail saved!');
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {label}

      {/* Preview if no new file selected */}
      {!imgEl && (
        <div
          className="group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50"
          style={{ width: '100%', aspectRatio: '16/9', maxHeight: 220 }}
          onClick={() => fileRef.current?.click()}
        >
          {preview
            ? <img src={preview} alt="" className="h-full w-full object-cover"/>
            : <div className="p-6 text-center text-gray-400">
                <svg className="mx-auto mb-2 h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <p className="text-sm font-medium">Click to upload thumbnail</p>
                <p className="mt-1 text-xs">JPG, PNG, WEBP · Max 2MB · 16:9 recommended</p>
              </div>
          }
          {preview && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="text-sm font-medium text-white">Change thumbnail</span>
            </div>
          )}
        </div>
      )}

      {/* Cropper canvas */}
      {imgEl && (
        <div className="space-y-3">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full cursor-move rounded-xl border border-gray-200"
            style={{ aspectRatio: '16/9' }}
            onMouseDown={onMouse} onMouseMove={onMouse} onMouseUp={onMouse} onMouseLeave={onMouse}
            onTouchStart={onTouch} onTouchMove={onTouch} onTouchEnd={onTouch}
          />
          <div className="flex items-center gap-3">
            <label className="whitespace-nowrap text-xs text-gray-500">Zoom</label>
            <input type="range" min={0.1} max={4} step={0.05} value={scale} onChange={e => setScale(parseFloat(e.target.value))} className="flex-1"/>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setImgEl(null)}>Cancel</Button>
            <Button type="button" size="sm" className="flex-1" onClick={upload} disabled={uploading}>{uploading ? 'Uploading…' : 'Save Thumbnail'}</Button>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden"
        onChange={e => { if (e.target.files?.[0]) loadFile(e.target.files[0]); e.target.value = ''; }}/>

      {!imgEl && (
        <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 text-xs text-primary hover:underline">
          {preview ? 'Replace thumbnail' : 'Choose file'}
        </button>
      )}
    </div>
  );
};

export default ThumbnailCropper;
