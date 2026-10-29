import Reveal from '../../../components/home/Reveal';
const STEPS = [
  { n: '01', t: 'Share one link', d: 'Put it in your bio, your story, your WhatsApp.' },
  { n: '02', t: 'Clients book & pay upfront', d: 'They pick a time and pay over UPI — no back-and-forth.' },
  { n: '03', t: 'Just show up', d: 'Reminders go out automatically. The money is already in.' },
];
export default function S04How() {
  return (
    <div>
      <Reveal><h2 className="font-heading text-3xl sm:text-4xl">From link to paid. In <span className="text-primary">three steps</span>.</h2></Reveal>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.1}><div className="page-card p-6 h-full">
            <span className="font-heading text-3xl text-primary">{s.n}</span>
            <h3 className="font-heading text-lg mt-3">{s.t}</h3>
            <p className="text-sm text-muted mt-1">{s.d}</p>
          </div></Reveal>
        ))}
      </div>
    </div>
  );
}
