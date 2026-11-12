import { useEffect, useRef, useState } from "react";
import { DOODLES } from "./doodleArt";
import "./doodleWordmark.css";

/* Footer signature: "Meeticulous" in chalky dry-brush letters on the dark
   footer, with four mascot images (client/public/home/footer1–4.png) living on
   the letters and pastel doodles drifting down behind them.

   Behaviour
   - Letters stamp in one by one the first time the footer scrolls into view.
     Without JS / IntersectionObserver they simply show — the "armed" class
     that hides them is only added on mount.
   - Idle: creatures blink, bob, peck and peek.
   - Click a creature → it hops and says a line. Click a doodle → it pops and
     falls again from the top. Hover a letter → it jiggles.
   - prefers-reduced-motion: everything renders static (see the CSS).
   Purely decorative: the whole block is aria-hidden; the real brand name and
   links live in Footer.jsx. */

const WORD = "Meeticulous";

// Which mascot image sits on which letter, where it sits (em, relative to the
// letter box) and what it says when clicked.
const CREW = {
  // M — wide cap; the mascot is as wide as the letter, centred on its box
  0: {
    key: "m1",
    src: "/home/footer1.png",
    line: "Booked solid. Literally.",
    style: { left: "-0.02em", bottom: "0.72em", width: "0.95em" },
  },
  // second "e"
  2: {
    key: "m2",
    src: "/home/footer2.png",
    line: "Paid before class? Love it.",
    style: { left: "-0.1em", bottom: "0.6em", width: "0.74em" },
  },
  // first "u"
  6: {
    key: "m3",
    src: "/home/footer3.png",
    line: "Reminder sent. Beep boop.",
    style: { left: "-0.1em", bottom: "0.58em", width: "0.74em" },
  },
  // second "u"
  9: {
    key: "m4",
    src: "/home/footer4.png",
    line: "Wake me for the next booking.",
    style: { left: "-0.1em", bottom: "0.58em", width: "0.74em" },
  },
};
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
      className={`dw-critter dw-critter--${crew.key}${crew.src ? " dw-critter--img" : ""}${talking ? " is-talking" : ""}`}
      style={crew.style}
      onClick={(e) => {
        e.stopPropagation();
        onTalk(crew.key);
      }}
    >
      <span className="dw-critter-body">
        {crew.src ? (
          <img src={crew.src} alt="" loading="lazy" decoding="async" />
        ) : (
          children
        )}
      </span>
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
                    {!crew.src && crew.Art && <crew.Art />}
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

      </div>
    </div>
  );
}
