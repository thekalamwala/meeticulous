import { useEffect, useRef } from 'react';

// draw(ctx, t, dims) — t = seconds since mount; dims = {w,h}. init(dims) optional.
export default function useBackgroundCanvas({ init, draw }) {
  const canvasRef = useRef(null);
  const state = useRef({ raf: 0, start: 0, dims: { w: 0, h: 0 } });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let alive = true;

    const resize = () => {
      const { width, height } = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.current.dims = { w: width, h: height };
      init && init(state.current.dims);
    };

    const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    ro ? ro.observe(parent) : window.addEventListener('resize', resize);
    resize();

    const loop = (ts) => {
      if (!alive) return;
      if (!state.current.start) state.current.start = ts;
      const t = (ts - state.current.start) / 1000;
      const fade = Math.min(1, t / 0.8); // 0.8s ease-in
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = fade;
      draw(ctx, t, state.current.dims);
      ctx.globalAlpha = 1;
      state.current.raf = requestAnimationFrame(loop);
    };
    state.current.raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(state.current.raf);
      ro ? ro.disconnect() : window.removeEventListener('resize', resize);
    };
  }, [init, draw]);

  return canvasRef;
}
