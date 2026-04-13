import { Prediction, PlayoffSeries, League } from '../types';

export interface ScoreResult {
  winnerPoints: number;
  exactScorePoints: number;
  seriesMvpBonus: number;
  totalPoints: number;
}

/**
 * Calculate the score for a single prediction against a completed series.
 *
 * Play-In formula:
 *   winner_points = PLAYIN_WIN_POINTS  (flat, no odds weighting)
 *
 * Regular series formula:
 *   implied_prob_winner  = 1 / decimal_odds_winner
 *   winner_points        = BASE_WIN_POINTS * (1 − implied_prob_winner)
 *   exact_score_bonus    = EXACT_SCORE_BONUS  (iff winner correct AND score correct)
 *
 * Series MVP bonus (both types, but only when seriesMvpPoints > 0):
 *   series_mvp_bonus = seriesMvpPoints  (if predictedSeriesMvp matches seriesMvpWinner, case-insensitive)
 */
export function calculateScore(
  prediction: Prediction,
  series: PlayoffSeries,
  league: League,
): ScoreResult {
  const zero: ScoreResult = { winnerPoints: 0, exactScorePoints: 0, seriesMvpBonus: 0, totalPoints: 0 };

  if (series.status !== 'complete' || !series.winnerId) {
    return zero;
  }

  const correctWinner = prediction.predictedWinnerId === series.winnerId;
  if (!correctWinner) {
    // Still check series MVP even if winner is wrong
    const mvpBonus = calcSeriesMvpBonus(prediction, series);
    return { ...zero, seriesMvpBonus: mvpBonus, totalPoints: mvpBonus };
  }

  let winnerPoints: number;
  let exactScorePoints = 0;

  if (series.round === 'playIn') {
    // Flat points, no odds weighting
    winnerPoints = league.playInWinPoints;
  } else {
    if (!series.finalSeriesScore) return zero;
    const isHomeWinner = series.winnerId === series.homeTeamId;
    const winnerOdds = isHomeWinner ? series.homeOdds : series.awayOdds;
    const impliedProbWinner = 1 / winnerOdds;
    winnerPoints = round2(league.baseWinPoints * (1 - impliedProbWinner));

    const correctExactScore = prediction.predictedSeriesScore === series.finalSeriesScore;
    exactScorePoints = correctExactScore ? league.exactScoreBonus : 0;
  }

  const seriesMvpBonus = calcSeriesMvpBonus(prediction, series);

  return {
    winnerPoints,
    exactScorePoints,
    seriesMvpBonus,
    totalPoints: round2(winnerPoints + exactScorePoints + seriesMvpBonus),
  };
}

function calcSeriesMvpBonus(prediction: Prediction, series: PlayoffSeries): number {
  if (!series.seriesMvpPoints || !series.seriesMvpWinner || !prediction.predictedSeriesMvp) {
    return 0;
  }
  const match =
    prediction.predictedSeriesMvp.trim().toLowerCase() ===
    series.seriesMvpWinner.trim().toLowerCase();
  return match ? series.seriesMvpPoints : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
