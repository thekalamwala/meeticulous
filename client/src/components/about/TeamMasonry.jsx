import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { getOpenJobs } from "../careers/careersContent";
import useGsapReveal from "./useGsapReveal";
import { team } from "./aboutContent";
import TeamModal from "./TeamModal";
import ImgWithSkeleton from "./ImgWithSkeleton";
import { u } from "../home/images";

// Team as a row of playful photo cut-outs: each portrait is clipped to a shape
// (pinched "8" blob, arch, oval, triple blob — cycling) on a bright brand tint,
// with name + role centred underneath. Click opens the TeamModal bio card.
// (Was a bento photo grid; before that the swinging polaroid-line carousel.)
// Tints show fully once real team photos are transparent cut-out PNGs; with
// regular photos they show while loading and behind the initials fallback.
// No transition on .js-item opacity/transform — GSAP owns those; the hover
// lift lives on the inner shape wrapper.

// Stand-in Unsplash photos (same IDs the homepage uses) until real team
// photos exist — set `photo` on a member in aboutContent.js and it wins.
const PLACEHOLDER_PHOTOS = [
  "1600880292203-757bb62b4baf",
  "1577896851231-70ef18881754",
  "1559839734-2b71ea197ec2",
  "1594824476967-48c8b964273f",
  "1556157382-97eda2d62296",
  "1522071820081-009f0129c71c",
  "1499209974431-9dddcece7f88",
  "1506126613408-eca07ce68773",
].map((id) => u(id, 640, 800));

const members = team.members.map((m, i) => ({
  ...m,
  photo: m.photo || PLACEHOLDER_PHOTOS[i % PLACEHOLDER_PHOTOS.length],
}));

// Shapes in each card's own 0–1 box (clipPathUnits="objectBoundingBox").
const SHAPES = [
  // Pinched "8": two rounded lobes, waist in the middle
  "M0.2,0 H0.8 C0.92,0 1,0.08 1,0.2 V0.3 C1,0.42 0.92,0.47 0.86,0.5 C0.92,0.53 1,0.58 1,0.7 V0.8 C1,0.92 0.92,1 0.8,1 H0.2 C0.08,1 0,0.92 0,0.8 V0.7 C0,0.58 0.08,0.53 0.14,0.5 C0.08,0.47 0,0.42 0,0.3 V0.2 C0,0.08 0.08,0 0.2,0 Z",
  // Arch: round top, flat bottom
  "M0,0.5 C0,0.22 0.22,0 0.5,0 C0.78,0 1,0.22 1,0.5 V1 H0 Z",
  // Oval
  "M0.5,0 C0.78,0 1,0.22 1,0.5 C1,0.78 0.78,1 0.5,1 C0.22,1 0,0.78 0,0.5 C0,0.22 0.22,0 0.5,0 Z",
  // Triple blob: three stacked lobes
  "M0.2,0 H0.8 C0.92,0 1,0.06 1,0.15 V0.18 C1,0.27 0.92,0.31 0.86,0.333 C0.92,0.36 1,0.4 1,0.48 V0.52 C1,0.6 0.92,0.64 0.86,0.667 C0.92,0.69 1,0.73 1,0.82 V0.85 C1,0.94 0.92,1 0.8,1 H0.2 C0.08,1 0,0.94 0,0.85 V0.82 C0,0.73 0.08,0.69 0.14,0.667 C0.08,0.64 0,0.6 0,0.52 V0.48 C0,0.4 0.08,0.36 0.14,0.333 C0.08,0.31 0,0.27 0,0.18 V0.15 C0,0.06 0.08,0 0.2,0 Z",
];
const shapeId = (i) => `team-shape-${i}`;

// Bright tints, one per card, from the brand accent tokens.
const TINTS = ["var(--c-blue)", "var(--c-amber)", "var(--c-pink)", "var(--c-cyan)", "var(--c-emerald)", "var(--c-violet)"];

// Caption metrics shared by the portrait cards and the open-seat card so every
// tile in a row lines up (name line, then role line).
const NAME_CLS = "mt-5 font-heading text-base font-bold leading-snug sm:text-xl";
const ROLE_CLS = "mt-1 text-xs text-ink/60 sm:text-sm";

