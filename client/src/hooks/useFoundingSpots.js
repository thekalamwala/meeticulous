import { useEffect, useState } from 'react';
import { getFoundingSpots } from '../services/api';

// "X of 100 founding spots left" — one fetch per page load, shared by every
// caller. Resolves to null on error or once the offer is closed, so callers just
// render nothing (never a wrong number).
let _promise = null;
const load = () => {
  if (!_promise) {
    _promise = Promise.resolve()
      .then(() => getFoundingSpots())
      .then((r) => (r.data?.open ? r.data : null))
      .catch(() => null);
  }
  return _promise;
};

export default function useFoundingSpots() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let live = true;
    load().then((s) => { if (live) setStatus(s); });
    return () => { live = false; };
  }, []);
  return status;
}
