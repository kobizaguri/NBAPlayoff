import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import api from '../api/client';
import { UserStats, User } from '../types';
import { useAuthStore } from '../store/authStore';

const ROUND_LABELS: Record<string, string> = {
  firstRound: 'First Round',
  semis: 'Conference Semifinals',
  finals: 'Conference Finals',
  nbaFinals: 'NBA Finals',
};

export function UserStatsPage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuthStore();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['userStats', id],
    queryFn: () => api.get<UserStats>(`/users/${id}/stats`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile', id],
    queryFn: () => api.get<User>(`/users/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  if (statsLoading || profileLoading) return <LoadingSpinner className="py-20" />;
  if (!stats || !profile) return <p className="text-red-600 text-center py-10">User not found.</p>;

  const isOwnProfile = currentUser?.id === id;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center gap-5">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="w-20 h-20 rounded-full object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-nba-blue text-white flex items-center justify-center text-3xl font-bold">
            {profile.displayName[0].toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile.displayName}</h1>
          <p className="text-sm text-gray-500">@{profile.username}</p>
          {isOwnProfile && (
            <Link
              to={`/users/${id}/edit`}
              className="text-sm text-nba-blue hover:underline mt-1 inline-block"
            >
              Edit profile
            </Link>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Points', value: stats.totalPoints.toFixed(1) },
          { label: 'Correct Winners', value: stats.correctWinners },
          { label: 'Correct Scores', value: stats.correctExactScores },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-nba-blue">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Points by round */}
      {Object.keys(stats.pointsByRound).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Points by Round</h2>
          <div className="space-y-2">
            {Object.entries(stats.pointsByRound).map(([round, pts]) => (
              <div key={round} className="flex justify-between items-center py-1 border-b border-gray-50">
                <span className="text-sm text-gray-700">{ROUND_LABELS[round] ?? round}</span>
                <span className="font-bold text-nba-blue">{(pts as number).toFixed(1)} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Points by league */}
      {stats.pointsByLeague.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Performance by League</h2>
          <div className="space-y-2">
            {stats.pointsByLeague.map((entry) => (
              <div key={entry.leagueId} className="flex justify-between items-center py-1 border-b border-gray-50">
                <Link to={`/leagues/${entry.leagueId}`} className="text-sm text-nba-blue hover:underline">
                  {entry.leagueName}
                </Link>
                <span className="font-bold text-gray-800">{entry.points.toFixed(1)} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
