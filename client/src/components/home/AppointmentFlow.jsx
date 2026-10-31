import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Link2,
  CalendarX2,
  Clock,
  CreditCard,
  Wallet,
  Receipt,
  BadgeCheck,
  Video,
  Settings2,
  MessageCircle,
  Mail,
  CalendarCheck,
} from "lucide-react";
import { FLOW_ILLUSTRATIONS } from "./illustrations/FlowIllustrations";

const EASE = [0.22, 1, 0.36, 1];

/* "Everything around the appointment" — a horizontal row of four text cards
   (Calendly-style). Hovering (or focusing / tapping) a card widens it to show
   its description and a connected list of what happens; the rest stay narrow
   with a title and one line. Every event is a shipped capability (booking
   page, Google Calendar busy-time sync, Razorpay, GST invoice, Meet link,
   manage-booking link, WhatsApp + email reminders). */
export const FLOW_STEPS = [
  {
    key: "book",
    title: "Book",
    short: "Clients pick a service and a time.",
    desc: "A client taps your link, chooses a service and picks a slot. Only the times you're actually free show up.",
    events: [
      { icon: Link2, text: "Client opens your link from your bio", color: "var(--c-pink)" },
      { icon: CalendarX2, text: "Busy times from Google Calendar hidden", color: "var(--c-violet)" },
      { icon: Clock, text: "Client picks Tuesday at 11:00 AM", color: "var(--c-blue)" },
    ],
    tint: "var(--c-pink)",
  },
  {
    key: "pay",
    title: "Pay",
    short: "Paid upfront, before the session.",
    desc: "Clients pay by UPI, card or netbanking through Razorpay at checkout, so every slot on your calendar is already paid for.",
    events: [
      { icon: CreditCard, text: "Checkout: UPI, card or netbanking", color: "var(--c-blue)" },
      { icon: Wallet, text: "Client pays upfront", color: "var(--c-emerald)" },
      { icon: Receipt, text: "GST invoice generated automatically", color: "var(--c-amber)" },
    ],
    tint: "var(--c-emerald)",
  },
  {
    key: "confirm",
    title: "Get confirmation",
    short: "Confirmed for both of you, instantly.",
    desc: "You and your client get an instant confirmation, and the session lands on your Google Calendar.",
    events: [
      { icon: BadgeCheck, text: "Booking confirmed for both of you", color: "var(--c-emerald)" },
      { icon: Video, text: "Added to Google Calendar with a Meet link", color: "var(--c-blue)" },
      { icon: Settings2, text: "Client gets a link to manage the booking", color: "var(--c-violet)" },
    ],
    tint: "var(--c-blue)",
  },
  {
    key: "remind",
    title: "Get reminders",
    short: "Reminders go out on their own.",
    desc: "Automatic WhatsApp and email reminders go out before the session, so nobody forgets and you never have to chase.",
    events: [
      { icon: MessageCircle, text: "WhatsApp reminder sent", color: "var(--c-emerald)" },
      { icon: Mail, text: "Email reminder with session details", color: "var(--c-amber)" },
      { icon: CalendarCheck, text: "Session starts. Nothing to chase.", color: "var(--c-pink)" },
    ],
    tint: "var(--c-amber)",
  },
];

const AUTO_MS = 6000;

