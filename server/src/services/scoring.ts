import { Prediction, PlayoffSeries, League } from '../types';

export interface ScoreResult {
  winnerPoints: number;
  exactScorePoints: number;
  seriesMvpBonus: number;
  totalPoints: number;
}

/**
 * Convert American (moneyline) odds to raw implied probability.
 *   -200 → 200/300 = 0.667   (favorite)
 *   +170 → 100/270 = 0.370   (underdog)
 */
function mlToImpliedProb(odds: number): number {
  if (odds < 0) return (-odds) / (-odds + 100);
  return 100 / (odds + 100);
}

/**
 * Normalize home/away raw implied probs to sum to 1 (removes the bookmaker vig).
 */
function normalizedProbs(
  homeOdds: number,
  awayOdds: number,
): { home: number; away: number } {
  const rawHome = mlToImpliedProb(homeOdds);
  const rawAway = mlToImpliedProb(awayOdds);
  const total = rawHome + rawAway;
  return { home: rawHome / total, away: rawAway / total };
}

/**
 * Calculate the score for a single prediction against a completed series.
 *
 * Play-In formula:
 *   winner_points = PLAYIN_WIN_POINTS  (flat, no odds weighting)
 *
 * Regular series formula (American / moneyline odds):
 *   normalizedProbWinner = normalize(mlToImpliedProb(winnerOdds))
 *   winner_points        = BASE_WIN_POINTS * (1 − normalizedProbWinner)
 *
 *   Favorites (high prob) earn fewer points; underdogs earn more.
 *   The two picks always sum to exactly BASE_WIN_POINTS.
 *
 *   exact_score_bonus = BASE (same numeric scale as series win points, flat — no odds weighting)
 *   iff winner correct AND predicted 4-x line matches finalSeriesScore.
 *   (BASE = series.winPoints ?? league.baseWinPoints; league.exactScoreBonus is legacy / unused.)
 *
 * Series MVP bonus (both types, only when seriesMvpPoints > 0):
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
    const base = series.winPoints ?? league.playInWinPoints;
    const { home: homeProb, away: awayProb } = normalizedProbs(series.homeOdds, series.awayOdds);
    const isHomeWinner = series.winnerId === series.homeTeamId;
    const winnerProb = isHomeWinner ? homeProb : awayProb;
    winnerPoints = round2(base * (1 - winnerProb));
  } else {
    if (!series.finalSeriesScore) return zero;
    const base = series.winPoints ?? league.baseWinPoints;
    const isHomeWinner = series.winnerId === series.homeTeamId;
    const { home: homeProb, away: awayProb } = normalizedProbs(series.homeOdds, series.awayOdds);
    const winnerProb = isHomeWinner ? homeProb : awayProb;
    winnerPoints = round2(base * (1 - winnerProb));

    const correctExactScore = prediction.predictedSeriesScore === series.finalSeriesScore;
    // Flat bonus equal to the same "base" used for winner points — not multiplied by (1 − prob).
    exactScorePoints = correctExactScore ? round2(base) : 0;
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
