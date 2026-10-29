import { useEffect } from "react";

// Per-route <title> + meta description for JS-rendering contexts (browser tab,
// Google, in-app browsers). Restores the previous values on unmount.
//
// NOTE: social scrapers (Facebook, WhatsApp, LinkedIn) do NOT execute JS — they
// read only the static tags in index.html. Per-route social-share cards require
// SSR or build-time prerendering; this hook does not affect those previews.

export default function useDocumentMeta({ title, description }) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    let descEl = document.head.querySelector('meta[name="description"]');
    const prevDesc = descEl ? descEl.getAttribute("content") : null;
    const createdDesc = !descEl;

    if (description) {
      if (!descEl) {
        descEl = document.createElement("meta");
        descEl.setAttribute("name", "description");
        document.head.appendChild(descEl);
      }
      descEl.setAttribute("content", description);
    }

    return () => {
      document.title = prevTitle;
      if (descEl) {
        if (createdDesc) descEl.remove();
        else if (prevDesc != null) descEl.setAttribute("content", prevDesc);
      }
    };
  }, [title, description]);
}
