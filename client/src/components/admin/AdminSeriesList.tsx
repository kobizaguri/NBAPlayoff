import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { seriesApi } from '../../api/series';
import { PlayoffSeries } from '../../types';

const NBA_TEAMS = [
  'TBD',
  'Boston Celtics','New York Knicks','Cleveland Cavaliers','Indiana Pacers',
  'Milwaukee Bucks','Detroit Pistons','Miami Heat','Orlando Magic',
  'Chicago Bulls','Atlanta Hawks','Philadelphia 76ers','Toronto Raptors',
  'Charlotte Hornets','Brooklyn Nets','Washington Wizards',
  'Oklahoma City Thunder','Houston Rockets','Los Angeles Lakers','Denver Nuggets',
  'Memphis Grizzlies','Golden State Warriors','Minnesota Timberwolves','LA Clippers',
  'Dallas Mavericks','Sacramento Kings','Phoenix Suns','New Orleans Pelicans',
  'San Antonio Spurs','Utah Jazz','Portland Trail Blazers',
];

const ROUND_LABELS: Record<PlayoffSeries['round'], string> = {
  playIn: 'Play-In Tournament',
  firstRound: 'First Round',
  semis: 'Conference Semifinals',
  finals: 'Conference Finals',
  nbaFinals: 'NBA Finals',
};

const ROUND_ORDER: PlayoffSeries['round'][] = ['playIn', 'firstRound', 'semis', 'finals', 'nbaFinals'];

interface CompleteEdit {
  series: PlayoffSeries;
  winnerId: string;
  finalScore: string;
  seriesMvpWinner: string;
}

interface SeriesEdit {
  id: string;
  round: PlayoffSeries['round'];
  conference: PlayoffSeries['conference'];
  homeTeamName: string;
  awayTeamName: string;
  homeTeamSeed: string;
  awayTeamSeed: string;
  homeOdds: string;
  awayOdds: string;
  deadline: string;
  seriesMvpPoints: string;
  winPoints: string;
}

