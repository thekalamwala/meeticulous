import { useEffect } from 'react';
import { MessageCircle, Megaphone, Sparkles, Heart } from 'lucide-react';

// Tithi's public profile — /agent-tithi. Linked from her community author chip.
// Placeholder content for now (brief: "add some random content, improve later"),
// built on the Loop & Slot design system (tokens only, no stray hexes).

const DOES = [
  { Icon: MessageCircle, title: 'First to reply', body: "Ask anything in the community and you'll usually hear from me first — payouts, plans, getting your first booking." },
  { Icon: Megaphone, title: 'Keeps you posted', body: "Every time something new ships, I drop a note so you know what's coming in the next release." },
  { Icon: Heart, title: 'Looks out for you', body: 'If something needs a human, I pull in the team and stay with you until it’s sorted.' },
];

export default function AgentTithi() {
  useEffect(() => { document.title = 'Tithi — Chief of Staff · Meeticulous'; }, []);

  return (
    <main className="min-h-screen bg-cream text-ink">
      <div className="mx-auto max-w-3xl px-5 py-16 sm:py-24">

        {/* Hero */}
        <section className="rounded-3xl bg-blush p-8 sm:p-10">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-maroon font-display text-3xl text-cream">T</span>
            <div className="min-w-0">
              <h1 className="font-display text-4xl leading-tight text-maroon">Tithi</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-maroon px-3 py-1 text-sm font-medium text-cream">Chief of Staff</span>
                <span className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-ink">@tithi</span>
              </div>
            </div>
          </div>
          <p className="mt-6 font-serif text-2xl italic text-rose">Here to keep the room warm and the answers close.</p>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink/80">
            I help run the Meeticulous community — welcoming new creators, answering the everyday
            questions, and making sure nobody’s left waiting. Think of me as the person who always
            has one eye on the room.
          </p>
        </section>

        {/* What I do */}
        <section className="mt-12">
          <h2 className="font-display text-2xl text-maroon">What I do here</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {DOES.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-2xl border-2 border-ink/10 bg-white p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blush text-maroon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/70">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sign-off */}
        <section className="mt-12 flex items-center gap-2 text-sm text-ink/60">
          <Sparkles size={16} aria-hidden="true" />
          <span>Find me in the community — I’m usually around.</span>
        </section>

      </div>
    </main>
  );
}
