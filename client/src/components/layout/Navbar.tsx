import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { NotificationBell } from '../notifications/NotificationBell';

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-nba-blue text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <span className="text-2xl">🏀</span>
            <span className="hidden sm:inline">NBA Playoff Bracket</span>
            <span className="sm:hidden">Playoff</span>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-4">
            <Link
              to="/bracket"
              className="text-sm font-medium hover:text-yellow-300 transition-colors"
            >
              Bracket
            </Link>

            {isAuthenticated ? (
              <>
                <Link
                  to="/leagues"
                  className="text-sm font-medium hover:text-yellow-300 transition-colors"
                >
                  My Leagues
                </Link>

                {user?.isAdmin && (
                  <Link
                    to="/admin"
                    className="text-sm font-medium bg-nba-red px-3 py-1 rounded hover:bg-red-700 transition-colors"
                  >
                    Admin
                  </Link>
                )}

                <NotificationBell />

                <div className="flex items-center gap-2">
                  <Link
                    to={`/users/${user?.id}/stats`}
                    className="text-sm font-medium hover:text-yellow-300 transition-colors"
                  >
                    {user?.displayName}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium hover:text-yellow-300 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-medium bg-white text-nba-blue px-3 py-1 rounded hover:bg-gray-100 transition-colors"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
