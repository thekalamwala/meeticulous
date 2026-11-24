// Bookings — device-split.
//
// Desktop (lg and up) keeps the current prod host-lab layout (Bookings.desktop).
// Mobile (below lg) is the reference redesign built in this chat (Bookings.mobile).
// Only one renders per width; the other is display:none.
import BookingsMobile from './Bookings.mobile';
import BookingsDesktop from './Bookings.desktop';

const Bookings = () => (
  <>
    <div className="lg:hidden">
      <BookingsMobile />
    </div>
    <div className="hidden lg:block">
      <BookingsDesktop />
    </div>
  </>
);

export default Bookings;
