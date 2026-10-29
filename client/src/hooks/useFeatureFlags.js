import { useEffect, useState } from 'react';
import { getFeatureFlags } from '../services/api';

let _cache = null;

export function _resetFlagCache() { _cache = null; } // test helper

export default function useFeatureFlags() {
  const [flags, setFlags] = useState(_cache || {});
  useEffect(() => {
    if (_cache) return;
    getFeatureFlags()
      .then(({ data }) => { _cache = data || {}; setFlags(_cache); })
      .catch(() => { /* fail-open: on() treats missing as enabled */ });
  }, []);
  // Fail-open default: a key we don't know about is treated as enabled.
  const on = (key) => (key in flags ? flags[key] : true);
  return { flags, on };
}
