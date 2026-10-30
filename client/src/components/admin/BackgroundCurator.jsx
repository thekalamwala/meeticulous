import { BACKGROUNDS } from '../../backgrounds/registry';
import HostBackground from '../../backgrounds/HostBackground';

const SAMPLE = '#960D32'; // platform accent — shows motion to admin

export default function BackgroundCurator({ value, onChange }) {
  const backgrounds = value?.backgrounds || {};
  const def = value?.default_background || null;

  const patch = (key, next) =>
    onChange({
      default_background: def,
      backgrounds: { ...backgrounds, [key]: { enabled: false, order: 0, params: {}, ...backgrounds[key], ...next } },
    });

  const setDefault = (key) => onChange({ backgrounds, default_background: key });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {BACKGROUNDS.map((b) => {
        const cfg = backgrounds[b.key] || { enabled: false, params: {} };
        const params = { ...b.defaultParams, ...(cfg.params || {}) };
        return (
          <div key={b.key} className="rounded-xl border border-gray-200 p-4">
            <div className="relative h-28 mb-3 overflow-hidden rounded-lg bg-gray-50">
              <HostBackground typeKey={b.key} color={SAMPLE} params={params} />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900">{b.label}</span>
              {b.seasonal && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Seasonal</span>}
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={`Enable ${b.label}`}
                checked={!!cfg.enabled}
                onChange={(e) => patch(b.key, { enabled: e.target.checked })}
              />
              Enabled
            </label>
            {b.paramSchema.map((p) => (
              <label key={p.key} className="mt-2 flex items-center justify-between gap-2 text-sm">
                {p.label}
                <select
                  value={params[p.key] ?? p.options[0]}
                  onChange={(e) => patch(b.key, { params: { ...params, [p.key]: e.target.value } })}
                  className="rounded border-gray-300 text-sm">
                  {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            ))}
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="default-bg"
                checked={def === b.key}
                disabled={!cfg.enabled}
                onChange={() => setDefault(b.key)}
              />
              Default
            </label>
          </div>
        );
      })}
    </div>
  );
}
