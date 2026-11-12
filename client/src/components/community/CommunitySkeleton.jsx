// Loading skeletons shaped like the real community card (avatar + header + body lines +
// action row with the 2px rule), so the loading state mirrors the design instead of a
// blank block. Decorative — aria-hidden; the caller owns the aria-busy/live region.

function Bar({ w = 'w-full', h = 'h-3' }) {
  return <div className={`${h} ${w} rounded-full bg-neutral-100`} />;
}

export function CardSkeleton() {
  return (
    <div className="mt-card gap-5 p-5 sm:p-6" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-neutral-100" />
        <div className="flex flex-1 flex-col gap-2">
          <Bar w="w-32" />
          <Bar w="w-24" h="h-2" />
        </div>
        <div className="h-8 w-8 shrink-0 rounded-full bg-neutral-100" />
      </div>
      <div className="flex flex-col gap-2.5">
        <Bar />
        <Bar w="w-11/12" />
        <Bar w="w-2/3" />
      </div>
      <div className="flex gap-6 border-t-2 border-ink/5 pt-3">
        <Bar w="w-12" />
        <Bar w="w-12" />
        <Bar w="w-14" />
      </div>
    </div>
  );
}

export default function FeedSkeleton({ count = 3 }) {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      {Array.from({ length: count }, (_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}
