import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import useGsapReveal from "./useGsapReveal";
import { join } from "./aboutContent";
import ImgWithSkeleton from "./ImgWithSkeleton";

export default function JoinSplit() {
  const root = useRef(null);
  useGsapReveal(root);
  return (
    <section ref={root} className="px-5 py-12 sm:px-8 lg:py-16">
      <div className="mx-auto grid max-w-6xl items-stretch gap-6 lg:grid-cols-[3fr_7fr]">
        <div className="js-item flex flex-col justify-center">
          <h2 className="js-head font-heading text-3xl font-bold sm:text-4xl">{join.heading}</h2>
          <p className="mt-4 text-ink/70">{join.body}</p>
          <Link to={join.href} className="btn mt-7 inline-flex w-fit items-center gap-1.5 bg-primary px-7 py-3.5 text-white transition-colors hover:bg-primary-dark">
            {join.cta}
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="js-item relative aspect-[16/10] overflow-hidden rounded-[12px] bg-sand ring-1 ring-black/5" data-swap={join.imageSwap}>
          <ImgWithSkeleton src={join.image} alt="The Meeticulous team" fallbackLabel="Meeticulous" />
        </div>
      </div>
    </section>
  );
}
