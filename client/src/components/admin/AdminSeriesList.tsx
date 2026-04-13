import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { seriesApi } from '../../api/series';
import { PlayoffSeries } from '../../types';

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

export function AdminSeriesList() {
  const queryClient = useQueryClient();
  const { data: allSeries = [], isLoading } = useQuery({
    queryKey: ['series'],
    queryFn: () => seriesApi.getAll().then((r) => r.data),
  });

  const [scoreEdit, setScoreEdit] = useState<{ id: string; homeWins: number; awayWins: number } | null>(null);
  const [completeEdit, setCompleteEdit] = useState<CompleteEdit | null>(null);
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
                    <p className="font-medium text-gray-800">
                      #{s.homeTeamSeed} {s.homeTeamName} vs #{s.awayTeamSeed} {s.awayTeamName}
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
