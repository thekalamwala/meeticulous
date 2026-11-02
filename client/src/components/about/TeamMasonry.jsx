import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { getOpenJobs } from "../careers/careersContent";
import useGsapReveal from "./useGsapReveal";
import { team } from "./aboutContent";
import TeamModal from "./TeamModal";
import TeamSocials from "./TeamSocials";
import ImgWithSkeleton from "./ImgWithSkeleton";
import { u } from "../home/images";

// Team as tall portrait tiles that show only the photo at rest. On hover (or
// keyboard focus) the photo shrinks (never cropped off) to reveal an info panel —
// [ POSITION ], NAME, a short bio — alternating direction tile by tile: even
// tiles shrink the photo UP (panel underneath), odd tiles DOWN (panel on top). On touch
// screens (no hover) the panel is always shown. Click opens the TeamModal bio
// card. The last tile is the open seat (→ /careers) with the same reveal.
// (Was shaped cut-outs; before that a bento grid and the polaroid carousel.)
// No transition on .js-item opacity/transform — GSAP owns those; the slide
// lives on the inner photo layer.

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
].map((id) => u(id, 640, 860));

const members = team.members.map((m, i) => ({
  ...m,
  photo: m.photo || PLACEHOLDER_PHOTOS[i % PLACEHOLDER_PHOTOS.length],
}));

// The info panel's height, and per-direction classes. The photo never leaves
// the tile (sliding it out cropped faces): it is anchored to one edge and its
// height eases from 100% down to the space left above/below the panel, so the
// whole photo stays in view. Written out in full so Tailwind generates them.
const PANEL_H = "h-[42%]";
const SHRUNK = "group-hover:h-[58%] group-focus-visible:h-[58%] group-focus-within:h-[58%] [@media(hover:none)]:h-[58%]";
const SLIDE = {
  // photo shrinks UP toward the top edge; panel underneath
  up: { panel: "bottom-0", photo: `top-0 ${SHRUNK}` },
  // photo shrinks DOWN toward the bottom edge; panel on top
  down: { panel: "top-0", photo: `bottom-0 ${SHRUNK}` },
};
const dirFor = (i) => (i % 2 === 0 ? SLIDE.up : SLIDE.down);

// Shared tile frame so portraits and the open seat line up exactly.
const TILE =
  "relative block aspect-[3/4] w-full overflow-hidden rounded-[16px] border-2 border-neutral-200 bg-white text-left";
const PHOTO_LAYER =
  "absolute inset-x-0 z-10 h-full overflow-hidden rounded-[16px] transition-[height] duration-500 ease-out motion-reduce:transition-none";

function Panel({ dir, label, title, body, extra = null }) {
  return (
    <div className={`absolute inset-x-0 ${dir.panel} ${PANEL_H} flex flex-col justify-end p-4 sm:p-5`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50">[ {label} ]</p>
      <p className="mt-auto font-heading text-sm font-bold uppercase tracking-wide text-ink sm:text-base">{title}</p>
      <p className={`mt-1.5 text-xs leading-relaxed text-ink/60 sm:text-sm ${extra ? "line-clamp-2" : "line-clamp-3"}`}>{body}</p>
      {extra}
    </div>
  );
}

// Social icons fade in with the panel (hover / keyboard focus; always on touch).
const SOCIALS_REVEAL =
  "relative z-30 mt-2.5 opacity-0 pointer-events-none transition-opacity duration-300 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto";

function Card({ m, i, onOpen }) {
  const dir = dirFor(i);
  // A div (not a button) so the social links can live inside the tile: the
  // "View bio" button is a transparent layer over the whole tile, and the
  // social row sits above it (z-30).
  return (
    <div className={`js-item group ${TILE}`}>
      <Panel
        dir={dir}
        label={m.position}
        title={m.name}
        body={m.bio}
        extra={<TeamSocials socials={m.socials} name={m.name} compact className={SOCIALS_REVEAL} />}
      />
      <div className={`${PHOTO_LAYER} bg-sand ${dir.photo}`}>
        {/* Frame on the upper part of the photo, where faces sit, so heads stay
            in view when the photo shrinks. */}
        <ImgWithSkeleton src={m.photo} alt="" fallbackLabel={m.name} imgClassName="object-[50%_20%]" />
      </div>
      <button
        type="button"
        onClick={() => onOpen(m)}
        aria-label={`${m.name} — ${m.role}. View bio`}
        // transition-none: the global `button { transition: transform … }` rule
        // (index.css) would animate this full-tile layer.
        className="absolute inset-0 z-20 rounded-[16px] transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      />
    </div>
  );
}

// "Open seat" — the last tile: a crimson face with a plus mark slides away like
// a photo, revealing the Careers panel with the live open-role count.
function JoinCard({ i }) {
  const open = getOpenJobs().length;
  const roles = open ? `${open} open role${open === 1 ? "" : "s"}` : "";
  const dir = dirFor(i);
  return (
    <div className={`js-item group ${TILE}`}>
      <Panel
        dir={dir}
        label="Careers"
        title={
          <span className="inline-flex items-center gap-1 text-primary-cta">
            Join the team <ArrowRight size={16} aria-hidden="true" />
          </span>
        }
        body={roles ? `${roles} — come build the calm way to get booked.` : "Come build the calm way to get booked."}
      />
      <div className={`${PHOTO_LAYER} flex flex-col items-center justify-center bg-primary-cta text-white ${dir.photo}`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 sm:h-16 sm:w-16">
          <Plus size={30} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <p className="mt-4 font-heading text-base font-bold sm:text-lg">This could be you</p>
      </div>
      <Link
        to="/careers"
        aria-label={`Join the team${roles ? ` — ${roles}` : ""}`}
        className="absolute inset-0 z-20 rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
      <div className="mx-auto max-w-6xl">
        <h2 className="js-head text-center font-display text-3xl font-bold sm:text-4xl">{team.heading}</h2>
        <p className="mt-4 text-center text-lg leading-relaxed text-ink/70">{team.sub}</p>

        <div
          role="list"
          aria-label="Meeticulous team"
          // 5 people + the open seat = 6 tiles → 3 per row from tablets up
          // (3 + 3), 2 + 2 + 2 on phones.
          className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
        >
          {members.map((m, i) => (
            <div key={m.name} role="listitem">
              <Card m={m} i={i} onOpen={setActive} />
            </div>
          ))}
          <div role="listitem">
            <JoinCard i={members.length} />
          </div>
        </div>
      </div>
      {active && <TeamModal member={active} onClose={() => setActive(null)} />}
    </section>
  );
}
