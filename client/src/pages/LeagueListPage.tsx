import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { leaguesApi } from '../api/leagues';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuthStore } from '../store/authStore';
import type { League } from '../types';

function errMsg(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Something went wrong'
  );
}

export function LeagueListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  const [actingLeagueId, setActingLeagueId] = useState<string | null>(null);
  const [cardError, setCardError] = useState('');
  const [expandedJoinId, setExpandedJoinId] = useState<string | null>(null);
  const [cardJoinPassword, setCardJoinPassword] = useState('');

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
      setJoinError(errMsg(err));
    } finally {
      setJoining(false);
    }
  };

  const isCommissioner = (league: League) => user?.id === league.commissionerId;
  const isListedMember = (league: League) => league.isMember === true;

  const joinFromCard = async (league: League, password?: string) => {
    setCardError('');
    setActingLeagueId(league.id);
    try {
      await leaguesApi.join(league.inviteCode, password);
      setExpandedJoinId(null);
      setCardJoinPassword('');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['league', league.id] });
      queryClient.invalidateQueries({ queryKey: ['leagueMembers', league.id] });
      navigate(`/leagues/${league.id}`);
    } catch (err: unknown) {
      setCardError(errMsg(err));
    } finally {
      setActingLeagueId(null);
    }
  };

  const leaveFromCard = async (league: League) => {
    if (
      !window.confirm(
        `Leave “${league.name}”? Your picks and league-specific data for this league will be removed.`,
      )
    ) {
      return;
    }
    setCardError('');
    setActingLeagueId(league.id);
    try {
      await leaguesApi.leave(league.id);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['league', league.id] });
    } catch (err: unknown) {
      setCardError(errMsg(err));
    } finally {
      setActingLeagueId(null);
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
        <>
          {cardError && (
            <p className="text-red-600 text-sm rounded-lg border border-red-200 bg-red-50 px-3 py-2">{cardError}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {leagues.map((league) => {
              const busy = actingLeagueId === league.id;
              const showPasswordJoin = expandedJoinId === league.id && league.hasPassword && !isListedMember(league);

              return (
                <div
                  key={league.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-nba-blue/60 transition-all flex flex-col overflow-hidden"
                >
                  <Link
                    to={`/leagues/${league.id}`}
                    className="p-5 block flex-1 min-h-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-nba-blue"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">{league.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Invite code:{' '}
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                            {league.inviteCode}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Base: {league.baseWinPoints} pts · Exact 4-x: +{league.baseWinPoints} flat · Max{' '}
                          {league.maxMembers} members
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
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

                  <div className="px-5 pb-5 pt-0 border-t border-gray-100 flex flex-col gap-2">
                    {!isListedMember(league) && (
                      <>
                        {showPasswordJoin ? (
                          <div className="flex flex-col gap-2 pt-2">
                            <input
                              type="password"
                              className="input w-full"
                              placeholder="League password"
                              value={cardJoinPassword}
                              onChange={(e) => setCardJoinPassword(e.target.value)}
                              disabled={busy}
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busy || !cardJoinPassword.trim()}
                                className="btn-primary btn-sm"
                                onClick={() => joinFromCard(league, cardJoinPassword)}
                              >
                                {busy ? 'Joining…' : 'Confirm join'}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                disabled={busy}
                                onClick={() => {
                                  setExpandedJoinId(null);
                                  setCardJoinPassword('');
                                  setCardError('');
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            className="btn-outline btn-sm w-full sm:w-auto mt-2"
                            onClick={(e) => {
                              e.preventDefault();
                              setCardError('');
                              if (league.hasPassword) {
                                setExpandedJoinId(league.id);
                                setCardJoinPassword('');
                              } else {
                                void joinFromCard(league);
                              }
                            }}
                          >
                            {busy ? 'Joining…' : 'Join league'}
                          </button>
                        )}
                      </>
                    )}

                    {isListedMember(league) && isCommissioner(league) && (
                      <p className="text-xs text-gray-500 pt-2">You are the commissioner — open the league to manage it.</p>
                    )}

                    {isListedMember(league) && !isCommissioner(league) && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Link
                          to={`/leagues/${league.id}`}
                          className="btn-secondary btn-sm inline-flex items-center justify-center"
                        >
                          Open league
                        </Link>
                        <button
                          type="button"
                          disabled={busy}
                          className="btn-danger-outline btn-sm"
                          onClick={() => void leaveFromCard(league)}
                        >
                          {busy ? 'Leaving…' : 'Leave league'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
