import { useEffect, useRef, useState } from "react";
import { Puff, Mira, Ribbit, Biscuit, Tick, Snail, DOODLES } from "./doodleArt";
import "./doodleWordmark.css";

/* Footer signature: "Meeticulous" in chalky dry-brush letters on the dark
   footer, with a crew of original doodle creatures living on the letters and
   pastel doodles drifting down behind them.

   Behaviour
   - Letters stamp in one by one (and a chalk baseline draws) the first time the
     footer scrolls into view. Without JS / IntersectionObserver they simply
     show — the "armed" class that hides them is only added on mount.
   - Idle: creatures blink, bob, peck and peek; the snail crawls the baseline.
   - Click a creature → it hops and says a line. Click a doodle → it pops and
     falls again from the top. Hover a letter → it jiggles.
   - prefers-reduced-motion: everything renders static (see the CSS).
   Purely decorative: the whole block is aria-hidden; the real brand name and
   links live in Footer.jsx. */

const WORD = "Meeticulous";

// Which creature lives on which letter, where it sits (em, relative to the
// letter box) and what it says when clicked.
const CREW = {
  0: { key: "puff", Art: Puff, line: "Booked solid. Literally.", style: { left: "-0.01em", bottom: "0.78em", width: "0.58em" } },
  // Mira sits on the x-height with her legs dangling over the letter's face
  2: { key: "mira", Art: Mira, line: "Paid before class? Love it.", style: { left: "0.03em", bottom: "0.41em", width: "0.44em" } },
  // `behind`: drawn behind its letter, so it gets a separate click target on top
  5: { key: "ribbit", Art: Ribbit, line: "No-shows? Not on my lily pad.", style: { left: "0.02em", bottom: "0.56em", width: "0.42em" }, behind: true },
  // Biscuit naps across the top of the "l", tail hanging down its side
  7: { key: "biscuit", Art: Biscuit, line: "Wake me for the next booking.", style: { left: "-0.24em", bottom: "0.72em", width: "0.62em" } },
  10: { key: "tick", Art: Tick, line: "Reminder sent. Beep boop.", style: { left: "-0.02em", bottom: "0.6em", width: "0.42em" } },
};
const SNAIL = { key: "snail", line: "Even I’m on time now." };

// Drifting doodles: horizontal position (%), size (em), fall duration + delay (s).
const DRIFT = [
  { id: 1, kind: "star", x: 4, size: 0.16, dur: 15, delay: -2 },
  { id: 2, kind: "calendar", x: 14, size: 0.15, dur: 18, delay: -9 },
  { id: 3, kind: "heart", x: 23, size: 0.13, dur: 14, delay: -5 },
  { id: 4, kind: "coin", x: 33, size: 0.15, dur: 17, delay: -13 },
  { id: 5, kind: "spark", x: 42, size: 0.12, dur: 13, delay: -1 },
  { id: 6, kind: "clock", x: 51, size: 0.15, dur: 19, delay: -7 },
  { id: 7, kind: "chat", x: 60, size: 0.15, dur: 16, delay: -11 },
  { id: 8, kind: "star", x: 69, size: 0.12, dur: 14, delay: -4 },
  { id: 9, kind: "heart", x: 77, size: 0.14, dur: 18, delay: -15 },
  { id: 10, kind: "calendar", x: 85, size: 0.13, dur: 15, delay: -8 },
  { id: 11, kind: "spark", x: 93, size: 0.14, dur: 17, delay: -3 },
  { id: 12, kind: "coin", x: 97, size: 0.12, dur: 20, delay: -12 },
];

function Critter({ crew, talking, onTalk, children }) {
  return (
    <span
      className={`dw-critter dw-critter--${crew.key}${talking ? " is-talking" : ""}`}
      style={crew.style}
      onClick={(e) => {
        e.stopPropagation();
        onTalk(crew.key);
      }}
    >
      <span className="dw-critter-body">{children}</span>
      {talking && <span className="dw-bubble">{crew.line}</span>}
    </span>
  );
}

