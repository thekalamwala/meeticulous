// loadRazorpay — lazily inject the Razorpay Checkout script on demand.
//
// The <script> used to sit in index.html and load on EVERY page (render-blocking,
// ~public-page bloat) even though only checkout flows need it. Call this right
// before `new window.Razorpay(...)` instead. Idempotent: resolves instantly if the
// SDK is already present, and never injects the tag more than once.
//
//   const ok = await loadRazorpay();
//   if (!ok) { toast.error('Payment unavailable, please retry'); return; }
//   new window.Razorpay(options).open();

const SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let promise = null;

export default function loadRazorpay() {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(true);
  if (promise) return promise;

  promise = new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => { promise = null; resolve(false); });
      if (window.Razorpay) resolve(true);
      return;
    }
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => { promise = null; resolve(false); };
    document.body.appendChild(s);
  });
  return promise;
}
