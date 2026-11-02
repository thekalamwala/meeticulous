import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { analytics, EVENTS } from "../../services/analytics";

const SLUG = "topmate-vs-meeticulous";
const DEST = "/become-a-host";

/* Primary CTA — fires LP_CTA_CLICKED then routes to host signup.
   variant: "dark" (default) | "light" | "link" */
export function CtaButton({ slot, children = "Start My Page", variant = "dark", className = "" }) {
  const navigate = useNavigate();
  const go = (e) => {
    e.preventDefault();
    analytics.track(EVENTS.LP_CTA_CLICKED, { slug: SLUG, slot });
    navigate(DEST);
  };

  if (variant === "link") {
    return (
      <a
        href={DEST}
        onClick={go}
        className={`inline-flex items-center gap-2 font-heading font-bold text-ink underline decoration-primary decoration-2 underline-offset-4 transition-all hover:gap-3 hover:text-primary hover:no-underline ${className}`}
      >
        {children} <ArrowRight size={18} />
      </a>
    );
  }

  const base =
    "group inline-flex items-center gap-2.5 rounded-[6px] px-6 py-3.5 text-[15px] font-semibold transition-all hover:no-underline";
  const skin =
    variant === "light"
      ? "bg-white text-ink shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] hover:bg-white"
      : "bg-ink text-white shadow-[0_14px_40px_-16px_rgba(26,26,26,0.7)] hover:bg-black";

  return (
    <a href={DEST} onClick={go} className={`${base} ${skin} ${className}`}>
      {children}
      <span className="grid h-7 w-7 place-items-center rounded-[4px] bg-white/15 transition-transform group-hover:translate-x-0.5">
        <ArrowRight size={15} className={variant === "light" ? "text-ink" : "text-white"} />
      </span>
    </a>
  );
}

/* Avatar with graceful initials fallback (CDN image may be unset). */
export function Avatar({ src, name, className = "h-11 w-11 rounded-[6px]" }) {
  const [err, setErr] = useState(false);
  if (err || !src) {
    return (
      <div className={`flex flex-shrink-0 items-center justify-center bg-primary/10 text-sm font-bold text-primary ${className}`}>
        {name?.charAt(0) || "★"}
      </div>
    );
  }
  return (
    <img
      src={src}
      onError={() => setErr(true)}
      alt={name}
      loading="lazy"
      className={`flex-shrink-0 object-cover ${className}`}
    />
  );
}
