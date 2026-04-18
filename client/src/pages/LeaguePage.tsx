import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
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
import type {
  ChampionBoardResponse,
  League,
  LeagueMVPPick,
  PerfectRoundBonuses,
  PlayoffSeries,
  Prediction,
} from '../types';

function commissionerExtrasConfigured(league: League, championBoard: ChampionBoardResponse | undefined): boolean {
  const pr = league.perfectRoundBonuses ?? {};
  const hasPerfect = [pr.firstRound, pr.semis, pr.finals, pr.nbaFinals].some(
    (v) => typeof v === 'number' && v > 0,
  );
  const nChampTeams = championBoard?.teamPointsTable.length ?? 0;
  return hasPerfect || !!league.championPickDeadline || nChampTeams > 0;
}

/** Read-only summary of perfect-round bonuses and champion pick deadline (same for every member). */
function LeagueExtrasReadOnlySummary({ league }: { league: League }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-gray-800 space-y-2">
      <p className="font-medium text-gray-900">Current settings</p>
      <ul className="list-disc list-inside space-y-1 text-gray-700">
        {[
          league.perfectRoundBonuses?.firstRound,
          league.perfectRoundBonuses?.semis,
          league.perfectRoundBonuses?.finals,
          league.perfectRoundBonuses?.nbaFinals,
        ].every((v) => !(typeof v === 'number' && v > 0)) && (
          <li>Perfect-round bonuses: none configured</li>
        )}
        {(league.perfectRoundBonuses?.firstRound ?? 0) > 0 && (
          <li>
            First round (all 8 series): <strong>{league.perfectRoundBonuses?.firstRound}</strong> pts if perfect
          </li>
        )}
        {(league.perfectRoundBonuses?.semis ?? 0) > 0 && (
          <li>
            Conference semifinals (2nd round): <strong>{league.perfectRoundBonuses?.semis}</strong> pts if perfect
          </li>
        )}
        {(league.perfectRoundBonuses?.finals ?? 0) > 0 && (
          <li>
            Conference finals: <strong>{league.perfectRoundBonuses?.finals}</strong> pts if perfect
          </li>
        )}
        {(league.perfectRoundBonuses?.nbaFinals ?? 0) > 0 && (
          <li>
            NBA Finals: <strong>{league.perfectRoundBonuses?.nbaFinals}</strong> pts if perfect
          </li>
        )}
        <li>
          Champion pick deadline:{' '}
          {league.championPickDeadline ? (
            <strong>{new Date(league.championPickDeadline).toLocaleString()}</strong>
          ) : (
            <strong>not set</strong>
          )}{' '}
          {!league.championPickDeadline && <span className="text-gray-500">(champion picks off)</span>}
        </li>
      </ul>
    </div>
  );
}

type Tab = 'bracket' | 'picks' | 'leaderboard' | 'members' | 'mvp' | 'champion';

function seriesLocked(s: PlayoffSeries): boolean {
  return s.isLockedManually || new Date(s.deadline) <= new Date();
}

function compareSeries(a: PlayoffSeries, b: PlayoffSeries): number {
  const order = ['playIn', 'firstRound', 'semis', 'finals', 'nbaFinals'] as const;
  const ai = order.indexOf(a.round);
  const bi = order.indexOf(b.round);
  if (ai !== bi) return ai - bi;
  const confRank: Record<string, number> = { east: 0, west: 1, finals: 2 };
  const ca = confRank[a.conference] ?? 9;
  const cb = confRank[b.conference] ?? 9;
  if (ca !== cb) return ca - cb;
  return a.id.localeCompare(b.id);
}

function winnerLabel(s: PlayoffSeries, winnerId: string): string {
  if (winnerId === s.homeTeamId) return s.homeTeamName;
  if (winnerId === s.awayTeamId) return s.awayTeamName;
  return '—';
}

/** e.g. "4-2" → "in 6" (total games). */
function gamesPhraseFromSeriesScore(score: string | undefined): string | null {
  if (!score) return null;
  const parts = score.split('-');
  if (parts.length !== 2) return null;
  const a = parseInt(parts[0], 10);
  const b = parseInt(parts[1], 10);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return `in ${a + b}`;
}