function Card({ m, i, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(m)}
      aria-label={`${m.name} — ${m.role}. View bio`}
      // transition-none: the global `button { transition: transform … }` rule
      // (index.css) fights the GSAP reveal on this .js-item and left portraits
      // stuck shrunk/lowered vs the open-seat tile. The hover lift lives on the
      // inner shape, so nothing visible is lost.
      className="js-item group block w-full text-center transition-none focus-visible:outline-none"
    >
      <div
        className="relative mx-auto aspect-[4/5] w-full transition-transform duration-500 ease-out group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5"
        style={{ clipPath: `url(#${shapeId(i % SHAPES.length)})`, background: TINTS[i % TINTS.length] }}
      >
        <ImgWithSkeleton src={m.photo} alt="" fallbackLabel={m.name} imgClassName="transition-transform duration-500 ease-out group-hover:scale-105" />
      </div>
      <p className={`${NAME_CLS} text-ink group-focus-visible:underline`}>{m.name}</p>
      <p className={ROLE_CLS}>{m.position}</p>
    </button>
  );
}

// "Open seat" — the last tile in the team grid, inviting people to join: the
// next shape in the cycle drawn as a dashed crimson outline (not clipped — a
// clip-path would cut the dashes off) on a soft crimson wash, a plus mark, and
// the live open-role count from the Careers data. Links to /careers.
function JoinCard({ i }) {
  const open = getOpenJobs().length;
  const d = SHAPES[i % SHAPES.length];
  const roles = open ? `${open} open role${open === 1 ? "" : "s"}` : "";
  // Same box + caption metrics as a portrait card (NAME_CLS / ROLE_CLS) so it
  // lines up in its row; an invisible full-size link sits on top for the click.
  return (
    <div className="js-item group relative w-full text-center">
      <div className="relative mx-auto aspect-[4/5] w-full transition-transform duration-500 ease-out group-hover:-translate-y-1.5 group-focus-within:-translate-y-1.5">
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
          <path d={d} className="fill-primary/[0.05] transition-colors duration-300 group-hover:fill-primary/10" />
          <path d={d} fill="none" stroke="var(--primary, #960D32)" strokeWidth="2" strokeDasharray="8 7" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-[0_12px_30px_-12px_rgba(150,13,50,0.6)] transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110 sm:h-16 sm:w-16">
            <Plus size={30} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <p className="mt-4 font-heading text-sm font-bold leading-snug text-ink sm:text-lg">Your seat is open</p>
        </div>
      </div>
      <p className={`${NAME_CLS} flex items-center justify-center gap-1 text-primary-cta`}>
        Join the team
        <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
      </p>
      <p className={ROLE_CLS}>{roles ? `${roles} · Careers` : "See careers"}</p>
      <Link
        to="/careers"
        aria-label={`Join the team${roles ? ` — ${roles}` : ""}`}
        className="absolute inset-0 rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
      />
    </div>
  );
}

export default function TeamMasonry() {
  const root = useRef(null);
  useGsapReveal(root, ".js-item");
  const [active, setActive] = useState(null);

  return (
    <section ref={root} className="px-5 py-12 sm:px-8 lg:py-16">
      <svg aria-hidden width="0" height="0" className="absolute">
        {SHAPES.map((d, i) => (
          <clipPath key={i} id={shapeId(i)} clipPathUnits="objectBoundingBox">
            <path d={d} />
          </clipPath>
        ))}
      </svg>

      <div className="mx-auto max-w-6xl">
        <h2 className="js-head text-center font-heading text-3xl font-bold sm:text-4xl">{team.heading}</h2>
        <p className="mt-4 text-center text-lg leading-relaxed text-ink/70">{team.sub}</p>

        <div
          role="list"
          aria-label="Meeticulous team"
          // Equal-column grid: 5 people + the open seat = 6 tiles → three per row
          // (3 + 3) from tablets up, 2 + 2 + 2 on phones. Big tiles (~320px on
          // desktop); the open seat is the 6th tile, closing row two.
          className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 sm:gap-x-8 lg:gap-x-10 lg:gap-y-14"
        >
          {members.map((m, i) => (
            <div key={m.name} role="listitem">
              <Card m={m} i={i} onOpen={setActive} />
            </div>
          ))}
          {/* The invitation sits in the grid as the next "member" — it also
              completes the grid (5 people + 1 open seat = two full rows of three). */}
          <div role="listitem">
            <JoinCard i={members.length} />
          </div>
        </div>
      </div>
      {active && <TeamModal member={active} onClose={() => setActive(null)} />}
    </section>
  );
}
