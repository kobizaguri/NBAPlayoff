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
  baseWinPoints?: number;
  playInWinPoints?: number;
}

const SCORE_OPTIONS = ['4-0', '4-1', '4-2', '4-3'] as const;

function isLocked(series: PlayoffSeries): boolean {
  return series.isLockedManually || new Date(series.deadline) <= new Date();
}

export function PredictionPanel({ series, leagueId, existingPrediction, onClose, baseWinPoints, playInWinPoints }: Props) {
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

  function mlToRawProb(odds: number) {
    return odds < 0 ? (-odds) / (-odds + 100) : 100 / (odds + 100);
  }
  const rawHome = mlToRawProb(series.homeOdds);
  const rawAway = mlToRawProb(series.awayOdds);
  const vigTotal = rawHome + rawAway;
  const homeImplied = ((rawHome / vigTotal) * 100).toFixed(1);
  const awayImplied = ((rawAway / vigTotal) * 100).toFixed(1);
  const effectiveBase = series.winPoints ?? (isPlayIn ? playInWinPoints : baseWinPoints);
  const homePts = effectiveBase !== undefined ? Math.round(effectiveBase * (1 - rawHome / vigTotal)) : null;
  const awayPts = effectiveBase !== undefined ? Math.round(effectiveBase * (1 - rawAway / vigTotal)) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[min(92dvh,100vh)] my-auto flex flex-col overflow-hidden touch-manipulation">
        {/* Header */}
        <div className="bg-nba-blue text-white rounded-t-xl px-4 py-3 sm:px-6 sm:py-4 relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-10 text-white/80 hover:text-white text-2xl leading-none p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
          <div className="min-w-0 pr-12">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-base sm:text-lg leading-snug">
                <span className="block">{series.homeTeamName}</span>
                <span className="block text-sm font-semibold text-blue-100 mt-0.5">
                  vs {series.awayTeamName}
                </span>
              </h2>
              {isPlayIn && (
                <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold shrink-0">
                  Play-In
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-blue-200 mt-2 break-words">
              {series.status === 'complete'
                ? isPlayIn
                  ? 'Completed'
                  : `Completed — ${series.finalSeriesScore}`
                : locked
                ? 'Locked — no more predictions'
                : `Deadline: ${new Date(series.deadline).toLocaleString()}`}
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {/* Odds display — not shown for playIn */}
          {!isPlayIn && (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-5 sm:mb-6">
              {[
                { teamId: series.homeTeamId, name: series.homeTeamName, seed: series.homeTeamSeed, odds: series.homeOdds, implied: homeImplied, pts: homePts },
                { teamId: series.awayTeamId, name: series.awayTeamName, seed: series.awayTeamSeed, odds: series.awayOdds, implied: awayImplied, pts: awayPts },
              ].map((team) => (
                <div key={team.teamId} className="flex-1 min-w-0 border rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">#{team.seed}</div>
                  <div className="font-semibold text-gray-800 text-sm sm:text-base break-words">{team.name}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    ML: <span className="font-mono">{team.odds > 0 ? `+${team.odds}` : team.odds}</span>
                  </div>
                  {team.pts !== null ? (
                    <div className="text-base font-bold text-nba-blue mt-1">
                      {team.pts} pts
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">
                      Win prob: {team.implied}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Current score if active (non-playIn) */}
          {series.status !== 'pending' && !isPlayIn && (
            <div className="text-center mb-4 text-gray-700 font-medium text-sm sm:text-base px-1">
              <span className="block sm:inline">Current score:</span>{' '}
              <span className="font-bold block sm:inline mt-1 sm:mt-0">
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
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  {[
                    { teamId: series.homeTeamId, name: series.homeTeamName },
                    { teamId: series.awayTeamId, name: series.awayTeamName },
                  ].map((team) => (
                    <button
                      key={team.teamId}
                      type="button"
                      onClick={() => setWinnerId(team.teamId)}
                      className={`flex-1 min-h-[44px] py-2.5 px-3 rounded-lg border-2 font-medium text-sm text-center transition-colors break-words ${
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
                  <p className="text-xs text-gray-500 mb-2">
                    If you pick the winner <em>and</em> the right 4-x line, you get upset-weighted winner pts
                    plus <strong>{effectiveBase ?? '—'}</strong> extra flat pts (same as this series&apos; base,
                    not odds-based).
                  </p>
                  <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
                    {SCORE_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setScore(s)}
                        className={`min-h-[44px] sm:min-h-0 sm:flex-1 py-2.5 sm:py-2 rounded-lg border-2 font-mono font-medium text-sm transition-colors ${
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
