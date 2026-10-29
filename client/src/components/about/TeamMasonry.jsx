import { useRef, useState } from "react";
import useGsapReveal from "./useGsapReveal";
import { team } from "./aboutContent";
import ImgWithSkeleton from "./ImgWithSkeleton";
import TeamModal from "./TeamModal";

export default function TeamMasonry() {
  const root = useRef(null);
  useGsapReveal(root, ".js-item");
  const [active, setActive] = useState(null);

  return (
    <section ref={root} className="px-5 py-12 sm:px-8 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">{team.sub}</p>
        <h2 className="js-head mt-3 font-heading text-3xl font-bold sm:text-4xl">{team.heading}</h2>

        <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {team.members.map((m, i) => (
            <button
              key={m.name}
              type="button"
              onClick={() => setActive(m)}
              aria-label={`${m.name} — ${m.role}`}
              className="js-item group block w-full overflow-hidden rounded-[12px] border border-ink/10 bg-surface text-left transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(26,26,26,0.45)]"
            >
              <div className="aspect-square bg-sand" data-swap={`team-${i + 1}`}>
                <ImgWithSkeleton src={m.photo} alt={`${m.name} — ${m.role}`} fallbackLabel={m.name} />
              </div>
              <div className="p-4">
                <div className="font-heading font-semibold">{m.name.split(" ")[0]}</div>
                <div className="text-sm font-medium text-primary">{m.role}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      {active && <TeamModal member={active} onClose={() => setActive(null)} />}
    </section>
  );
}
