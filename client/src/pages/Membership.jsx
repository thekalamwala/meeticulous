import { PageHeader } from '../components/dashboard/ui';
import ComingSoonTeaser from '../components/dashboard/ComingSoonTeaser';

/**
 * Membership — a reserved "coming to Pro" surface. The feature isn't built yet;
 * this page captures demand (one-click Notify me) so it ships to a warm list.
 */
export default function Membership() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Memberships" subtitle="Recurring plans your regulars pay for automatically." />
      <ComingSoonTeaser
        feature="membership"
        title="Sell memberships"
        blurb="Turn your regulars into monthly members — recurring plans they pay for automatically, so your income is predictable. Coming to Pro."
      />
    </div>
  );
}
