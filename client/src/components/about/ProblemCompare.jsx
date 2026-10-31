import {
  MessageCircleMore,
  QrCode,
  Bell,
  Files,
  CalendarCheck,
  CreditCard,
  ChartColumnIncreasing,
  Check,
  Plus,
} from "lucide-react";
import { problem } from "./aboutContent";

/* "Why we built it" before/after: a scrappy paper card ("The old way") next to
   a crisp white app card ("A smoother way"). Both always show: side by side
   (slightly tilted, overlapping) on desktop, stacked on phones. (The Before /
   With Meeticulous switch was removed at the owner's request.)
   Rows come from problem.rows (pain → fix). No CSS transition on opacity /
   transform of the GSAP-revealed wrapper (.js-item) — see DifferenceSection. */

const PAIN_ICONS = [MessageCircleMore, QrCode, Bell, Files];
const FIX_ICONS = [CalendarCheck, CreditCard, Bell, ChartColumnIncreasing];

// Hand-drawn underline under each card title.
const Underline = ({ className = "" }) => (
  <svg viewBox="0 0 220 12" preserveAspectRatio="none" aria-hidden="true" className={className}>
    <path d="M3 8c40-5 90-6 140-4s55 2 74 0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

// "The old way" doodle (the without-Meeticulous card only): a buzzing phone
// with a 9+ badge, surrounded by chat, a scribble knot, a calendar, an
// envelope and a QR-code note — grey line art (the old way is all greys).
const ChaosDoodle = () => (
  <svg viewBox="0 0 300 150" aria-hidden="true" className="h-auto w-full">
    <g fill="none" stroke="#6B7280" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {/* chat bubble */}
      <path d="M22 44c0-11 9-19 22-19h12c13 0 22 8 22 19s-9 19-22 19h-9l-12 9v-9c-8-2-13-10-13-19z" fill="#fff" />
      <circle cx="40" cy="44" r="2" fill="#6B7280" />
      <circle cx="50" cy="44" r="2" fill="#6B7280" />
      <circle cx="60" cy="44" r="2" fill="#6B7280" />
      {/* scribble knot */}
      <path d="M128 30c-14 2-18 14-8 20 12 7 30-4 22-14-7-9-26-2-24 10 1 9 18 12 26 3 6-7-2-17-12-15-9 2-12 12-4 15" />
      <path d="M118 52c4 6 8 9 14 10M146 50c-2 6-6 10-12 12" opacity=".7" />
      {/* calendar */}
      <rect x="222" y="22" width="48" height="42" rx="6" fill="#fff" />
      <path d="M222 34h48M234 16v12M258 16v12" />
      <path d="M232 44h6M244 44h6M256 44h6M232 54h6M244 54h6" strokeWidth="3" />
      {/* envelope */}
      <rect x="226" y="88" width="54" height="36" rx="5" fill="#fff" transform="rotate(-8 253 106)" />
      <path d="M229 94l25 17 24-21" transform="rotate(-8 253 106)" />
      {/* phone with a 9+ notification badge */}
      <rect x="118" y="70" width="58" height="76" rx="9" fill="#fff" />
      <path d="M140 78h14" />
      <path d="M128 96h38M128 108h30M128 120h34" opacity=".55" />
      <circle cx="176" cy="72" r="11" fill="#4B5563" stroke="#4B5563" />
      <text x="176" y="76" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" stroke="none" fontFamily="Poppins, sans-serif">9+</text>
      {/* buzz lines */}
      <path d="M106 86l-8-4M104 100h-10M106 114l-8 4M188 96l8-3M190 110h9" />
      {/* QR code sticky note */}
      <rect x="40" y="88" width="44" height="44" rx="4" fill="#fff" transform="rotate(6 62 110)" />
      <path d="M50 98h8v8h-8zM66 98h8v8h-8zM50 114h8v8h-8zM66 114h3M72 114v3M66 120h8" transform="rotate(6 62 110)" />
    </g>
  </svg>
);

// "A smoother way" mini app: bookings week view + a payment toast.
const MiniDashboard = () => (
  <div className="relative">
    <div className="overflow-hidden rounded-[6px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.06)]">
      <div className="flex gap-1.5 border-b border-black/5 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#FF5F57]" />
        <span className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
        <span className="h-2 w-2 rounded-full bg-[#28C840]" />
      </div>
      <div className="flex">
        <div className="hidden w-14 flex-col items-center gap-2 border-r border-black/5 py-3 sm:flex">
          <span className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-primary text-xs font-extrabold text-white">M</span>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-1.5 w-7 rounded-full bg-black/[0.06]" />
          ))}
        </div>
        <div className="flex-1 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">Bookings</span>
            <span className="inline-flex items-center gap-0.5 rounded-[4px] bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-white">
              <Plus size={9} strokeWidth={3} /> New booking
            </span>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[9px] text-ink/50">
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="relative mt-1 grid h-20 grid-cols-5 gap-1 lg:h-14">
            {[0, 1, 2, 3, 4].map((c) => (
              <span key={c} className="rounded-[3px] bg-[repeating-linear-gradient(to_bottom,transparent_0_19px,rgba(0,0,0,0.05)_19px_20px)]" />
            ))}
            {/* booked slots */}
            <span className="absolute left-[20.5%] top-[20%] h-[18%] w-[18%] rounded-[3px] bg-primary/25" />
            <span className="absolute left-[41%] top-[62%] h-[18%] w-[18%] rounded-[3px] bg-primary/40" />
            <span className="absolute left-[61.5%] top-[36%] h-[18%] w-[18%] rounded-[3px] bg-primary/15" />
            <span className="absolute left-[82%] top-[8%] h-[18%] w-[18%] rounded-[3px] bg-primary/30" />
          </div>
        </div>
      </div>
    </div>
    {/* payment toast */}
    <div className="absolute -right-3 top-1/2 flex items-center gap-1.5 rounded-[6px] border border-black/5 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink shadow-[0_12px_30px_-10px_rgba(26,26,26,0.35)] sm:-right-6">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
        <Check size={10} strokeWidth={3.5} />
      </span>
      Payment received
    </div>
  </div>
);

