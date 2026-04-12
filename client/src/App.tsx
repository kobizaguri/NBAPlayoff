import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AdminRoute } from './components/common/AdminRoute';
import { useSocket } from './hooks/useSocket';

import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { BracketPage } from './pages/BracketPage';
import { LeagueListPage } from './pages/LeagueListPage';
import { LeaguePage } from './pages/LeaguePage';
import { CreateLeaguePage } from './pages/CreateLeaguePage';
import { UserStatsPage } from './pages/UserStatsPage';
import { AdminPage } from './pages/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function AppInner() {
  useSocket();
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/bracket" element={<BracketPage />} />

        {/* Protected member routes */}
        <Route
          path="/leagues"
          element={
            <ProtectedRoute>
              <LeagueListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leagues/create"
          element={
            <ProtectedRoute>
              <CreateLeaguePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leagues/:id"
          element={
            <ProtectedRoute>
              <LeaguePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/:id/stats"
          element={
            <ProtectedRoute>
              <UserStatsPage />
            </ProtectedRoute>
          }
        />

        {/* Admin-only routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
