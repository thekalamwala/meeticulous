import { useState, useMemo, useRef, useEffect } from "react";
import { buildSeries } from "../utils/earningsSeries";
import { niceTicks, buildLinePath, buildAreaPath } from "../utils/chartGeometry";

const fmtMoney = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmtCount = (n) => Math.round(n).toLocaleString("en-IN");

const METRICS = [
  { key: "net", label: "Net earnings", fmt: fmtMoney },
  { key: "gross", label: "Gross revenue", fmt: fmtMoney },
  { key: "bookings", label: "Paid bookings", fmt: fmtCount },
  { key: "avg", label: "Avg booking", fmt: fmtMoney },
];
const RANGES = [3, 6, 12];

const fmtDelta = (d) =>
  d == null ? "—" : `${d >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(d * 100))}%`;

// SVG layout
const H = 240;
const PAD = { t: 12, r: 12, b: 26, l: 58 };

const EarningsTrendChart = ({ paid = [], now = new Date() }) => {
  const [metric, setMetric] = useState("net");
  const [range, setRange] = useState(6);
  const [hover, setHover] = useState(null);
  const [width, setWidth] = useState(640);
  const wrapRef = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const set = () => setWidth(el.clientWidth || 640);
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const series = useMemo(
    () => buildSeries(paid, range, now),
    [paid, range, now],
  );
  const active = METRICS.find((m) => m.key === metric);
  const { months } = series;
  const cur = series.series[metric].cur;
  const prev = series.series[metric].prev;

  const plotW = Math.max(width - PAD.l - PAD.r, 10);
  const plotH = H - PAD.t - PAD.b;
  const baseY = PAD.t + plotH;
  const ticks = niceTicks(Math.max(...cur, ...prev, 0));
  const domainMax = ticks[ticks.length - 1] || 1;

  const xFor = (i) =>
    months.length <= 1 ? PAD.l + plotW / 2 : PAD.l + (i / (months.length - 1)) * plotW;
  const yFor = (v) => baseY - (v / domainMax) * plotH;

  const curPts = cur.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
  const prevPts = prev.map((v, i) => ({ x: xFor(i), y: yFor(v) }));

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const rx = e.clientX - rect.left;
    const idx = Math.round((rx / rect.width) * (months.length - 1));
    setHover(Math.min(Math.max(idx, 0), months.length - 1));
  };

  return (
    <div className="fb-card p-5 mb-8">
      {/* Metric cards = KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {METRICS.map((m) => {
          const t = series.totals[m.key];
          const isOn = m.key === metric;
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={isOn}
              onClick={() => setMetric(m.key)}
              className={`text-left rounded-lg border p-3 transition-colors ${
                isOn
                  ? "border-primary bg-primary-light/40"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              style={{ borderBottomWidth: isOn ? 3 : 1 }}
            >
              <span className="block text-xs text-gray-400 mb-1">{m.label}</span>
              <span className="block text-xl font-bold text-gray-800">
                {m.fmt(t.cur)}
              </span>
              <span
                className={`block text-xs mt-1 ${
                  t.delta == null
                    ? "text-gray-400"
                    : t.delta >= 0
                      ? "text-green-600"
                      : "text-red-500"
                }`}
              >
                {fmtDelta(t.delta)}
                {t.delta != null && (
                  <span className="text-gray-400"> vs prev</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Range toggle + legend */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === range}
              onClick={() => setRange(r)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                r === range
                  ? "border-primary text-primary font-medium"
                  : "border-gray-200 text-gray-400 hover:text-gray-600"
              }`}
            >
              {r}M
            </button>
          ))}
        </div>
        <div className="flex gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-[3px] rounded bg-primary" />
            This period
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 border-t-2 border-dashed border-gray-400" />
            Previous
          </span>
        </div>
      </div>

      {/* Chart / empty state */}
      {!series.hasData ? (
        <div className="h-44 flex items-center justify-center text-center text-sm text-gray-400">
          No paid earnings yet — your first paid booking will show up here.
        </div>
      ) : (
        <div ref={wrapRef} className="relative w-full" style={{ height: H }}>
          <svg
            role="img"
            aria-label={`${active.label} over the last ${range} months, with previous-period comparison`}
            width={width}
            height={H}
            className="text-primary"
          >
            <defs>
              <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* gridlines + y labels */}
            <g className="text-gray-200">
              {ticks.map((t, i) => (
                <line
                  key={i}
                  x1={PAD.l}
                  x2={width - PAD.r}
                  y1={yFor(t)}
                  y2={yFor(t)}
                  stroke="currentColor"
                  strokeWidth="1"
                />
              ))}
            </g>
            <g className="text-gray-400">
              {ticks.map((t, i) => (
                <text
                  key={i}
                  x={PAD.l - 8}
                  y={yFor(t) + 3}
                  textAnchor="end"
                  fill="currentColor"
                  fontSize="11"
                >
                  {active.fmt === fmtCount ? fmtCount(t) : fmtMoney(t)}
                </text>
              ))}
            </g>

            {/* previous period (dashed) */}
            <path
              className="text-gray-400"
              d={buildLinePath(prevPts)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />

            {/* current period: area + line (brand orange via currentColor) */}
            <path d={buildAreaPath(curPts, baseY)} fill="url(#earnGrad)" stroke="none" />
            <path
              d={buildLinePath(curPts)}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* x labels */}
            <g className="text-gray-400">
              {months.map((mo, i) => (
                <text
                  key={mo.key}
                  data-x-label
                  x={xFor(i)}
                  y={H - 8}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="11"
                >
                  {mo.label}
                </text>
              ))}
            </g>

            {/* hover crosshair + dots */}
            {hover != null && (
              <g>
                <line
                  className="text-gray-300"
                  x1={xFor(hover)}
                  x2={xFor(hover)}
                  y1={PAD.t}
                  y2={baseY}
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <circle
                  cx={xFor(hover)}
                  cy={yFor(prev[hover])}
                  r="3"
                  className="text-gray-400"
                  fill="currentColor"
                />
                <circle
                  cx={xFor(hover)}
                  cy={yFor(cur[hover])}
                  r="4"
                  fill="currentColor"
                  stroke="#fff"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* pointer overlay */}
            <rect
              x={PAD.l}
              y={PAD.t}
              width={plotW}
              height={plotH}
              fill="transparent"
              style={{ touchAction: "none" }}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>

          {hover != null && (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm"
              style={{
                left: xFor(hover),
                top: yFor(cur[hover]),
                transform: "translate(-50%, -130%)",
                whiteSpace: "nowrap",
              }}
            >
              <div className="font-medium text-gray-700">
                {months[hover].labelLong}
              </div>
              <div className="text-primary">
                {active.label}: {active.fmt(cur[hover])}
              </div>
              <div className="text-gray-400">
                Prev: {active.fmt(prev[hover])}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EarningsTrendChart;
