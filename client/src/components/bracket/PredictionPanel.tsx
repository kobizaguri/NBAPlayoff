import { useState } from 'react';
import { PlayoffSeries, Prediction } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { predictionsApi } from '../../api/predictions';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  series: PlayoffSeries;
  leagueId: string;
  existingPrediction?: Prediction;
  onClose: () => void;
}

const SCORE_OPTIONS = ['4-0', '4-1', '4-2', '4-3'] as const;

function isLocked(series: PlayoffSeries): boolean {
  return series.isLockedManually || new Date(series.deadline) <= new Date();
}

export function PredictionPanel({ series, leagueId, existingPrediction, onClose }: Props) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isPlayIn = series.round === 'playIn';
  const hasMvpField = series.seriesMvpPoints > 0 && !isPlayIn;

  const [winnerId, setWinnerId] = useState(existingPrediction?.predictedWinnerId ?? '');
  const [score, setScore] = useState(existingPrediction?.predictedSeriesScore ?? '4-0');
  const [seriesMvp, setSeriesMvp] = useState(existingPrediction?.predictedSeriesMvp ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const locked = isLocked(series) || series.status === 'complete';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!winnerId) {
      setError('Please select a winner');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await predictionsApi.upsert(
        leagueId,
        series.id,
        winnerId,
        isPlayIn ? undefined : score,
        hasMvpField ? seriesMvp || undefined : undefined,
      );
      queryClient.invalidateQueries({ queryKey: ['predictions', leagueId] });
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to save prediction';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const homeImplied = ((1 / series.homeOdds) * 100).toFixed(1);
  const awayImplied = ((1 / series.awayOdds) * 100).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-nba-blue text-white rounded-t-xl px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg">
                {series.homeTeamName} vs {series.awayTeamName}
              </h2>
              {isPlayIn && (
                <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold">
                  Play-In
                </span>
              )}
            </div>
            <p className="text-sm text-blue-200">
              {series.status === 'complete'
                ? isPlayIn
                  ? 'Completed'
                  : `Completed — ${series.finalSeriesScore}`
                : locked
                ? 'Locked — no more predictions'
                : `Deadline: ${new Date(series.deadline).toLocaleString()}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Odds display — not shown for playIn */}
          {!isPlayIn && (
            <div className="flex gap-4 mb-6">
              {[
                { teamId: series.homeTeamId, name: series.homeTeamName, seed: series.homeTeamSeed, odds: series.homeOdds, implied: homeImplied },
                { teamId: series.awayTeamId, name: series.awayTeamName, seed: series.awayTeamSeed, odds: series.awayOdds, implied: awayImplied },
              ].map((team) => (
                <div key={team.teamId} className="flex-1 border rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">#{team.seed}</div>
                  <div className="font-semibold text-gray-800">{team.name}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Odds: <span className="font-mono">{team.odds.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Implied: {team.implied}%
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Current score if active (non-playIn) */}
          {series.status !== 'pending' && !isPlayIn && (
            <div className="text-center mb-4 text-gray-700 font-medium">
              Current score:{' '}
              <span className="font-bold">
                {series.homeTeamName} {series.homeWins} – {series.awayWins} {series.awayTeamName}
              </span>
            </div>
          )}

          {locked || series.status === 'complete' ? (
            /* Read-only view */
            existingPrediction ? (
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">Your prediction</p>
                <p className="font-bold text-gray-800">
                  {existingPrediction.predictedWinnerId === series.homeTeamId
                    ? series.homeTeamName
                    : series.awayTeamName}
                  {!isPlayIn && existingPrediction.predictedSeriesScore
                    ? ` in ${existingPrediction.predictedSeriesScore}`
                    : ''}
                </p>
                {existingPrediction.predictedSeriesMvp && (
                  <p className="text-sm text-gray-600 mt-1">
                    Series MVP pick: <span className="font-medium">{existingPrediction.predictedSeriesMvp}</span>
                  </p>
                )}
                {existingPrediction.isLocked && existingPrediction.totalPoints > 0 && (
                  <p className="mt-2 text-green-600 font-bold text-lg">
                    +{existingPrediction.totalPoints} pts
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-500 text-sm">
                {user ? 'No prediction submitted.' : 'Log in to see predictions.'}
              </p>
            )
          ) : (
            /* Editable form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Who will win?
                </label>
                <div className="flex gap-3">
                  {[
                    { teamId: series.homeTeamId, name: series.homeTeamName },
                    { teamId: series.awayTeamId, name: series.awayTeamName },
                  ].map((team) => (
                    <button
                      key={team.teamId}
                      type="button"
                      onClick={() => setWinnerId(team.teamId)}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                        winnerId === team.teamId
                          ? 'border-nba-blue bg-nba-blue text-white'
                          : 'border-gray-200 hover:border-nba-blue text-gray-700'
                      }`}
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Series length — not shown for Play-In */}
              {!isPlayIn && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Series length
                  </label>
                  <div className="flex gap-2">
                    {SCORE_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setScore(s)}
                        className={`flex-1 py-2 rounded-lg border-2 font-mono font-medium text-sm transition-colors ${
                          score === s
                            ? 'border-nba-blue bg-nba-blue text-white'
                            : 'border-gray-200 hover:border-nba-blue text-gray-700'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Series MVP pick — only when enabled */}
              {hasMvpField && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Series MVP pick{' '}
                    <span className="text-gray-400 font-normal">
                      (+{series.seriesMvpPoints} pts if correct)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={seriesMvp}
                    onChange={(e) => setSeriesMvp(e.target.value)}
                    placeholder="e.g. LeBron James"
                    className="input w-full"
                  />
                </div>
              )}

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-nba-blue text-white py-2.5 rounded-lg font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : existingPrediction ? 'Update Prediction' : 'Submit Prediction'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
