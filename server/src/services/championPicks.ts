import { PlayoffSeries } from '../types';
import * as championDb from '../db/leagueChampion';
import * as leaguesDb from '../db/leagues';

export function getNbaFinalsWinnerTeamId(allSeries: PlayoffSeries[]): string | null {
  const finals = allSeries.filter((s) => s.round === 'nbaFinals' && s.status === 'complete' && s.winnerId);
  if (finals.length === 0) return null;
  return finals[0].winnerId ?? null;
}

/**
 * Builds a map teamId -> display name from first-round series (playoff field).
 */
export function getPlayoffTeamsFromSeries(allSeries: PlayoffSeries[]): { teamId: string; teamName: string }[] {
  const byId = new Map<string, string>();
  for (const s of allSeries) {
    if (s.round !== 'firstRound') continue;
    byId.set(s.homeTeamId, s.homeTeamName);
    byId.set(s.awayTeamId, s.awayTeamName);
  }
  return [...byId.entries()].map(([teamId, teamName]) => ({ teamId, teamName }));
}

export async function recalculateChampionAwardsForLeague(
  leagueId: string,
  allSeries: PlayoffSeries[],
): Promise<void> {
  const winnerId = getNbaFinalsWinnerTeamId(allSeries);
  const rows = await championDb.getChampionTeamPoints(leagueId);
  const pointByTeam = new Map(rows.map((r) => [r.teamId, r.points]));
  await championDb.updateChampionPickAwardsForLeague(leagueId, winnerId, pointByTeam);
}

export async function recalculateChampionAwardsForAllLeagues(allSeries: PlayoffSeries[]): Promise<void> {
  const leagues = await leaguesDb.getAllLeagues();
  for (const l of leagues) {
    await recalculateChampionAwardsForLeague(l.id, allSeries);
  }
}
