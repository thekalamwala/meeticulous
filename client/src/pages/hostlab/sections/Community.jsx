// ─────────────────────────────────────────────────────────────────────────────
// Community — the console's view of /community.
//
// Deliberately NOT a second feed. The community already has one, at /community,
// and reimplementing it here would be the Grow › Insights mistake again: two
// surfaces answering one question, drifting apart. What a host needs inside
// their console is the part that is about *them* —
//
//   Activity   what you have posted, and what it earned you
//   Mentions   posts that name you (community_posts.mentions_host_id)
//   Answer     open questions you could answer, which is the cheapest
//              visibility a host can get
//   Spaces     the five rooms, and which ones you may post in
//
// Reading and posting happen in the community itself; every row here opens it.
// Four sub-pages, declared in nav.js like every other destination.
//
// Every field maps to a real column (see communityData.js). The one thing that
// does not exist yet as a page is "Answer" — it is a view over posts in `help`
// with no accepted_comment_id, and it says so rather than pretending.
// ─────────────────────────────────────────────────────────────────────────────
import { ArrowUpRight, CheckCircle2, Heart, MessageSquare, Pin, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, cn } from '../../../components/dashboard/ui';
import { Sparkline, SubPageHeader, useSubPage } from '../labUi';
import { AreaChart, Card, CardLink, Empty, Explain, Scorecard } from '../intelUi';
import community from '../communityData';

const open = (what) => toast.success(what);

/** Who may post in a space. `post_policy` is a real column, and "hosts" is the
 *  one that matters here — Host Corner is a room guests cannot post in. */
const POLICY = {
  official: { label: 'Team only', cls: 'bg-blush text-maroon' },
  hosts: { label: 'Hosts only', cls: 'bg-maroon text-white' },
  everyone: { label: 'Everyone', cls: 'bg-neutral-100 text-ink/55' },
};

const SpacePill = ({ policy }) => {
  const p = POLICY[policy] || POLICY.everyone;
  return <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold', p.cls)}>{p.label}</span>;
};

/** One row in a list of posts. The whole row opens it in the community. */
const PostRow = ({ title, meta, right, onOpen, unread }) => (
  <li>
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
    >
      {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pink" aria-label="Unread" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-bold text-ink">{title}</span>
        <span className="block truncate text-[11px] font-medium text-ink/50">{meta}</span>
      </span>
      {right}
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink/25" strokeWidth={2.4} />
    </button>
  </li>
);

const Count = ({ icon: Icon, value, label }) => (
  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold tabular-nums text-ink/45" title={label}>
    <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />{value}
  </span>
);

/* ═══ Activity ════════════════════════════════════════════════════════════ */

const Activity = () => {
  const m = community.me;
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Scorecard label="Posts" value={m.postCount} delta={m.deltas.posts} spark={<Sparkline values={m.activity.map((d) => d.value)} />} />
        <Scorecard label="Replies" value={m.commentCount} delta={m.deltas.comments} />
        <Scorecard label="Followers" value={m.followerCount} delta={m.deltas.followers} />
        <Scorecard label="Likes received" value={m.likesReceived} delta={m.deltas.likes} />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2">
        <Card title="Your activity" info="Posts and replies you have written, by month.">
          <AreaChart id="cm-act" data={m.activity} format={(v) => String(Math.round(v))} />
        </Card>
        <Card
          title="Answers accepted"
          info="An asker can mark one reply as the answer (community_posts.accepted_comment_id). It is the clearest signal that you were useful."
        >
          <p className="font-display text-[34px] font-extrabold leading-none tracking-[-0.045em] text-ink">{m.acceptedAnswers}</p>
          <p className="mt-1 text-[11.5px] font-medium text-ink/50">of your {m.commentCount} replies were marked as the answer</p>
          <div className="mt-3 h-2 rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-maroon" style={{ width: `${(m.acceptedAnswers / m.commentCount) * 100}%` }} />
          </div>
        </Card>
      </div>

      <Card title="Your posts" action={<CardLink onClick={() => open('Opens your contributor profile in the community')}>Profile</CardLink>}>
        <ul className="flex flex-col">
          {community.myPosts.map((p) => (
            <PostRow
              key={p.slug}
              title={p.title}
              meta={`${p.space} · ${p.when} ago`}
              onOpen={() => open(`Opens /community/t/${p.slug}`)}
              right={
                <span className="flex items-center gap-2.5">
                  {p.pinned && <Pin className="h-3.5 w-3.5 text-maroon" strokeWidth={2.4} aria-label="Pinned" />}
                  {p.accepted && <CheckCircle2 className="h-3.5 w-3.5 text-success-fg" strokeWidth={2.4} aria-label="Accepted answer" />}
                  <Count icon={Heart} value={p.likes} label="Likes" />
                  <Count icon={MessageSquare} value={p.replies} label="Replies" />
                </span>
              }
            />
          ))}
        </ul>
      </Card>
    </>
  );
};

