import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { leaguesApi } from '../api/leagues';
import { seriesApi } from '../api/series';
import { predictionsApi } from '../api/predictions';
import { useAuthStore } from '../store/authStore';
import { Leaderboard } from '../components/league/Leaderboard';
import { MemberList } from '../components/league/MemberList';
import { BracketView } from '../components/bracket/BracketView';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

type Tab = 'bracket' | 'leaderboard' | 'members';

export function LeaguePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('bracket');

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

  if (leagueLoading) return <LoadingSpinner className="py-20" />;
  if (leagueError) return <p className="text-red-600 text-center py-10">League not found.</p>;
  if (!league) return <Navigate to="/leagues" replace />;

  const isCommissioner = user?.id === league.commissionerId;
  const isMember = members.some((m) => m.userId === user?.id);

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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['bracket', 'leaderboard', 'members'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white text-nba-blue shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'bracket' ? '🏀 Bracket' : tab === 'leaderboard' ? '🏆 Leaderboard' : '👥 Members'}
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
    </div>
  );
}