function toLocalDatetimeValue(isoString: string): string {
  // Convert ISO string to the value format required by <input type="datetime-local">
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminSeriesList() {
  const queryClient = useQueryClient();
  const { data: allSeries = [], isLoading } = useQuery({
    queryKey: ['series'],
    queryFn: () => seriesApi.getAll().then((r) => r.data),
  });

  const [scoreEdit, setScoreEdit] = useState<{ id: string; homeWins: number; awayWins: number } | null>(null);
  const [completeEdit, setCompleteEdit] = useState<CompleteEdit | null>(null);
  const [seriesEdit, setSeriesEdit] = useState<SeriesEdit | null>(null);
  const [error, setError] = useState('');

  const handleUpdateScore = async () => {
    if (!scoreEdit) return;
    try {
      await adminApi.updateScore(scoreEdit.id, scoreEdit.homeWins, scoreEdit.awayWins);
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setScoreEdit(null);
    } catch {
      setError('Failed to update score');
    }
  };

  const handleComplete = async () => {
    if (!completeEdit) return;
    if (!completeEdit.winnerId) {
      setError('Please select a winner');
      return;
    }
    const isPlayIn = completeEdit.series.round === 'playIn';
    if (!isPlayIn && !completeEdit.finalScore) {
      setError('Please select final score');
      return;
    }
    try {
      await adminApi.completeSeries(
        completeEdit.series.id,
        completeEdit.winnerId,
        isPlayIn ? undefined : completeEdit.finalScore,
        completeEdit.seriesMvpWinner || undefined,
      );
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setCompleteEdit(null);
    } catch {
      setError('Failed to complete series');
    }
  };

  const handleLock = async (id: string, locked: boolean) => {
    try {
      await adminApi.lockSeries(id, locked);
      queryClient.invalidateQueries({ queryKey: ['series'] });
    } catch {
      setError('Failed to update lock status');
    }
  };

  const handleEditSeries = async () => {
    if (!seriesEdit) return;
    try {
      await adminApi.updateSeries(seriesEdit.id, {
        round: seriesEdit.round,
        conference: seriesEdit.conference,
        homeTeamName: seriesEdit.homeTeamName.trim(),
        awayTeamName: seriesEdit.awayTeamName.trim(),
        homeTeamSeed: parseInt(seriesEdit.homeTeamSeed),
        awayTeamSeed: parseInt(seriesEdit.awayTeamSeed),
        homeOdds: parseInt(seriesEdit.homeOdds),
        awayOdds: parseInt(seriesEdit.awayOdds),
        deadline: new Date(seriesEdit.deadline).toISOString(),
        seriesMvpPoints: parseInt(seriesEdit.seriesMvpPoints) || 0,
        winPoints: seriesEdit.winPoints ? parseInt(seriesEdit.winPoints) : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setSeriesEdit(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to update series';
      setError(msg);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this series? This cannot be undone.')) return;
    try {
      await adminApi.deleteSeries(id);
      queryClient.invalidateQueries({ queryKey: ['series'] });
    } catch {
      setError('Failed to delete series');
    }
  };

  if (isLoading) return <p className="text-gray-500">Loading series…</p>;

  const byRound = ROUND_ORDER.map((round) => ({
    round,
    items: allSeries.filter((s) => s.round === round),
  }));

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {byRound.map(({ round, items }) => {
        if (items.length === 0) return null;
        return (
          <div key={round}>
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              {round === 'playIn' && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">Play-In</span>
              )}
              {ROUND_LABELS[round]}
            </h3>
            <div className="space-y-2">
              {items.map((s) => (
                <div
                  key={s.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-gray-800 flex items-center gap-2">
                      #{s.homeTeamSeed} {s.homeTeamName} vs #{s.awayTeamSeed} {s.awayTeamName}
                      {s.homeOdds === 2.0 && s.awayOdds === 2.0 && s.status === 'pending' && (
                        <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                          ⚙ Needs configuration
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      {s.conference.toUpperCase()} ·{' '}
                      <span
                        className={`font-medium ${
                          s.status === 'complete'
                            ? 'text-gray-500'
                            : s.status === 'active'
                            ? 'text-green-600'
                            : 'text-yellow-600'
                        }`}
                      >
                        {s.status === 'complete'
                          ? s.round === 'playIn'
                            ? 'Complete'
                            : `Final: ${s.finalSeriesScore}`
                          : s.round === 'playIn'
                          ? s.status
                          : `${s.homeWins}–${s.awayWins}`}
                      </span>
                      {' · '}Deadline: {new Date(s.deadline).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.round !== 'playIn' && (
                        <>Odds: {s.homeTeamName} {s.homeOdds.toFixed(2)} / {s.awayTeamName} {s.awayOdds.toFixed(2)}</>
                      )}
                      {s.seriesMvpPoints > 0 && (
                        <span className="ml-2 text-purple-600">
                          MVP: {s.seriesMvpPoints} pts{s.seriesMvpWinner ? ` (${s.seriesMvpWinner})` : ''}
                        </span>
                      )}
                      {s.isLockedManually && <span className="ml-2 text-red-500 font-medium">🔒 Manually locked</span>}
                    </p>
                  </div>

                  {s.status !== 'complete' && (
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        onClick={() =>
                          setSeriesEdit({
                            id: s.id,
                            round: s.round,
                            conference: s.conference,
                            homeTeamName: s.homeTeamName,
                            awayTeamName: s.awayTeamName,
                            homeTeamSeed: String(s.homeTeamSeed),
                            awayTeamSeed: String(s.awayTeamSeed),
                            homeOdds: String(s.homeOdds),
                            awayOdds: String(s.awayOdds),
                            deadline: toLocalDatetimeValue(s.deadline),
                            seriesMvpPoints: String(s.seriesMvpPoints),
                            winPoints: s.winPoints != null ? String(s.winPoints) : '',
                          })
                        }
                        className="btn-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                      >
                        Edit
                      </button>
                      {s.round !== 'playIn' && (
                        <button
                          onClick={() => setScoreEdit({ id: s.id, homeWins: s.homeWins, awayWins: s.awayWins })}
                          className="btn-sm bg-blue-100 text-blue-700 hover:bg-blue-200"
                        >
                          Update Score
                        </button>
                      )}
                      <button
                        onClick={() => setCompleteEdit({ series: s, winnerId: '', finalScore: '4-0', seriesMvpWinner: '' })}
                        className="btn-sm bg-green-100 text-green-700 hover:bg-green-200"
                      >
                        Mark Complete
                      </button>
                      <button
                        onClick={() => handleLock(s.id, !s.isLockedManually)}
                        className="btn-sm bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                      >
                        {s.isLockedManually ? 'Unlock' : 'Lock'}
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="btn-sm bg-red-100 text-red-700 hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {allSeries.length === 0 && (
        <p className="text-gray-500 text-center py-8">No series created yet.</p>
      )}

      {/* Edit series modal */}
      {seriesEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-800 text-lg">Edit Series</h3>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm text-gray-600">Round</span>
                <select value={seriesEdit.round} onChange={(e) => setSeriesEdit({ ...seriesEdit, round: e.target.value as PlayoffSeries['round'] })} className="input mt-1 w-full">
                  <option value="playIn">Play-In</option>
                  <option value="firstRound">First Round</option>
                  <option value="semis">Conf. Semifinals</option>
                  <option value="finals">Conf. Finals</option>
                  <option value="nbaFinals">NBA Finals</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Conference</span>
                <select value={seriesEdit.conference} onChange={(e) => setSeriesEdit({ ...seriesEdit, conference: e.target.value as PlayoffSeries['conference'] })} className="input mt-1 w-full">
                  <option value="east">East</option>
                  <option value="west">West</option>
                  <option value="finals">Finals</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm text-gray-600">Home Team</span>
                <select value={seriesEdit.homeTeamName} onChange={(e) => setSeriesEdit({ ...seriesEdit, homeTeamName: e.target.value })} className="input mt-1 w-full">
                  <option value={seriesEdit.homeTeamName}>{seriesEdit.homeTeamName}</option>
                  {NBA_TEAMS.filter((t) => t !== seriesEdit.homeTeamName).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Away Team</span>
                <select value={seriesEdit.awayTeamName} onChange={(e) => setSeriesEdit({ ...seriesEdit, awayTeamName: e.target.value })} className="input mt-1 w-full">
                  <option value={seriesEdit.awayTeamName}>{seriesEdit.awayTeamName}</option>
                  {NBA_TEAMS.filter((t) => t !== seriesEdit.awayTeamName).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm text-gray-600">Home Seed</span>
                <input type="number" min={1} max={16} value={seriesEdit.homeTeamSeed} onChange={(e) => setSeriesEdit({ ...seriesEdit, homeTeamSeed: e.target.value })} className="input mt-1 w-full" />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Away Seed</span>
                <input type="number" min={1} max={16} value={seriesEdit.awayTeamSeed} onChange={(e) => setSeriesEdit({ ...seriesEdit, awayTeamSeed: e.target.value })} className="input mt-1 w-full" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm text-gray-600">Home ML Odds</span>
                <input type="number" step="1" value={seriesEdit.homeOdds} onChange={(e) => setSeriesEdit({ ...seriesEdit, homeOdds: e.target.value })} placeholder="-180 or +160" className="input mt-1 w-full" />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Away ML Odds</span>
                <input type="number" step="1" value={seriesEdit.awayOdds} onChange={(e) => setSeriesEdit({ ...seriesEdit, awayOdds: e.target.value })} placeholder="+160 or -180" className="input mt-1 w-full" />
              </label>
            </div>

            <label className="block">
              <span className="text-sm text-gray-600">Prediction Deadline</span>
              <input type="datetime-local" value={seriesEdit.deadline} onChange={(e) => setSeriesEdit({ ...seriesEdit, deadline: e.target.value })} className="input mt-1 w-full" />
            </label>

            <label className="block">
              <span className="text-sm text-gray-600">
                Win Points <span className="text-gray-400">(blank = use league default)</span>
              </span>
              <input type="number" min={1} value={seriesEdit.winPoints} onChange={(e) => setSeriesEdit({ ...seriesEdit, winPoints: e.target.value })} placeholder="e.g. 100" className="input mt-1 w-full" />
            </label>

            <label className="block">
              <span className="text-sm text-gray-600">
                Series MVP Points <span className="text-gray-400">(0 = disabled)</span>
              </span>
              <input type="number" min={0} value={seriesEdit.seriesMvpPoints} onChange={(e) => setSeriesEdit({ ...seriesEdit, seriesMvpPoints: e.target.value })} className="input mt-1 w-full" />
            </label>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setSeriesEdit(null)} className="flex-1 btn-outline">Cancel</button>
              <button onClick={handleEditSeries} className="flex-1 btn-primary">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Score update modal */}
      {scoreEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-4">Update Series Score</h3>
            <div className="flex gap-4 mb-4">
              {(['homeWins', 'awayWins'] as const).map((key) => (
                <label key={key} className="flex-1">
                  <span className="text-sm text-gray-600 block mb-1">
                    {key === 'homeWins' ? 'Home Wins' : 'Away Wins'}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={4}
                    value={scoreEdit[key]}
                    onChange={(e) =>
                      setScoreEdit({ ...scoreEdit, [key]: parseInt(e.target.value) || 0 })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-lg font-bold"
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setScoreEdit(null)} className="flex-1 btn-outline">Cancel</button>
              <button onClick={handleUpdateScore} className="flex-1 btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Complete series modal */}
      {completeEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-gray-800">
              Complete {completeEdit.series.round === 'playIn' ? 'Play-In Game' : 'Series'}
            </h3>

            <label className="block">
              <span className="text-sm text-gray-600 block mb-1">Winner</span>
              <div className="flex gap-2">
                {[
                  { id: completeEdit.series.homeTeamId, name: completeEdit.series.homeTeamName },
                  { id: completeEdit.series.awayTeamId, name: completeEdit.series.awayTeamName },
                ].map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setCompleteEdit({ ...completeEdit, winnerId: team.id })}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      completeEdit.winnerId === team.id
                        ? 'border-nba-blue bg-nba-blue text-white'
                        : 'border-gray-200 hover:border-nba-blue'
                    }`}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </label>

            {/* Final score — not for Play-In */}
            {completeEdit.series.round !== 'playIn' && (
              <label className="block">
                <span className="text-sm text-gray-600 block mb-1">Final Score</span>
                <div className="flex gap-2">
                  {(['4-0', '4-1', '4-2', '4-3'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCompleteEdit({ ...completeEdit, finalScore: s })}
                      className={`flex-1 py-2 rounded-lg border-2 font-mono text-sm font-medium transition-colors ${
                        completeEdit.finalScore === s
                          ? 'border-nba-blue bg-nba-blue text-white'
                          : 'border-gray-200 hover:border-nba-blue'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </label>
            )}

            {/* Series MVP winner */}
            {completeEdit.series.seriesMvpPoints > 0 && completeEdit.series.round !== 'playIn' && (
              <label className="block">
                <span className="text-sm text-gray-600 block mb-1">
                  Series MVP Winner{' '}
                  <span className="text-gray-400 font-normal">
                    (optional — awards {completeEdit.series.seriesMvpPoints} bonus pts)
                  </span>
                </span>
                <input
                  type="text"
                  value={completeEdit.seriesMvpWinner}
                  onChange={(e) => setCompleteEdit({ ...completeEdit, seriesMvpWinner: e.target.value })}
                  placeholder="e.g. LeBron James"
                  className="input w-full"
                />
              </label>
            )}

            <div className="flex gap-3">
              <button onClick={() => setCompleteEdit(null)} className="flex-1 btn-outline">Cancel</button>
              <button onClick={handleComplete} className="flex-1 btn-primary">Complete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
