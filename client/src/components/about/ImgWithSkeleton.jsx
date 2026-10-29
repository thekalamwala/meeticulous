import { useState } from "react";

/**
 * <img> with a built-in shimmer skeleton while loading, and a calm
 * initials fallback if the asset 404s. Used across the About page so
 * slow company-assets images never flash an empty box.
 */
export default function ImgWithSkeleton({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  fallbackLabel = "",
  loading = "lazy",
  objectFit = "cover", // "cover" | "contain"
}) {
  // No src → go straight to the initials fallback (empty src never fires onError).
  const [status, setStatus] = useState(src ? "loading" : "error"); // loading | loaded | error

  const initials =
    fallbackLabel
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "BAS";

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {status === "loading" && (
        <div
          aria-hidden
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-sand to-ink/5"
        />
      )}

      {status === "error" ? (
        <div
          role="img"
          aria-label={alt || fallbackLabel}
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#D6ECF8] to-[#FFD2BC]"
        >
          <span className="font-heading text-3xl font-extrabold text-ink/70">
            {initials}
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={loading}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={`h-full w-full ${
            objectFit === "contain" ? "object-contain" : "object-cover"
          } transition-opacity duration-500 ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          } ${imgClassName}`}
        />
      )}
    </div>
  );
}
