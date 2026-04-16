import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pool from '../db';
import { User, League, LeagueMember, PlayoffSeries, Prediction, LeagueMVPPick, Notification, RefreshToken } from '../types';

const DATA_DIR = path.join(__dirname, '../../../data');

function readJson<T>(name: string): T[] {
  const fp = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, 'utf-8')) as T[];
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users
    const users = readJson<User>('users');
    for (const u of users) {
      await client.query(
        `INSERT INTO users (id,username,password_hash,display_name,avatar_url,is_admin,notification_prefs,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [u.id, u.username, u.passwordHash, u.displayName, u.avatarUrl ?? null,
         u.isAdmin, JSON.stringify(u.notificationPreferences), u.createdAt],
      );
    }
    console.log(`Seeded ${users.length} users`);

    // Leagues
    const leagues = readJson<League>('leagues');
    for (const l of leagues) {
      await client.query(
        `INSERT INTO leagues (id,name,invite_code,password_hash,commissioner_id,is_public,max_members,
          base_win_points,exact_score_bonus,play_in_win_points,mvp_points,mvp_deadline,finals_actual_mvp,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
        [l.id, l.name, l.inviteCode, l.passwordHash ?? null, l.commissionerId,
         l.isPublic, l.maxMembers, l.baseWinPoints, l.exactScoreBonus, l.playInWinPoints,
         l.mvpPoints, l.mvpDeadline, l.finalsActualMvp ?? null, l.createdAt],
      );
    }
    console.log(`Seeded ${leagues.length} leagues`);

    // Members
    const members = readJson<LeagueMember>('members');
    for (const m of members) {
      await client.query(
        `INSERT INTO league_members (league_id,user_id,joined_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [m.leagueId, m.userId, m.joinedAt],
      );
    }
    console.log(`Seeded ${members.length} members`);

    // Series
    const series = readJson<PlayoffSeries>('series');
    for (const s of series) {
      await client.query(
        `INSERT INTO series (id,round,conference,home_team_id,away_team_id,home_team_name,away_team_name,
          home_team_seed,away_team_seed,home_odds,away_odds,odds_locked_at,home_wins,away_wins,status,
          winner_id,final_series_score,series_mvp_points,series_mvp_winner,deadline,is_locked_manually)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) ON CONFLICT (id) DO NOTHING`,
        [s.id, s.round, s.conference, s.homeTeamId, s.awayTeamId, s.homeTeamName, s.awayTeamName,
         s.homeTeamSeed, s.awayTeamSeed, s.homeOdds, s.awayOdds, s.oddsLockedAt ?? null,
         s.homeWins, s.awayWins, s.status, s.winnerId ?? null, s.finalSeriesScore ?? null,
         s.seriesMvpPoints, s.seriesMvpWinner ?? null, s.deadline, s.isLockedManually],
      );
    }
    console.log(`Seeded ${series.length} series`);

    // Predictions
    const predictions = readJson<Prediction>('predictions');
    for (const p of predictions) {
      await client.query(
        `INSERT INTO predictions (id,user_id,league_id,series_id,predicted_winner_id,predicted_series_score,
          predicted_series_mvp,is_locked,winner_points,exact_score_points,series_mvp_bonus,total_points,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
        [p.id, p.userId, p.leagueId, p.seriesId, p.predictedWinnerId, p.predictedSeriesScore ?? null,
         p.predictedSeriesMvp ?? null, p.isLocked, p.winnerPoints, p.exactScorePoints,
         p.seriesMvpBonus, p.totalPoints, p.createdAt, p.updatedAt],
      );
    }
    console.log(`Seeded ${predictions.length} predictions`);

    // MVP picks
    const picks = readJson<LeagueMVPPick>('leagueMvpPicks');
    for (const pk of picks) {
      await client.query(
        `INSERT INTO league_mvp_picks (id,league_id,user_id,player_name,is_locked,points_awarded,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [pk.id, pk.leagueId, pk.userId, pk.playerName, pk.isLocked, pk.pointsAwarded, pk.createdAt, pk.updatedAt],
      );
    }
    console.log(`Seeded ${picks.length} MVP picks`);

    // Notifications
    const notifications = readJson<Notification>('notifications');
    for (const n of notifications) {
      await client.query(
        `INSERT INTO notifications (id,user_id,type,payload,read_at,created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [n.id, n.userId, n.type, JSON.stringify(n.payload), n.readAt ?? null, n.createdAt],
      );
    }
    console.log(`Seeded ${notifications.length} notifications`);

    // Refresh tokens
    const tokens = readJson<RefreshToken>('refreshTokens');
    for (const t of tokens) {
      await client.query(
        `INSERT INTO refresh_tokens (token,user_id,expires_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [t.token, t.userId, t.expiresAt],
      );
    }
    console.log(`Seeded ${tokens.length} refresh tokens`);

    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
