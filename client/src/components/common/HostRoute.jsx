import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import { hostPathToGuestPath, isHost } from '../../utils/roleRoutes';

// Role wall for host-space routes (/dashboard/*). Auth + host-onboarding resume
// are owned by ProtectedRoute; this only enforces role: a non-host who reaches a
// host URL is sent to the matching guest URL.
const HostGate = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  if (!isHost(user)) return <Navigate to={hostPathToGuestPath(location.pathname)} replace />;
  return children;
};

const HostRoute = ({ children }) => (
  <ProtectedRoute>
    <HostGate>{children}</HostGate>
  </ProtectedRoute>
);

export default HostRoute;
