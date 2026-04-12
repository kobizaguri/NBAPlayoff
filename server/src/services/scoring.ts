import { Prediction, PlayoffSeries, League } from '../types';

export interface ScoreResult {
  winnerPoints: number;
  exactScorePoints: number;
  totalPoints: number;
}

/**
 * Calculate the score for a single prediction against a completed series.
 *
 * Formula:
 *   implied_prob_winner  = 1 / decimal_odds_winner
 *   winner_points        = BASE_WIN_POINTS * (1 − implied_prob_winner)
 *   exact_score_bonus    = EXACT_SCORE_BONUS  (iff winner correct AND score correct)
 */
export function calculateScore(
  prediction: Prediction,
  series: PlayoffSeries,
  league: League,
): ScoreResult {
  const zero: ScoreResult = { winnerPoints: 0, exactScorePoints: 0, totalPoints: 0 };

  if (series.status !== 'complete' || !series.winnerId || !series.finalSeriesScore) {
    return zero;
  }

  const correctWinner = prediction.predictedWinnerId === series.winnerId;
  if (!correctWinner) return zero;

  const isHomeWinner = series.winnerId === series.homeTeamId;
  const winnerOdds = isHomeWinner ? series.homeOdds : series.awayOdds;
  const impliedProbWinner = 1 / winnerOdds;
  const winnerPoints = round2(league.baseWinPoints * (1 - impliedProbWinner));

  const correctExactScore = prediction.predictedSeriesScore === series.finalSeriesScore;
  const exactScorePoints = correctExactScore ? league.exactScoreBonus : 0;

  return { winnerPoints, exactScorePoints, totalPoints: round2(winnerPoints + exactScorePoints) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