function LeaguePickCell({ series, pred }: { series: PlayoffSeries; pred: Prediction }) {
  const winner = winnerLabel(series, pred.predictedWinnerId);
  const isPlayIn = series.round === 'playIn';
  const gamesPhrase = !isPlayIn ? gamesPhraseFromSeriesScore(pred.predictedSeriesScore) : null;
  const scoreRaw = !isPlayIn ? pred.predictedSeriesScore?.trim() : undefined;
  const lengthPart = gamesPhrase ?? (scoreRaw ? scoreRaw : null);
  const showMvp = series.seriesMvpPoints > 0 && !!pred.predictedSeriesMvp?.trim();

  const pickedHome = pred.predictedWinnerId === series.homeTeamId;
  const pickedAway = pred.predictedWinnerId === series.awayTeamId;
  const winnerColor =
    pickedHome ? 'text-nba-blue' : pickedAway ? 'text-nba-red' : 'text-slate-800';

  return (
    <div className="space-y-0.5">
      <div>
        <span className={`font-medium ${winnerColor}`}>{winner}</span>
        {lengthPart ? <span className="text-slate-600"> {lengthPart}</span> : null}
      </div>
      {showMvp && (
        <div className="text-[10px] leading-tight text-indigo-700">Series MVP: {pred.predictedSeriesMvp}</div>
      )}
    </div>
  );
}