export default function AppointmentFlow() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // Hover-to-widen only exists on lg+ (side-by-side row with a fixed height),
  // so opening a card changes its WIDTH only. Below lg the cards stack and
  // every card is shown fully expanded — nothing toggles, so no height jumps.
  // Starts true to match the prerendered markup; corrected after mount (the
  // section is below the fold, so the switch is never visible).
  const [isRow, setIsRow] = useState(true);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsRow(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    window.addEventListener("resize", on); // fallback where "change" doesn't fire
    return () => {
      mq.removeEventListener?.("change", on);
      window.removeEventListener("resize", on);
    };
  }, []);

  // Auto-advance until the visitor interacts (hover, focus or tap) — row layout only.
  useEffect(() => {
    if (reduce || paused || !isRow) return;
    const id = setInterval(() => setActive((a) => (a + 1) % FLOW_STEPS.length), AUTO_MS);
    return () => clearInterval(id);
  }, [reduce, paused, isRow]);

  const open = (i) => {
    if (!isRow) return;
    setPaused(true);
    setActive(i);
  };
  const hoverTimer = useRef(null);
  const hoverOpen = (i) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => open(i), 90);
  };
  const hoverCancel = () => clearTimeout(hoverTimer.current);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  return (
    <div className="flex flex-col gap-3 lg:h-[30rem] lg:flex-row lg:gap-4">
      {FLOW_STEPS.map((s, i) => {
        const on = isRow ? i === active : true;
        const Art = FLOW_ILLUSTRATIONS[s.key];
        return (
          <div
            key={s.key}
            role={isRow ? "button" : undefined}
            tabIndex={isRow ? 0 : undefined}
            aria-expanded={isRow ? on : undefined}
            aria-label={isRow ? `${s.title}: ${s.short}` : undefined}
            onMouseEnter={() => hoverOpen(i)}
            onMouseLeave={hoverCancel}
            onFocus={() => open(i)}
            onClick={() => open(i)}
            className={`group relative flex min-w-0 cursor-default flex-col overflow-hidden rounded-[10px] border border-black/5 bg-white text-left shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-[flex-grow,box-shadow] duration-[650ms] ease-[cubic-bezier(0.65,0,0.35,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none lg:basis-0 ${
              on ? "shadow-[0_24px_60px_-28px_rgba(26,26,26,0.25)] lg:grow-[2.4]" : "lg:grow"
            }`}
          >
            <div className="relative z-10 p-6 sm:p-7">
              <h3
                className={`font-heading text-xl font-bold tracking-tight transition-colors duration-500 sm:text-2xl lg:text-[1.375rem] xl:text-2xl ${
                  on ? "text-ink" : "text-ink/75"
                }`}
              >
                {s.title}
              </h3>

              <div className="relative mt-3">
                {/* Short line — shown on closed cards (row layout only) */}
                {isRow && (
                  <p
                    aria-hidden={on}
                    className={`text-sm leading-relaxed text-neutral-500 transition-opacity duration-300 motion-reduce:transition-none sm:text-[15px] ${
                      on ? "opacity-0" : "opacity-100 delay-200"
                    }`}
                  >
                    {s.short}
                  </p>
                )}

                {/* Full story — fixed width on the row so text never re-wraps mid-animation;
                    fades/slides in just after the card starts widening. */}
                <div
                  aria-hidden={isRow ? !on : undefined}
                  className={`${isRow ? "absolute inset-x-0 top-0 lg:w-[19rem] xl:w-[22rem]" : ""} transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
                    on ? "translate-y-0 opacity-100 delay-200" : "pointer-events-none translate-y-1 opacity-0"
                  }`}
                >
                  <p className="text-sm leading-relaxed text-neutral-500 sm:text-[15px]">{s.desc}</p>
                  <ol className="relative mt-6 space-y-4">
                    {/* connector line behind the event icons */}
                    <span aria-hidden className="absolute bottom-3 left-3 top-3 w-px bg-black/10" />
                    {s.events.map((ev, k) => (
                      <li
                        key={ev.text}
                        style={{ transitionDelay: on && !reduce ? `${300 + k * 90}ms` : "0ms" }}
                        className={`relative flex items-center gap-3 text-sm text-neutral-600 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none sm:text-[15px] ${
                          on ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
                        }`}
                      >
                        <span
                          className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ring-4 ring-white"
                          style={{ backgroundColor: `color-mix(in srgb, ${ev.color} 18%, white)`, color: ev.color }}
                        >
                          <ev.icon size={13} />
                        </span>
                        {ev.text}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            {/* Line illustration in the blank space below the text (bottom-right).
                In normal flow with mt-auto, so it can never overlap the text.
                ONE fixed size per breakpoint, open or closed — hovering never
                resizes it (sized to fit the narrow closed card on the row). */}
            {Art && (
              <div className={`relative z-10 mt-auto justify-end px-5 pb-5 ${on ? "flex" : "hidden lg:flex"}`}>
                <Art
                  accent={s.tint}
                  className="h-auto w-40 flex-shrink-0 lg:w-[7.75rem] xl:w-[9.5rem]"
                />
              </div>
            )}

            {/* Soft colour glow at the bottom — decorative, brighter on the open card */}
            <span
              aria-hidden
              className={`pointer-events-none absolute -bottom-24 left-1/2 hidden h-64 w-64 -translate-x-1/2 rounded-full blur-2xl transition-opacity duration-[650ms] lg:block ${on ? "opacity-90" : "opacity-50"}`}
              style={{ background: `radial-gradient(circle, color-mix(in srgb, ${s.tint} 30%, white), transparent 70%)` }}
            />

            {/* Auto-advance progress */}
            {isRow && on && !reduce && !paused && (
              <motion.span
                key={`bar-${active}`}
                aria-hidden
                className="absolute left-0 top-0 z-20 h-[3px] bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: AUTO_MS / 1000, ease: "linear" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
