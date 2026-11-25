// Schedule / Availability — dashboard_v2 graduation. The availability editor is
// complex (weekly slots, buffer, blocked dates, timezone) and proven; we reuse it
// verbatim with `embedded`, which swaps only the hero for the v2 PageHeading. The
// lab's hours/rules/dates/calendars split is deferred — the single editor already
// covers hours, buffer rules and blocked dates.
import Availability from './Availability';

const AvailabilityV2 = () => <Availability embedded />;

export default AvailabilityV2;
