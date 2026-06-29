import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AppShell from './AppShell';

function isGuestMode() {
  return typeof window !== 'undefined' && sessionStorage.getItem('lisa_guest') === 'true';
}

export default function ProtectedRoute() {
  const { user, loading, isConfigured } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 animate-pulse" />
          <p className="text-sm text-slate-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (isConfigured && !user && !isGuestMode()) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
