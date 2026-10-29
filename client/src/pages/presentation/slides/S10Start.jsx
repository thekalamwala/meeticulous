import Reveal from '../../../components/home/Reveal';
export default function S10Start() {
  return (
    <div className="text-center">
      <Reveal><h2 className="font-heading text-4xl sm:text-5xl">Live in <span className="text-primary">~42 seconds</span>.</h2></Reveal>
      <Reveal delay={0.1}><p className="mt-4 text-muted">Sign in, add a service, share your link. Keep 100% of what you earn.</p></Reveal>
      <Reveal delay={0.2}><a href="/be-a-sloth" className="btn-primary inline-block mt-8 text-lg">Continue with Google</a></Reveal>
      <Reveal delay={0.3}><p className="mt-6 text-sm text-muted">meeticulous.com</p></Reveal>
    </div>
  );
}
