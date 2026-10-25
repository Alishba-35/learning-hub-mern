import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import Loader from './Loader.jsx';

// Login/Signup pages: agar banda pehle se logged in hai to unhein dikhane ka faida nahi
export default function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loader />;
  if (user) return <Navigate to={location.state?.from?.pathname || '/languages'} replace />;
  return children;
}
