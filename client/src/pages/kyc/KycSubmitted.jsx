import { Video } from 'lucide-react';

// Kept: white card, the Money/KYC mascot, one action. Same video-KYC link as before.
export default function KycSubmitted() {
  return (
    <section className="flex flex-col items-center rounded-[24px] bg-white px-6 py-10 text-center">
      <img src="/about/mascot-orange.png" alt="" className="h-24 w-24 object-contain" />
      <h2 className="mb-0 mt-3 font-display text-[20px] font-bold tracking-[-0.02em] text-ink sm:text-[22px]">Sent for review</h2>
      <p className="mb-6 mt-2 max-w-sm text-[14px] text-muted">
        We&apos;re checking your details. A short video KYC call gets you approved faster.
        Payouts switch on once you&apos;re verified.
      </p>
      <a href="/contact"
        className="inline-flex h-12 w-full max-w-xs select-none items-center justify-center gap-2 rounded-[12px] bg-maroon px-5 text-[15px] font-semibold text-white transition-colors [-webkit-touch-callout:none] hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
        <Video className="h-4 w-4" strokeWidth={2.2} />Book a video KYC call
      </a>
    </section>
  );
}
