import { useState, useEffect } from 'react';
import { getMyKyc, getMyServices } from '../../services/api';
import DashboardKycBanner from './DashboardKycBanner';

/**
 * KycNudgeStrip — the host KYC banner, self-fetching, for use in the dashboard
 * layout so the nudge reaches EVERY host page (not just the Overview home, which
 * renders DashboardKycBanner inline). Fetches its own KYC + services; on any
 * error it stays hidden (the banner returns null when there's nothing to show).
 */
export default function KycNudgeStrip() {
  const [kyc, setKyc] = useState(null);
  const [hasPaidService, setHasPaidService] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getMyKyc(), getMyServices()])
      .then(([k, s]) => {
        if (!alive) return;
        setKyc(k?.data ?? null);
        const svcs = Array.isArray(s?.data) ? s.data : [];
        setHasPaidService(svcs.some((x) => Number(x.price) > 0 && !x.price_on_request));
      })
      .catch(() => { /* non-blocking: banner stays hidden on error */ });
    return () => { alive = false; };
  }, []);

  return <DashboardKycBanner kyc={kyc} hasPaidService={hasPaidService} />;
}
