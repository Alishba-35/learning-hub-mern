import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

// Sirf admin ke liye. (Asli suraksha server par hai: /api/admin har request par role check karta hai; ye sirf page chhupata hai.)
export default function AdminRoute() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
