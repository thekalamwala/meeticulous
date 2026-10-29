import { useEffect } from "react";
import { X } from "lucide-react";
import ImgWithSkeleton from "./ImgWithSkeleton";
import TeamSocials from "./TeamSocials";

export default function TeamModal({ member, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={member.name} className="relative grid w-full max-w-2xl gap-6 overflow-hidden rounded-[16px] bg-surface p-6 shadow-2xl sm:grid-cols-[2fr_3fr] sm:p-8">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 text-ink/50 hover:text-ink">
          <X className="h-5 w-5" />
        </button>
        <div className="aspect-square overflow-hidden rounded-[12px] bg-sand ring-1 ring-black/5" data-swap={member.swap}>
          <ImgWithSkeleton src={member.photo} alt={`${member.name} — ${member.role}`} fallbackLabel={member.name} loading="eager" />
        </div>
        <div className="flex flex-col">
          <h3 className="font-heading text-2xl font-bold">{member.name}</h3>
          {member.position && <p className="font-medium text-primary">{member.position}</p>}
          <p className="mt-3 text-sm leading-relaxed text-ink/70">{member.bio}</p>
          <TeamSocials socials={member.socials} name={member.name} />
        </div>
      </div>
    </div>
  );
}
