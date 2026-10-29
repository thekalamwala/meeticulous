import Reveal from '../../../components/home/Reveal';
import BookingDemo from '../BookingDemo';
export default function S05Demo({ hostCtx }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2 items-center">
      <div>
        <Reveal><h2 className="font-heading text-3xl sm:text-4xl">Try it yourself.</h2></Reveal>
        <Reveal delay={0.1}><p className="mt-4 text-muted max-w-sm">This is exactly what your clients see when they open your link. Pick a service, a time, and book.</p></Reveal>
      </div>
      <Reveal delay={0.15}><BookingDemo host={hostCtx.activeHost} /></Reveal>
    </div>
  );
}
