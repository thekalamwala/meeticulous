import { Zap } from "lucide-react";
import { CtaButton, Avatar } from "./LpKit";
import { PROFILES } from "./lpData";

const NOTES = [
  { t: "New booking", v: "₹1,200", c: "var(--c-emerald)" },
  { t: "A new testimonial", v: "★ 5.0", c: "var(--c-violet)" },
  { t: "New sale", v: "₹799", c: "var(--c-blue)" },
];
const SWATCHES = ["var(--c-pink)", "var(--c-amber)", "var(--c-violet)", "var(--c-emerald)"];

export default function LpFlash() {
  const me = PROFILES[5]; // any placeholder host

  return (
    <section className="bg-canvas px-5 py-24 sm:px-8">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        {/* ── Left copy ── */}
        <div>
          <h2 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Create your
            <br />
            Meeticulous page in a{" "}
            <span className="text-primary">flash</span>
          </h2>
          <p className="mt-6 max-w-md text-lg text-neutral-600">
            Sign in with Google, claim your link, add your services and availability,
            then share it. Clients book and pay from that one link.
          </p>
          <div className="mt-8">
            <CtaButton slot="flash" variant="link">
              Launch your page
            </CtaButton>
          </div>
        </div>

        {/* ── Right mockup ── */}
        <div className="rounded-[8px] bg-[#f6dccd] p-5 sm:p-7">
          {/* profile card */}
          <div className="flex items-center justify-between gap-4 rounded-[6px] bg-white p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar src={me.img} name={me.name} className="h-12 w-12 rounded-[6px]" />
              <div className="min-w-0">
                <div className="truncate font-heading text-sm font-bold text-ink">{me.name}</div>
                <div className="truncate text-xs text-neutral-500">meeticulous.com/{me.name.split(" ")[0].toLowerCase()}</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {SWATCHES.map((c) => (
                <span key={c} className="h-3 w-3 rounded-[4px]" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* lightning tile + notifications */}
          <div className="mt-4 grid grid-cols-[1fr_1.3fr] gap-4">
            <div className="grid place-items-center rounded-[6px] bg-primary">
              <Zap size={44} className="fill-white text-white" />
            </div>
            <div className="flex flex-col gap-2.5">
              {NOTES.map((n, i) => (
                <div
                  key={n.t}
                  className="flex items-center gap-2.5 rounded-[6px] bg-white px-3 py-2.5 shadow-sm"
                  style={{ opacity: 1 - i * 0.18 }}
                >
                  <span className="h-2.5 w-2.5 flex-none rounded-[4px]" style={{ backgroundColor: n.c }} />
                  <span className="flex-1 text-[13px] font-semibold text-ink">{n.t}</span>
                  <span className="text-[13px] font-bold text-neutral-500">{n.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
