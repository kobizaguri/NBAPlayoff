import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { leaguesApi } from '../api/leagues';
import { seriesApi } from '../api/series';
import { predictionsApi } from '../api/predictions';
import { adminApi } from '../api/admin';
import { useAuthStore } from '../store/authStore';
import { Leaderboard } from '../components/league/Leaderboard';
import { MemberList } from '../components/league/MemberList';
import { BracketView } from '../components/bracket/BracketView';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

type Tab = 'bracket' | 'leaderboard' | 'members' | 'mvp';

export function LeaguePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('bracket');
  const [mvpPickInput, setMvpPickInput] = useState('');
  const [mvpPickSaving, setMvpPickSaving] = useState(false);
  const [mvpPickError, setMvpPickError] = useState('');
  const [finalsMvpInput, setFinalsMvpInput] = useState('');
  const [finalsMvpSaving, setFinalsMvpSaving] = useState(false);

  const { data: league, isLoading: leagueLoading, error: leagueError } = useQuery({
    queryKey: ['league', id],
    queryFn: () => leaguesApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['leagueMembers', id],
    queryFn: () => leaguesApi.getMembers(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['leaderboard', id],
    queryFn: () => leaguesApi.getLeaderboard(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: series = [] } = useQuery({
    queryKey: ['series'],
    queryFn: () => seriesApi.getAll().then((r) => r.data),
  });

  const { data: predictions = [] } = useQuery({
    queryKey: ['predictions', id],
    queryFn: () => predictionsApi.forLeague(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: mvpPicks = [] } = useQuery({
    queryKey: ['mvpPicks', id],
    queryFn: () => leaguesApi.getMvpPicks(id!).then((r) => r.data),
    enabled: !!id,
  });

  if (leagueLoading) return <LoadingSpinner className="py-20" />;
  if (leagueError) return <p className="text-red-600 text-center py-10">League not found.</p>;
  if (!league) return <Navigate to="/leagues" replace />;

  const isCommissioner = user?.id === league.commissionerId;
  const isMember = members.some((m) => m.userId === user?.id);

  const mvpDeadlinePassed = new Date(league.mvpDeadline) <= new Date();
  const myMvpPick = mvpPicks.find((pk) => pk.userId === user?.id);

  const handleSubmitMvpPick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mvpPickInput.trim()) return;
    setMvpPickSaving(true);
    setMvpPickError('');
    try {
      await leaguesApi.submitMvpPick(id!, mvpPickInput.trim());
      queryClient.invalidateQueries({ queryKey: ['mvpPicks', id] });
      setMvpPickInput('');
    } catch (err: unknown) {
      setMvpPickError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to save pick',
      );
    } finally {
      setMvpPickSaving(false);
    }
  };

  const handleSetFinalsMvp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalsMvpInput.trim()) return;
    setFinalsMvpSaving(true);
    try {
      await adminApi.setLeagueFinalsMvp(id!, finalsMvpInput.trim());
      queryClient.invalidateQueries({ queryKey: ['league', id] });
      queryClient.invalidateQueries({ queryKey: ['mvpPicks', id] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard', id] });
      setFinalsMvpInput('');
    } catch { /* silent */ } finally {
      setFinalsMvpSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/leagues" className="hover:text-nba-blue">Leagues</Link>
            <span>/</span>
            <span>{league.name}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{league.name}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              Code: <span className="font-mono font-bold">{league.inviteCode}</span>
            </span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${league.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {league.isPublic ? 'Public' : 'Private'}
            </span>
            <span className="text-xs bg-blue-50 text-nba-blue px-2 py-1 rounded-full">
              {members.length}/{league.maxMembers} members
            </span>
            {isCommissioner && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                You are commissioner
              </span>
            )}
          </div>
        </div>

        <div className="text-sm text-gray-500 text-right">
          <p>Base: <strong>{league.baseWinPoints}</strong> pts</p>
          <p>Score bonus: <strong>{league.exactScoreBonus}</strong> pts</p>
          <p>Play-In: <strong>{league.playInWinPoints}</strong> pts</p>
          <p>Finals MVP: <strong>{league.mvpPoints}</strong> pts</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['bracket', 'leaderboard', 'members', 'mvp'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white text-nba-blue shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'bracket' ? '🏀 Bracket' : tab === 'leaderboard' ? '🏆 Leaderboard' : tab === 'members' ? '👥 Members' : '🌟 MVP'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'bracket' && (
        <BracketView
          series={series}
          predictions={isMember ? predictions.filter((p) => p.userId === user?.id) : []}
          leagueId={id}
        />
      )}

      {activeTab === 'leaderboard' && (
        <Leaderboard entries={leaderboard} currentUserId={user?.id} />
      )}

      {activeTab === 'members' && (
        <MemberList
          leagueId={id!}
          members={members}
          isCommissioner={isCommissioner}
          commissionerId={league.commissionerId}
          currentUserId={user?.id ?? ''}
        />
      )}

      {activeTab === 'mvp' && (
        <div className="space-y-6">
          {/* Finals MVP actual result */}
          {league.finalsActualMvp && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4">
              <p className="text-sm text-yellow-700 font-medium">
                Finals MVP: <span className="font-bold text-yellow-900">{league.finalsActualMvp}</span>
              </p>
            </div>
          )}

          {/* Admin set Finals MVP */}
          {user?.isAdmin && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Set Finals MVP (Admin)</h3>
              <form onSubmit={handleSetFinalsMvp} className="flex gap-3">
                <input
                  type="text"
                  value={finalsMvpInput}
                  onChange={(e) => setFinalsMvpInput(e.target.value)}
                  placeholder="e.g. LeBron James"
                  className="input flex-1"
                />
                <button type="submit" disabled={finalsMvpSaving} className="btn-primary shrink-0">
                  {finalsMvpSaving ? 'Saving…' : 'Set MVP'}
                </button>
              </form>
            </div>
          )}

          {/* Current user's MVP pick */}
          {isMember && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Your Finals MVP Pick</h3>
              <p className="text-sm text-gray-500 mb-3">
                Deadline: {new Date(league.mvpDeadline).toLocaleString()}
              </p>
              {mvpDeadlinePassed ? (
                myMvpPick ? (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-800 font-medium">{myMvpPick.playerName}</p>
                    {myMvpPick.pointsAwarded > 0 && (
                      <p className="text-green-600 font-bold mt-1">+{myMvpPick.pointsAwarded} pts</p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No pick submitted before the deadline.</p>
                )
              ) : (
                <form onSubmit={handleSubmitMvpPick} className="flex gap-3">
                  <input
                    type="text"
                    value={mvpPickInput}
                    onChange={(e) => setMvpPickInput(e.target.value)}
                    placeholder={myMvpPick ? myMvpPick.playerName : 'e.g. LeBron James'}
                    className="input flex-1"
                  />
                  <button type="submit" disabled={mvpPickSaving} className="btn-primary shrink-0">
                    {mvpPickSaving ? 'Saving…' : myMvpPick ? 'Update' : 'Submit'}
                  </button>
                </form>
              )}
              {mvpPickError && <p className="text-red-600 text-sm mt-2">{mvpPickError}</p>}
            </div>
          )}

          {/* All picks (after deadline) */}
          {mvpDeadlinePassed && mvpPicks.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-3">All Member Picks</h3>
              <ul className="divide-y divide-gray-100">
                {mvpPicks.map((pk) => {
                  const member = members.find((m) => m.userId === pk.userId);
                  return (
                    <li key={pk.id} className="py-2 flex items-center justify-between">
                      <span className="text-gray-700">{member?.displayName ?? pk.userId}</span>
                      <span className="font-medium text-gray-800">
                        {pk.playerName}
                        {pk.pointsAwarded > 0 && (
                          <span className="ml-2 text-green-600 text-sm">+{pk.pointsAwarded} pts</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
