import { PlayoffSeries, PerfectRoundBonuses } from '../types';
import * as leaguesDb from '../db/leagues';
import * as predictionsDb from '../db/predictions';
import { replacePerfectRoundAwards } from '../db/leaguePerfectRoundAwards';

const ROUNDS: (keyof PerfectRoundBonuses)[] = ['firstRound', 'semis', 'finals', 'nbaFinals'];

/**
 * Recomputes perfect-round awards for one league from live series + predictions.
 */
export async function recalculatePerfectRoundAwardsForLeague(
  leagueId: string,
  bonuses: PerfectRoundBonuses,
  allSeries: PlayoffSeries[],
): Promise<void> {
  const rows: { userId: string; round: string; points: number }[] = [];

  for (const round of ROUNDS) {
    const bonus = bonuses[round];
    if (typeof bonus !== 'number' || bonus <= 0) continue;

    const roundSeries = allSeries.filter((s) => s.round === round);
    if (roundSeries.length === 0) continue;
    if (!roundSeries.every((s) => s.status === 'complete' && s.winnerId)) continue;

    const members = await leaguesDb.getMembersByLeague(leagueId);
    const preds = await predictionsDb.getPredictionsByLeague(leagueId);

    for (const m of members) {
      let allCorrect = true;
      for (const s of roundSeries) {
        const p = preds.find((x) => x.userId === m.userId && x.seriesId === s.id);
        if (!p || p.predictedWinnerId !== s.winnerId) {
          allCorrect = false;
          break;
        }
      }
      if (allCorrect) {
        rows.push({ userId: m.userId, round, points: bonus });
      }
    }
  }

  await replacePerfectRoundAwards(leagueId, rows);
}

export async function recalculatePerfectRoundAwardsForAllLeagues(
  allSeries: PlayoffSeries[],
): Promise<void> {
  const leagues = await leaguesDb.getAllLeagues();
  for (const league of leagues) {
    await recalculatePerfectRoundAwardsForLeague(
      league.id,
      (league.perfectRoundBonuses ?? {}) as PerfectRoundBonuses,
      allSeries,
    );
  }
}
