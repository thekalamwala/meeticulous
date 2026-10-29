/**
 * chartGeometry.js
 * Pure SVG geometry helpers for the Earnings trend chart. No React.
 */

const round = (n) => Math.round(n * 100) / 100;
const roundTick = (n) => Math.round(n * 10000) / 10000;

/**
 * 1-2-5 "nice" axis ticks from 0 up to >= max, with `count` intervals.
 * niceTicks(0) -> [0, 1] to avoid a degenerate zero-height domain.
 */
export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const rawStep = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const unit = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  const step = unit * mag;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= niceMax + step / 2; v += step) ticks.push(roundTick(v));
  return ticks;
}

// Fritsch–Carlson monotone tangents — smooth curve that never overshoots the
// data, so earnings never visually dip below the lowest point (or 0).
function monotoneTangents(pts) {
  const n = pts.length;
  const d = []; // secant slopes
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    d.push(dx === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx);
  }
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
  }
  return m;
}

/**
 * Smooth (monotone cubic) line path through points, passing exactly through
 * each data point. points = [{x, y}] in pixel space.
 */
export function buildLinePath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${round(points[0].x)} ${round(points[0].y)}`;
  const m = monotoneTangents(points);
  let path = `M ${round(points[0].x)} ${round(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = p1.x - p0.x;
    const c1x = p0.x + dx / 3;
    const c1y = p0.y + (m[i] * dx) / 3;
    const c2x = p1.x - dx / 3;
    const c2y = p1.y - (m[i + 1] * dx) / 3;
    path += ` C ${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(p1.x)} ${round(p1.y)}`;
  }
  return path;
}

/**
 * Filled area: the line, then closed down to `baselineY` and back.
 */
export function buildAreaPath(points, baselineY) {
  if (!points || points.length === 0) return '';
  const line = buildLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${round(last.x)} ${round(baselineY)} L ${round(first.x)} ${round(baselineY)} Z`;
}
