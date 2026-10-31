import { useRef } from "react";
import useGsapReveal from "./useGsapReveal";
import { gallery } from "./aboutContent";
import PolaroidLineCarousel from "../ui/polaroid-line-carousel";
import { u } from "../home/images";

// About-page gallery: the 21st.dev polaroid-line carousel (ui/), fed with stock
// photos of the kinds of work people sell with Meeticulous (aboutContent.gallery).
// Titles stay as image alt text (screen readers) even though prints show no names.
// White page background + ink text to match the About page.

const slides = gallery.items.map((g) => ({
  image: u(g.id, 900, 900),
  title: g.title,
  caption: g.caption,
  alt: g.title,
}));

export default function WorkGallery() {
  const root = useRef(null);
  useGsapReveal(root);

  return (
    <section ref={root} className="py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2 className="js-head text-center font-heading text-4xl font-extrabold sm:text-5xl">{gallery.heading}</h2>
        <p className="mx-auto mt-5 max-w-2xl text-center text-lg leading-relaxed text-ink/70">{gallery.sub}</p>
      </div>
      <div className="js-item mt-6">
        {/* Continuous, endless drift; big prints with no names; no title/counter/
            arrows bar (owner request). Drag still flings the line. */}
        <PolaroidLineCarousel
          slides={slides}
          height="clamp(560px, 82svh, 720px)"
          cardWidth={420}
          widthRatio={0.62}
          heightRatio={0.6}
          drift={0.18}
          showBar={false}
          showLabels={false}
          background="#ffffff"
          ink="#2A1416"
          ariaLabel="Gallery: the work people sell with Meeticulous"
        />
      </div>
    </section>
  );
}
