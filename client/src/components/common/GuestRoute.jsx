import ProtectedRoute from './ProtectedRoute';

// Guest-space routes (/user/*) are open to ANY logged-in user. Unified identity:
// a host browsing or booking as a customer lives here in Traveling mode, so the
// wall is now MODE (a UI preference via the navbar switch), not identity. Auth is
// still owned by ProtectedRoute; HostRoute continues to gate /dashboard/* by the
// is_host capability.
const GuestRoute = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

export default GuestRoute;
