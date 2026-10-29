// Microsoft Clarity adapter. Clarity is QUALITATIVE only — heatmaps + session
// replay, viewed in Clarity's own dashboard. It has no quantitative event API we
// integrate into our KPIs, so track()/page() are intentionally thin: we only push
// identify + custom tags so replays are filterable by user/role/event in Clarity.
const PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID;

let loaded = false;
const q = (...args) => { try { window.clarity?.(...args); } catch (_) {} };

export default {
  name: 'clarity',
  needsConsent: true,
  init() {
    if (loaded || !PROJECT_ID || typeof window === 'undefined') return;
    loaded = true;
    /* eslint-disable */
    (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,'clarity','script',PROJECT_ID);
    /* eslint-enable */
  },
  identify(id, props = {}) {
    // custom-id + friendly fields so sessions are searchable in Clarity.
    q('identify', String(id), undefined, undefined, props.name);
    if (props.role) q('set', 'role', String(props.role));
    if (props.plan) q('set', 'plan', String(props.plan));
  },
  track(event) { q('event', event); },
  page() { /* Clarity tracks navigation itself */ },
};