export function LeaguePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('bracket');
  const [mvpPickInput, setMvpPickInput] = useState('');
  const [mvpPickEditing, setMvpPickEditing] = useState(false);
  const [mvpPickSaving, setMvpPickSaving] = useState(false);
  const [mvpPickError, setMvpPickError] = useState('');
  const [finalsMvpInput, setFinalsMvpInput] = useState('');
  const [finalsMvpSaving, setFinalsMvpSaving] = useState(false);

  const [prFirst, setPrFirst] = useState('');
  const [prSemis, setPrSemis] = useState('');
  const [prFinals, setPrFinals] = useState('');
  const [prNbaFinals, setPrNbaFinals] = useState('');
  const [championDlLocal, setChampionDlLocal] = useState('');
  const [leagueSettingsSaving, setLeagueSettingsSaving] = useState(false);
  const [championTeamId, setChampionTeamId] = useState('');
  const [championPickEditing, setChampionPickEditing] = useState(false);
  const [championSaving, setChampionSaving] = useState(false);
  const [championErr, setChampionErr] = useState('');
  const [championRows, setChampionRows] = useState<{ teamId: string; points: string }[]>([]);
  const [championPointsSaving, setChampionPointsSaving] = useState(false);
  const [editCommissionerExtras, setEditCommissionerExtras] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [deletingLeague, setDeletingLeague] = useState(false);
  const [deleteLeagueError, setDeleteLeagueError] = useState('');
  /** Champion title-points table: default low → high; header click toggles. */
  const [championPointsSort, setChampionPointsSort] = useState<'asc' | 'desc'>('asc');

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

  const canSeeChampionBoard =
    !!id && (user?.isAdmin === true || members.some((m) => m.userId === user?.id));

  const { data: championBoard, isLoading: championLoading } = useQuery({
    queryKey: ['championBoard', id],
    queryFn: () => leaguesApi.getChampionBoard(id!).then((r) => r.data),
    enabled: canSeeChampionBoard,
  });

  const { data: mvpPlayerOptions } = useQuery({
    queryKey: ['mvpPlayerOptions'],
    queryFn: () => leaguesApi.getMvpPlayerOptions().then((r) => r.data.players),
  });

  useEffect(() => {
    setMvpPickEditing(false);
    setChampionPickEditing(false);
  }, [id]);

  const sortedSeries = useMemo(() => [...series].sort(compareSeries), [series]);

  /** League picks grid: drop other members’ preds for series still open (API may send all for admins). */
  const pickMatrix = useMemo(() => {
    const byUserSeries = new Map<string, Prediction>();
    for (const p of predictions) {
      const s = series.find((sr) => sr.id === p.seriesId);
      if (!s) continue;
      if (!seriesLocked(s) && p.userId !== user?.id) continue;
      byUserSeries.set(`${p.userId}:${p.seriesId}`, p);
    }
    return { byUserSeries };
  }, [predictions, series, user?.id]);

  const championPointsSorted = useMemo(() => {
    const rows = championBoard?.teamPointsTable ?? [];
    if (rows.length === 0) return [];
    const dir = championPointsSort === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const cmp = (a.points - b.points) * dir;
      if (cmp !== 0) return cmp;
      return a.teamName.localeCompare(b.teamName);
    });
  }, [championBoard?.teamPointsTable, championPointsSort]);

  if (leagueLoading) return <LoadingSpinner className="py-20" />;
  if (leagueError) return <p className="text-red-600 text-center py-10">League not found.</p>;
  if (!league) return <Navigate to="/leagues" replace />;

  const isCommissioner = user?.id === league.commissionerId;
  const isMember = members.some((m) => m.userId === user?.id);

  const mvpDeadlinePassed = new Date(league.mvpDeadline) <= new Date();
  const myMvpPick = mvpPicks.find((pk) => pk.userId === user?.id);

  const syncLeagueSettingsForm = () => {
    const pr = league.perfectRoundBonuses ?? {};
    setPrFirst(pr.firstRound != null ? String(pr.firstRound) : '');
    setPrSemis(pr.semis != null ? String(pr.semis) : '');
    setPrFinals(pr.finals != null ? String(pr.finals) : '');
    setPrNbaFinals(pr.nbaFinals != null ? String(pr.nbaFinals) : '');
    setChampionDlLocal(
      league.championPickDeadline
        ? new Date(league.championPickDeadline).toISOString().slice(0, 16)
        : '',
    );
  };

  const handleSubmitMvpPick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mvpPickInput.trim() || !id || !user?.id) return;
    setMvpPickSaving(true);
    setMvpPickError('');
    try {
      const { data: saved } = await leaguesApi.submitMvpPick(id, mvpPickInput.trim());
      queryClient.setQueryData<LeagueMVPPick[]>(['mvpPicks', id], (prev) => {
        const p = prev ?? [];
        const others = p.filter((x) => x.userId !== user.id);
        return [...others, saved];
      });
      queryClient.invalidateQueries({ queryKey: ['mvpPicks', id] });
      setMvpPickInput(saved.playerName);
      setMvpPickEditing(false);
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
    } catch {
      /* silent */
    } finally {
      setFinalsMvpSaving(false);
    }
  };

  const saveLeagueBonuses = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeagueSettingsSaving(true);
    try {
      const perfectRoundBonuses: PerfectRoundBonuses = { ...(league.perfectRoundBonuses ?? {}) };
      const apply = (key: keyof PerfectRoundBonuses, raw: string) => {
        const t = raw.trim();
        if (t === '') {
          delete perfectRoundBonuses[key];
          return;
        }
        const n = parseInt(t, 10);
        if (!Number.isNaN(n) && n >= 0) perfectRoundBonuses[key] = n;
      };
      apply('firstRound', prFirst);
      apply('semis', prSemis);
      apply('finals', prFinals);
      apply('nbaFinals', prNbaFinals);

      await leaguesApi.update(id!, {
        perfectRoundBonuses,
        championPickDeadline: championDlLocal
          ? new Date(championDlLocal).toISOString()
          : null,
      });
      queryClient.invalidateQueries({ queryKey: ['league', id] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard', id] });
      setEditCommissionerExtras(false);
    } finally {
      setLeagueSettingsSaving(false);
    }
  };

  const handleChampionPick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!championTeamId || !id) return;
    setChampionSaving(true);
    setChampionErr('');
    try {
      const { data: saved } = await leaguesApi.submitChampionPick(id, championTeamId);
      queryClient.setQueryData<ChampionBoardResponse>(['championBoard', id], (prev) => {
        if (!prev) return prev;
        const myPick = { teamId: saved.teamId, pointsAwarded: saved.pointsAwarded ?? 0 };
        const uid = user?.id;
        let memberPicks = prev.memberPicks ?? [];
        if (uid) {
          memberPicks = memberPicks.some((p) => p.userId === uid)
            ? memberPicks.map((p) => (p.userId === uid ? { userId: uid, ...myPick } : p))
            : [...memberPicks, { userId: uid, ...myPick }];
        }
        return { ...prev, myPick, memberPicks };
      });
      queryClient.invalidateQueries({ queryKey: ['championBoard', id] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard', id] });
      setChampionPickEditing(false);
    } catch (err: unknown) {
      setChampionErr(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Failed to save',
      );
    } finally {
      setChampionSaving(false);
    }
  };

  const saveChampionPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    setChampionPointsSaving(true);
    try {
      const rows = championRows
        .map((r) => ({ teamId: r.teamId, points: parseInt(r.points, 10) }))
        .filter((r) => r.teamId && !Number.isNaN(r.points) && r.points > 0);
      await leaguesApi.setChampionTeamPoints(id!, rows);
      queryClient.invalidateQueries({ queryKey: ['championBoard', id] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard', id] });
      setEditCommissionerExtras(false);
    } finally {
      setChampionPointsSaving(false);
    }
  };

  const tabLabel = (tab: Tab) => {
    switch (tab) {
      case 'bracket':
        return '🏀 Bracket';
      case 'picks':
        return '👁 League picks';
      case 'leaderboard':
        return '🏆 Leaderboard';
      case 'members':
        return '👥 Members';
      case 'mvp':
        return '🌟 MVP';
      case 'champion':
        return '🏆 Champion';
      default:
        return tab;
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/leagues" className="hover:text-nba-blue">
              Leagues
            </Link>
            <span>/</span>
            <span>{league.name}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{league.name}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              Code: <span className="font-mono font-bold">{league.inviteCode}</span>
            </span>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                league.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
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
          {isMember && !isCommissioner && (
            <div className="mt-3">
              <button
                type="button"
                disabled={leaving}
                onClick={async () => {
                  if (
                    !window.confirm(
                      'Leave this league? Your picks, MVP pick, champion pick, and bonus points for this league will be removed.',
                    )
                  ) {
                    return;
                  }
                  setLeaveError('');
                  setLeaving(true);
                  try {
                    await leaguesApi.leave(id!);
                    await queryClient.invalidateQueries({ queryKey: ['leagues'] });
                    await queryClient.invalidateQueries({ queryKey: ['league', id] });
                    navigate('/leagues', { replace: true });
                  } catch (err: unknown) {
                    setLeaveError(
                      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                        'Could not leave league',
                    );
                  } finally {
                    setLeaving(false);
                  }
                }}
                className="btn-danger-outline"
              >
                {leaving ? 'Leaving…' : 'Leave league'}
              </button>
              {leaveError && <p className="text-red-600 text-sm mt-2">{leaveError}</p>}
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500 text-right">
          <p>
            Base: <strong>{league.baseWinPoints}</strong> pts
          </p>
          <p className="text-xs max-w-xs ml-auto">
            Correct 4-x (4-0 … 4-3): <strong>+{league.baseWinPoints}</strong> flat pts (same scale as base win;
            per-series overrides use that series&apos; win points)
          </p>
          <p>
            Play-In: <strong>{league.playInWinPoints}</strong> pts
          </p>
          <p>
            Finals MVP: <strong>{league.mvpPoints}</strong> pts
          </p>
        </div>
      </div>

      {isMember && commissionerExtrasConfigured(league, championBoard) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">League scoring extras</h2>
          <p className="text-xs text-gray-500">
            Perfect-round bonuses and champion pick deadline. Only the commissioner can change these.
          </p>
          <LeagueExtrasReadOnlySummary league={league} />
        </div>
      )}

      {isCommissioner && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-gray-800">Commissioner — scoring extras</h2>
            {commissionerExtrasConfigured(league, championBoard) && !editCommissionerExtras ? (
              <button
                type="button"
                onClick={() => {
                  syncLeagueSettingsForm();
                  setChampionRows(
                    (championBoard?.teamPointsTable ?? []).map((r) => ({
                      teamId: r.teamId,
                      points: String(r.points),
                    })),
                  );
                  setEditCommissionerExtras(true);
                }}
                className="text-sm font-medium text-nba-blue hover:underline"
              >
                Edit settings
              </button>
            ) : commissionerExtrasConfigured(league, championBoard) && editCommissionerExtras ? (
              <button
                type="button"
                onClick={() => setEditCommissionerExtras(false)}
                className="text-sm font-medium text-gray-600 hover:underline"
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={syncLeagueSettingsForm}
                className="text-sm text-nba-blue hover:underline"
              >
                Load current values
              </button>
            )}
          </div>

          {(!commissionerExtrasConfigured(league, championBoard) || editCommissionerExtras) && (
            <>
              <p className="text-xs text-gray-500">
                Perfect rounds: bonus if a member gets every series winner in that round right (both
                conferences). Champion: set a pick deadline, then assign title points per playoff team — only
                teams you list appear to members.
              </p>
              <form onSubmit={saveLeagueBonuses} className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="block text-sm">
                    <span className="text-gray-600">Perfect 1st round</span>
                    <input
                      type="number"
                      min={0}
                      className="input mt-1 w-full"
                      placeholder="blank = leave unchanged"
                      value={prFirst}
                      onChange={(e) => setPrFirst(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-gray-600">Perfect 2nd round (semis)</span>
                    <input
                      type="number"
                      min={0}
                      className="input mt-1 w-full"
                      placeholder="blank = leave unchanged"
                      value={prSemis}
                      onChange={(e) => setPrSemis(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-gray-600">Perfect conf. finals</span>
                    <input
                      type="number"
                      min={0}
                      className="input mt-1 w-full"
                      placeholder="blank = leave unchanged"
                      value={prFinals}
                      onChange={(e) => setPrFinals(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-gray-600">Perfect NBA Finals</span>
                    <input
                      type="number"
                      min={0}
                      className="input mt-1 w-full"
                      placeholder="blank = leave unchanged"
                      value={prNbaFinals}
                      onChange={(e) => setPrNbaFinals(e.target.value)}
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  Clear a number field and save to remove that round&apos;s perfect bonus. Filled fields overwrite
                  saved values.
                </p>
                <label className="block text-sm max-w-md">
                  <span className="text-gray-600">Champion pick deadline</span>
                  <input
                    type="datetime-local"
                    className="input mt-1 w-full"
                    value={championDlLocal}
                    onChange={(e) => setChampionDlLocal(e.target.value)}
                  />
                  <span className="text-xs text-gray-400">Clear field and save to disable champion picks.</span>
                </label>
                <button type="submit" disabled={leagueSettingsSaving} className="btn-primary">
                  {leagueSettingsSaving ? 'Saving…' : 'Save perfect rounds & champion deadline'}
                </button>
              </form>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm">
                  Champion — points if this team wins the title
                </h3>
                <p className="text-xs text-gray-500">
                  Add one row per team. Only teams with a positive point value appear in the Champion tab. Save
                  applies title scoring when the Finals winner is known (and updates the leaderboard).
                </p>
                {championLoading && <p className="text-sm text-gray-500">Loading playoff teams…</p>}
                {!championLoading && championBoard && championBoard.playoffTeams.length === 0 && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Add <strong>first-round</strong> series in Admin so playoff teams appear here.
                  </p>
                )}
                {!championLoading && championBoard && championBoard.playoffTeams.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="text-sm text-nba-blue"
                      onClick={() =>
                        setChampionRows([
                          ...championRows,
                          { teamId: championBoard.playoffTeams[0]?.teamId ?? '', points: '' },
                        ])
                      }
                    >
                      + Add team row
                    </button>
                    <form onSubmit={saveChampionPoints} className="space-y-2">
                      {championRows.map((row, idx) => (
                        <div key={idx} className="flex gap-2 flex-wrap items-end">
                          <label className="flex-1 min-w-[140px]">
                            <span className="text-xs text-gray-500">Team</span>
                            <select
                              className="input w-full mt-0.5"
                              value={row.teamId}
                              onChange={(e) => {
                                const next = [...championRows];
                                next[idx] = { ...next[idx], teamId: e.target.value };
                                setChampionRows(next);
                              }}
                            >
                              <option value="">—</option>
                              {championBoard.playoffTeams.map((t) => (
                                <option key={t.teamId} value={t.teamId}>
                                  {t.teamName}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="w-28">
                            <span className="text-xs text-gray-500">Points</span>
                            <input
                              type="number"
                              min={1}
                              className="input w-full mt-0.5"
                              value={row.points}
                              onChange={(e) => {
                                const next = [...championRows];
                                next[idx] = { ...next[idx], points: e.target.value };
                                setChampionRows(next);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="text-sm text-red-600 mb-1"
                            onClick={() => setChampionRows(championRows.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2 flex-wrap">
                        <button type="submit" disabled={championPointsSaving} className="btn-primary">
                          {championPointsSaving ? 'Saving…' : 'Save champion title points'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            setChampionRows(
                              (championBoard.teamPointsTable ?? []).map((r) => ({
                                teamId: r.teamId,
                                points: String(r.points),
                              })),
                            )
                          }
                        >
                          Load from saved table
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </>
          )}

          <div className="border-t border-red-100 pt-4 mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-red-900">Danger zone</h3>
            <p className="text-xs text-gray-600">
              Delete this league permanently. All members, picks, MVP picks, and champion data for this league
              are removed.
            </p>
            <button
              type="button"
              disabled={deletingLeague}
              className="btn-danger-outline btn-sm"
              onClick={async () => {
                const typed = window.prompt(
                  `This cannot be undone. Type the league name exactly to confirm:\n\n${league.name}`,
                );
                if (typed !== league.name) {
                  if (typed != null) setDeleteLeagueError('League name did not match.');
                  return;
                }
                setDeleteLeagueError('');
                setDeletingLeague(true);
                try {
                  await leaguesApi.deleteLeague(id!);
                  await queryClient.invalidateQueries({ queryKey: ['leagues'] });
                  navigate('/leagues', { replace: true });
                } catch (err: unknown) {
                  setDeleteLeagueError(
                    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                      'Could not delete league',
                  );
                } finally {
                  setDeletingLeague(false);
                }
              }}
            >
              {deletingLeague ? 'Deleting…' : 'Delete league'}
            </button>
            {deleteLeagueError && <p className="text-red-600 text-sm">{deleteLeagueError}</p>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
        {(['bracket', 'picks', 'leaderboard', 'members', 'mvp', 'champion'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'bg-white text-nba-blue shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>

      {activeTab === 'bracket' && (
        <BracketView
          series={series}
          predictions={isMember ? predictions.filter((p) => p.userId === user?.id) : []}
          leagueId={id}
          baseWinPoints={league.baseWinPoints}
          playInWinPoints={league.playInWinPoints}
        />
      )}

      {activeTab === 'picks' && isMember && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 overflow-x-auto">
          <p className="text-sm text-slate-600 mb-3">
            Your row shows winner, series length (e.g. in 6), and series MVP when applicable; other members
            stay hidden until that series deadline (when the column locks).
          </p>
          <table className="min-w-full text-xs sm:text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 border-b bg-slate-50 sticky left-0 z-10 text-slate-800 font-semibold">
                  Member
                </th>
                {sortedSeries.map((s) => (
                  <th
                    key={s.id}
                    className="p-2 border-b bg-slate-50 text-left font-normal min-w-[140px] max-w-[200px]"
                  >
                    <div className="font-semibold text-nba-blue truncate" title={s.homeTeamName}>
                      {s.homeTeamName}
                    </div>
                    <div className="truncate mt-0.5 leading-snug">
                      <span className="text-slate-500 text-[11px] font-medium">vs </span>
                      <span className="font-semibold text-nba-red" title={s.awayTeamName}>
                        {s.awayTeamName}
                      </span>
                    </div>
                    <div className="text-[10px] text-indigo-700 font-medium uppercase tracking-wide mt-0.5">
                      {s.round}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className="border-b border-slate-100">
                  <td className="p-2 font-semibold text-slate-800 sticky left-0 bg-white z-10 whitespace-nowrap">
                    {m.displayName}
                  </td>
                  {sortedSeries.map((s) => {
                    const locked = seriesLocked(s);
                    const pred = pickMatrix.byUserSeries.get(`${m.userId}:${s.id}`);
                    // Only the viewer’s row before deadline — even admins get full data from the API,
                    // but this grid stays spoiler-free like other members.
                    const revealPick = locked || m.userId === user?.id;
                    return (
                      <td key={s.id} className="p-2 align-top text-slate-700">
                        {revealPick ? (
                          pred ? (
                            <LeaguePickCell series={s} pred={pred} />
                          ) : (
                            <span className="text-slate-400">—</span>
                          )
                        ) : (
                          <span className="text-indigo-400/90 italic">Hidden</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'picks' && !isMember && (
        <p className="text-gray-500 text-center py-8">Join this league to see the picks grid.</p>
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
          {league.finalsActualMvp && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4">
              <p className="text-sm text-yellow-700 font-medium">
                Finals MVP:{' '}
                <span className="font-bold text-yellow-900">{league.finalsActualMvp}</span>
              </p>
            </div>
          )}

          {user?.isAdmin && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Set Finals MVP (Admin)</h3>
              <p className="text-xs text-gray-500 mb-2">
                Must match the same candidate list members use (exact name).
              </p>
              <form onSubmit={handleSetFinalsMvp} className="flex flex-col sm:flex-row gap-3">
                <select
                  required
                  className="input flex-1"
                  value={finalsMvpInput}
                  onChange={(e) => setFinalsMvpInput(e.target.value)}
                >
                  <option value="">Select player…</option>
                  {(mvpPlayerOptions ?? []).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={finalsMvpSaving} className="btn-primary shrink-0">
                  {finalsMvpSaving ? 'Saving…' : 'Set MVP'}
                </button>
              </form>
            </div>
          )}

          {isMember && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Your Finals MVP Pick</h3>
              <p className="text-sm text-gray-500 mb-3">
                Deadline: {new Date(league.mvpDeadline).toLocaleString()}
              </p>
              {mvpDeadlinePassed ? (
                myMvpPick ? (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">Your pick</p>
                    <p className="text-lg font-semibold text-gray-900">{myMvpPick.playerName}</p>
                    {myMvpPick.pointsAwarded > 0 && (
                      <p className="text-green-600 font-bold mt-2">+{myMvpPick.pointsAwarded} pts</p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No pick submitted before the deadline.</p>
                )
              ) : myMvpPick && !mvpPickEditing ? (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">Your pick</p>
                    <p className="text-lg font-semibold text-gray-900">{myMvpPick.playerName}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setMvpPickEditing(true);
                      setMvpPickInput(myMvpPick.playerName);
                    }}
                  >
                    Change pick
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitMvpPick} className="flex flex-col sm:flex-row gap-3">
                  <select
                    required
                    className="input flex-1"
                    value={mvpPickInput}
                    onChange={(e) => setMvpPickInput(e.target.value)}
                  >
                    <option value="">Choose a player…</option>
                    {(mvpPlayerOptions ?? []).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={mvpPickSaving} className="btn-primary shrink-0">
                    {mvpPickSaving ? 'Saving…' : myMvpPick ? 'Update' : 'Submit'}
                  </button>
                </form>
              )}
              {mvpPickError && <p className="text-red-600 text-sm mt-2">{mvpPickError}</p>}
            </div>
          )}

          {mvpDeadlinePassed && mvpPicks.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-3">All Member Picks</h3>
              <ul className="divide-y divide-gray-100">
                {mvpPicks.map((pk) => {
                  const member = members.find((mem) => mem.userId === pk.userId);
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

      {activeTab === 'champion' && isMember && championLoading && (
        <LoadingSpinner className="py-12" />
      )}

      {activeTab === 'champion' && isMember && championBoard && !championLoading && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-800 mb-2">Champion points (this league)</h3>
            <p className="text-sm text-gray-500 mb-3">
              Only teams listed here appear in the table. Points can be edited anytime; totals update when the
              NBA Finals winner is known.
            </p>
            {championBoard.teamPointsTable.length === 0 ? (
              <p className="text-sm text-gray-500">No team rows yet — commissioner can add them below.</p>
            ) : (
              <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                <thead className="bg-nba-blue text-white">
                  <tr>
                    <th className="text-left px-3 py-2">Team</th>
                    <th className="text-right px-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          setChampionPointsSort((s) => (s === 'asc' ? 'desc' : 'asc'))
                        }
                        className="inline-flex w-full items-center justify-end gap-1.5 font-semibold hover:underline cursor-pointer select-none text-white"
                        title="Click to reverse sort by points"
                      >
                        <span>Points if they win title</span>
                        <span className="tabular-nums opacity-90" aria-hidden>
                          {championPointsSort === 'asc' ? '↑' : '↓'}
                        </span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {championPointsSorted.map((row) => (
                    <tr key={row.teamId}>
                      <td className="px-3 py-2">{row.teamName}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {championBoard.nbaChampionTeamId && (
              <p className="text-xs text-gray-500 mt-2">
                NBA champion resolved — picks have been scored against this winner.
              </p>
            )}
          </div>

          {isMember && league.championPickDeadline && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Your champion pick</h3>
              <p className="text-sm text-gray-500 mb-3">
                Deadline: {new Date(league.championPickDeadline).toLocaleString()}
              </p>
              {championBoard.championDeadlinePassed ? (
                championBoard.myPick ? (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">Your pick</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {championBoard.playoffTeams.find((t) => t.teamId === championBoard.myPick?.teamId)
                        ?.teamName ?? 'team'}
                    </p>
                    {championBoard.myPick.pointsAwarded > 0 && (
                      <p className="text-green-600 font-bold mt-2">
                        +{championBoard.myPick.pointsAwarded} pts
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No pick before the deadline.</p>
                )
              ) : championBoard.myPick && !championPickEditing ? (
                <div className="space-y-3 max-w-md">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">Your pick</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {championBoard.playoffTeams.find((t) => t.teamId === championBoard.myPick?.teamId)
                        ?.teamName ?? 'team'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setChampionPickEditing(true);
                      setChampionTeamId(championBoard.myPick!.teamId);
                    }}
                  >
                    Change pick
                  </button>
                </div>
              ) : (
                <form onSubmit={handleChampionPick} className="space-y-3 max-w-md">
                  <select
                    className="input w-full"
                    value={championTeamId}
                    onChange={(e) => setChampionTeamId(e.target.value)}
                    required
                  >
                    <option value="">Select a playoff team</option>
                    {championBoard.playoffTeams.map((t) => (
                      <option key={t.teamId} value={t.teamId}>
                        {t.teamName}
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={championSaving} className="btn-primary">
                    {championSaving ? 'Saving…' : championBoard.myPick ? 'Update pick' : 'Save pick'}
                  </button>
                  {championErr && <p className="text-red-600 text-sm">{championErr}</p>}
                </form>
              )}
            </div>
          )}

          {championBoard.championDeadlinePassed &&
            (championBoard.memberPicks ?? []).length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-800 mb-3">All member champion picks</h3>
                <ul className="divide-y divide-gray-100">
                  {(championBoard.memberPicks ?? []).map((pk) => {
                    const member = members.find((mem) => mem.userId === pk.userId);
                    const teamName =
                      championBoard.playoffTeams.find((t) => t.teamId === pk.teamId)?.teamName ??
                      'Team';
                    return (
                      <li key={pk.userId} className="py-2 flex items-center justify-between gap-3">
                        <span className="text-gray-700">{member?.displayName ?? pk.userId}</span>
                        <span className="font-medium text-gray-800 text-right">
                          {teamName}
                          {pk.pointsAwarded > 0 && (
                            <span className="ml-2 text-green-600 text-sm">
                              +{pk.pointsAwarded} pts
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

          {isCommissioner && (
            <p className="text-xs text-gray-500 border-t border-gray-100 pt-4">
              To edit title points per team, use <strong>Edit settings</strong> in the commissioner box above
              (or open this tab to see the public table).
            </p>
          )}
        </div>
      )}

      {activeTab === 'champion' && !isMember && (
        <p className="text-gray-500 text-center py-8">Join this league to use champion picks.</p>
      )}
    </div>
  );
}
