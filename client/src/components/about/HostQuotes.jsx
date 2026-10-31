import { useRef } from "react";
import useGsapReveal from "./useGsapReveal";
import { testimonials } from "./aboutContent";
import { StaggerTestimonials } from "../ui/stagger-testimonials";

// "What hosts tell us." — the 21st.dev stagger-testimonials carousel (exact
// geometry, owner request), fed with the real host quotes. The stage runs full
// width like the original; every quote stays in the DOM (no hover required).

export default function HostQuotes() {
  const root = useRef(null);
  useGsapReveal(root);

  return (
    <section ref={root} className="overflow-hidden py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2 className="js-head text-center font-heading text-4xl font-extrabold sm:text-5xl">{testimonials.heading}</h2>
        <p className="mt-5 text-center text-lg leading-relaxed text-ink/70">{testimonials.sub}</p>
      </div>
      <div className="js-item mt-10">
        <StaggerTestimonials items={testimonials.items} label="What hosts tell us" />
      </div>
    </section>
  );
}
