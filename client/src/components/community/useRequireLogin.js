import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Guest OTP door with a return path: same `?redirect=` contract as ProtectedRoute / Login.jsx.
export const loginHref = (loc) => `/login?redirect=${encodeURIComponent(loc.pathname + loc.search)}`;

// () => true when logged in; otherwise sends the visitor to log in and returns false.
export default function useRequireLogin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  return () => {
    if (user) return true;
    navigate(loginHref(loc));
    return false;
  };
}