export default function DoodleWordmark() {
  const ref = useRef(null);
  const [armed, setArmed] = useState(false);
  const [inView, setInView] = useState(false);
  const [talking, setTalking] = useState(null);
  const [popped, setPopped] = useState(null);
  const [gen, setGen] = useState({});
  const talkTimer = useRef();
  const popTimer = useRef();

  // Stamp the letters in the first time the footer is on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }
    setArmed(true);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => () => {
    clearTimeout(talkTimer.current);
    clearTimeout(popTimer.current);
  }, []);

  const talk = (key) => {
    clearTimeout(talkTimer.current);
    setTalking(key);
    talkTimer.current = setTimeout(() => setTalking(null), 2400);
  };

  const pop = (id) => {
    if (popped === id) return;
    setPopped(id);
    clearTimeout(popTimer.current);
    // After the pop, remount the doodle (new key) so it falls again from the top.
    popTimer.current = setTimeout(() => {
      setGen((g) => ({ ...g, [id]: (g[id] || 0) + 1 }));
      setPopped(null);
    }, 420);
  };

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`dw${armed ? " is-armed" : ""}${inView ? " is-in" : ""}`}
    >
      {/* Chalk texture: speckled holes + a slightly rough edge */}
      <svg className="dw-defs" width="0" height="0" focusable="false">
        <filter id="dw-chalk" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="7" result="noise" />
          {/* alpha = 19 − 25·noise: a sharp cut-off, so only the brightest noise
              peaks punch small chalk flecks out of otherwise solid letters */}
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -25 19" result="holes" />
          <feComposite in="SourceGraphic" in2="holes" operator="in" result="speckled" />
          <feDisplacementMap in="speckled" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Phones: the same chalk, scaled down for small letters (fewer flecks,
            barely-rough edges) — swapped in by the CSS media query */}
        <filter id="dw-chalk-sm" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -25 20.5" result="holes" />
          <feComposite in="SourceGraphic" in2="holes" operator="in" result="speckled" />
          <feDisplacementMap in="speckled" in2="noise" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <div className="dw-stage">
        <div className="dw-doodles">
          {DRIFT.map((dd) => (
            <span
              key={`${dd.id}-${gen[dd.id] || 0}`}
              className={`dw-doodle${popped === dd.id ? " is-popped" : ""}`}
              style={{
                left: `${dd.x}%`,
                width: `${dd.size}em`,
                height: `${dd.size}em`,
                animationDuration: `${dd.dur}s`,
                animationDelay: gen[dd.id] ? "0s" : `${dd.delay}s`,
              }}
              onClick={() => pop(dd.id)}
            >
              <span className="dw-doodle-in">{DOODLES[dd.kind]}</span>
            </span>
          ))}
        </div>

        <p className="dw-word">
          {WORD.split("").map((ch, i) => {
            const crew = CREW[i];
            return (
              <span key={i} className="dw-letter" style={{ "--i": i }}>
                <span className="dw-glyph">{ch}</span>
                {crew && (
                  <Critter crew={crew} talking={talking === crew.key} onTalk={talk}>
                    <crew.Art />
                  </Critter>
                )}
                {crew?.behind && (
                  // The letter's box covers a creature drawn behind it, so this
                  // transparent hit area sits on top and forwards the click.
                  <span className="dw-hit" style={crew.style} onClick={() => talk(crew.key)} />
                )}
              </span>
            );
          })}
        </p>

        <svg className="dw-baseline" viewBox="0 0 1000 12" preserveAspectRatio="none" focusable="false">
          <path d="M4 7c80-3 150 2 240 0s170-4 260-1 170 3 250 0 160-2 242 1" pathLength="1" />
        </svg>

        <span
          className={`dw-snail${talking === SNAIL.key ? " is-talking" : ""}`}
          onClick={() => talk(SNAIL.key)}
        >
          <span className="dw-critter-body">
            <Snail />
          </span>
          {talking === SNAIL.key && <span className="dw-bubble">{SNAIL.line}</span>}
        </span>
      </div>
    </div>
  );
}
