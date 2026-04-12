import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
