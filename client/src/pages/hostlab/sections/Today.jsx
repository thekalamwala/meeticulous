// Today — device-split.
//
// Desktop (lg and up) keeps the current prod host-lab layout (Today.desktop).
// Mobile (below lg) is the reference redesign built in this chat (Today.mobile).
// Only one renders per width; the other is display:none, so there is no double
// work at runtime beyond the hidden subtree.
import TodayMobile from './Today.mobile';
import TodayDesktop from './Today.desktop';

const Today = ({ go }) => (
  <>
    <div className="lg:hidden">
      <TodayMobile go={go} />
    </div>
    <div className="hidden lg:block">
      <TodayDesktop go={go} />
    </div>
  </>
);

export default Today;