// Pain rows (the old way) are all greys; fix rows (a smoother way) use brand crimson.
function Row({ Icon, title, body, tone }) {
  const pain = tone === "pain";
  const tile = pain ? "bg-neutral-200 text-neutral-500" : "bg-primary/10 text-primary";
  return (
    <li className={`flex items-start gap-3.5 border-b py-3 last:border-0 lg:gap-3 lg:py-2 ${pain ? "border-neutral-200" : "border-black/5"}`}>
      <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full lg:h-8 lg:w-8 ${tile}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <span>
        <span className={`block text-[15px] font-semibold leading-snug lg:text-sm ${pain ? "text-neutral-700" : "text-ink"}`}>{title}</span>
        <span className={`mt-0.5 block text-sm leading-snug lg:text-[13px] ${pain ? "text-neutral-500" : "text-ink/60"}`}>{body}</span>
      </span>
    </li>
  );
}

export default function ProblemCompare() {
  return (
    <div className="js-item">
      <div className="relative grid gap-8 lg:grid-cols-2 lg:gap-0">
        {/* The old way */}
        <div className="relative z-10 lg:-rotate-[3deg]">
          {/* lg:h-full + flex column: stretches to the row height so its bottom lines up
              with "A smoother way" (which sits lower via lg:mt-3); rows spread evenly. */}
          <div className="relative flex flex-col rounded-[6px] border border-neutral-200 bg-neutral-100 px-5 pb-4 pt-8 shadow-[0_24px_60px_-28px_rgba(26,26,26,0.35)] sm:px-6 lg:mr-[-12px] lg:h-full lg:pb-2 lg:pt-6">
            <span aria-hidden className="absolute -top-3 left-1/2 h-7 w-24 -translate-x-1/2 -rotate-2 rounded-[2px] bg-neutral-300/80" />
            <h3 className="text-center font-display text-2xl font-extrabold italic text-neutral-600 lg:text-xl">The old way</h3>
            <Underline className="mx-auto mt-1 h-2.5 w-36 text-neutral-400" />
            <div className="mx-auto mt-4 max-w-[300px] lg:mt-2 lg:max-w-[210px]">
              <ChaosDoodle />
            </div>
            <ul className="mt-3 lg:mt-1 lg:flex lg:flex-1 lg:flex-col lg:justify-evenly">
              {problem.rows.map((r, i) => (
                <Row key={r.painTitle} Icon={PAIN_ICONS[i]} title={r.painTitle} body={r.pain} tone="pain" />
              ))}
            </ul>
          </div>
        </div>

        {/* A smoother way */}
        <div className="relative z-20 lg:mt-3 lg:rotate-[2deg]">
          <div className="relative rounded-[6px] border border-primary/15 bg-white px-5 pb-4 pt-7 shadow-[0_24px_60px_-28px_rgba(26,26,26,0.35)] sm:px-6 lg:ml-[-12px] lg:h-full lg:pb-2 lg:pt-5">
            <div className="relative text-center">
              <h3 className="font-display text-2xl font-extrabold italic text-primary lg:text-xl">A smoother way</h3>
              <Underline className="mx-auto mt-1 h-2.5 w-44 text-primary" />
            </div>
            <div className="mt-5 lg:mt-3">
              <MiniDashboard />
            </div>
            <ul className="mt-3 lg:mt-1">
              {problem.rows.map((r, i) => (
                <Row key={r.fixTitle} Icon={FIX_ICONS[i]} title={r.fixTitle} body={r.fix} tone="fix" />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
