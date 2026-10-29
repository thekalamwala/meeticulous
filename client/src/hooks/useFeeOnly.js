import { useState, useEffect } from 'react';

/**
 * useFeeOnly — reads the platform's interim "fee-only" flag from the public config
 * endpoint, so BOTH logged-in and logged-out (marketing) pages can gate interim UI:
 * softened "payments launching soon" copy and the hidden free plan.
 *
 * Single source of truth = platform_settings.fee_only_mode (DB). Flip it false on
 * Razorpay Route go-live and every gated surface reverts automatically (a redeploy
 * re-bakes prerendered/SEO copy). Module-cached: one fetch per page load, shared.
 *
 * Defaults TRUE until the value is known — fail-safe toward the interim wording.
 */

let _cache; // undefined = not fetched; then boolean
let _inflight;

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function useFeeOnly() {
  const [feeOnly, setFeeOnly] = useState(_cache ?? true);

  useEffect(() => {
    if (_cache !== undefined) { setFeeOnly(_cache); return; }
    let alive = true;
    _inflight = _inflight || fetch(`${API}/config/public`)
      .then((r) => r.json())
      .then((d) => { _cache = d?.feeOnlyMode !== false; return _cache; })
      .catch(() => { _cache = true; return true; }); // fail-safe interim
    _inflight.then((v) => { if (alive) setFeeOnly(v); });
    return () => { alive = false; };
  }, []);

  return feeOnly;
}