/* ═══ Mentions ════════════════════════════════════════════════════════════ */

const Mentions = () => (
  <Card
    title="Posts that name you"
    info="community_posts.mentions_host_id — someone wrote about you by name. A reply from you is the highest-intent moment in the whole community."
    action={<CardLink onClick={() => open('Opens the community feed')}>Open community</CardLink>}
  >
    {community.mentions.length === 0 ? (
      <Empty title="Nobody has mentioned you yet" body="When a guest names you in a post, it lands here so you can reply while it is live." />
    ) : (
      <ul className="flex flex-col">
        {community.mentions.map((p) => (
          <PostRow
            key={p.slug}
            unread={!p.read}
            title={p.title}
            meta={`${p.by} · ${p.space} · ${p.when} ago`}
            onOpen={() => open(`Opens /community/t/${p.slug}`)}
            right={
              <span className="flex items-center gap-2.5">
                {p.verifiedBooking && (
                  <span className="shrink-0 rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-bold text-success-fg" title="This person has a completed booking with you">
                    Booked with you
                  </span>
                )}
                <Count icon={MessageSquare} value={p.replies} label="Replies" />
              </span>
            }
          />
        ))}
      </ul>
    )}
  </Card>
);

/* ═══ Answer ══════════════════════════════════════════════════════════════ */

const Answer = () => (
  <>
    <Card
      title="Open questions"
      info="Posts in Help & Questions and Host Corner with no accepted answer yet. Sorted by how long they have waited."
      action={<CardLink onClick={() => open('Opens Help & Questions')}>All questions</CardLink>}
    >
      <ul className="flex flex-col">
        {community.unanswered.map((q) => (
          <PostRow
            key={q.slug}
            unread={q.replies === 0}
            title={q.title}
            meta={`${q.space} · asked ${q.asked} ago · ${q.views} views`}
            onOpen={() => open(`Opens /community/t/${q.slug} with the reply box focused`)}
            right={
              <span className="flex items-center gap-2.5">
                <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-ink/55">{q.tag}</span>
                <Count icon={MessageSquare} value={q.replies} label="Replies" />
              </span>
            }
          />
        ))}
      </ul>
    </Card>

    <p className="rounded-xl border-2 border-marigold-300 bg-marigold-100 px-2.5 py-1.5 text-[11px] font-medium text-marigold-800">
      Honest note: the questions, spaces and accepted answers are all real
      (<code>community_posts.accepted_comment_id</code>). This <em>page</em> is the proposal — today a host would have to
      go hunting for them in the feed.
    </p>
  </>
);

/* ═══ Spaces ══════════════════════════════════════════════════════════════ */

const Spaces = () => (
  <>
    <Card
      title="The five rooms"
      info="Seeded in community_spaces. post_policy decides who may start a thread in each."
      action={<CardLink onClick={() => open('Opens /community/guidelines')}>Guidelines</CardLink>}
    >
      <ul className="flex flex-col gap-1">
        {community.spaces.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => open(`Opens /community/s/${s.key}`)}
              className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[12.5px] font-bold text-ink">{s.name}</span>
                  <SpacePill policy={s.policy} />
                  {s.unread > 0 && <span className="shrink-0 rounded-full bg-rose px-1.5 text-[10px] font-bold text-white">{s.unread}</span>}
                </span>
                <span className="block truncate text-[11px] font-medium text-ink/50">{s.description}</span>
              </span>
              <Count icon={MessageSquare} value={s.posts} label="Posts" />
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink/25" strokeWidth={2.4} />
            </button>
          </li>
        ))}
      </ul>
    </Card>

    <Card title="Host Corner is yours" info="post_policy = 'hosts'. Guests can read it; only hosts can start a thread.">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-maroon text-white">
          <Users className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </span>
        <p className="text-[12px] font-medium leading-snug text-ink/65">
          The one room guests cannot post in. Pricing, growth and what is working, from people doing the same job.
        </p>
        <Button className="ml-auto shrink-0" onClick={() => open('Opens the composer in Host Corner')}>Write a post</Button>
      </div>
    </Card>
  </>
);

/* ═══ Shell ═══════════════════════════════════════════════════════════════ */

const PAGES = { activity: Activity, mentions: Mentions, answer: Answer, spaces: Spaces };

export default function Community() {
  const page = useSubPage('community');
  const Component = PAGES[page.slug] || Activity;

  return (
    <div className="flex flex-col gap-2.5">
      <SubPageHeader
        page={page}
        action={
          <div className="flex items-center gap-2">
            <Explain>Reading and posting happen in the community itself. This section is the part that is about you.</Explain>
            <Button variant="outline" onClick={() => open('Opens /community in a new tab')}>
              Open community <ArrowUpRight className="h-4 w-4" strokeWidth={2.4} />
            </Button>
          </div>
        }
      />
      <Component />
    </div>
  );
}
