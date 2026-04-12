import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { leaguesApi } from '../api/leagues';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function LeagueListPage() {
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  const { data: leagues = [], isLoading, refetch } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => leaguesApi.list().then((r) => r.data),
  });

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setJoinSuccess('');
    setJoining(true);
    try {
      const res = await leaguesApi.join(joinCode.toUpperCase(), joinPassword || undefined);
      setJoinSuccess(`Joined "${res.data.name}" successfully!`);
      setJoinCode('');
      setJoinPassword('');
      refetch();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to join league';
      setJoinError(msg);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Leagues</h1>
        <Link to="/leagues/create" className="btn-primary">
          + Create League
        </Link>
      </div>

      {/* Join by code */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-3">Join with Invite Code</h2>
        <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="6-character code (e.g. AB1C2D)"
            maxLength={6}
            required
            className="input flex-1 uppercase font-mono tracking-widest"
          />
          <input
            type="password"
            value={joinPassword}
            onChange={(e) => setJoinPassword(e.target.value)}
            placeholder="Password (if required)"
            className="input sm:w-48"
          />
          <button type="submit" disabled={joining || joinCode.length !== 6} className="btn-primary shrink-0">
            {joining ? 'Joining…' : 'Join'}
          </button>
        </form>
        {joinError && <p className="text-red-600 text-sm mt-2">{joinError}</p>}
        {joinSuccess && <p className="text-green-600 text-sm mt-2">{joinSuccess}</p>}
      </div>

      {/* League list */}
      {isLoading ? (
        <LoadingSpinner className="py-10" />
      ) : leagues.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-4">🏀</p>
          <p className="text-lg font-medium">No leagues yet</p>
          <p className="text-sm">Create one or join with an invite code.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {leagues.map((league) => (
            <Link
              key={league.id}
              to={`/leagues/${league.id}`}
              className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-nba-blue transition-all p-5 block"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">{league.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Invite code:{' '}
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                      {league.inviteCode}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Base: {league.baseWinPoints} pts · Bonus: {league.exactScoreBonus} pts · Max {league.maxMembers} members
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      league.isPublic
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {league.isPublic ? 'Public' : 'Private'}
                  </span>
                  {league.hasPassword && (
                    <span className="text-xs text-gray-400">🔒 Password</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
