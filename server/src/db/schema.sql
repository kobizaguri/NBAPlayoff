CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY,
  username              TEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,
  display_name          TEXT NOT NULL,
  avatar_url            TEXT,
  is_admin              BOOLEAN NOT NULL DEFAULT false,
  notification_prefs    JSONB NOT NULL DEFAULT '{"leagueInvite":true,"deadlineApproaching":true,"seriesResult":true}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leagues (
  id                    UUID PRIMARY KEY,
  name                  TEXT NOT NULL UNIQUE,
  invite_code           TEXT NOT NULL UNIQUE,
  password_hash         TEXT,
  commissioner_id       UUID NOT NULL REFERENCES users(id),
  is_public             BOOLEAN NOT NULL DEFAULT true,
  max_members           INT NOT NULL DEFAULT 20,
  base_win_points       INT NOT NULL DEFAULT 100,
  exact_score_bonus     INT NOT NULL DEFAULT 50,
  play_in_win_points    INT NOT NULL DEFAULT 50,
  mvp_points            INT NOT NULL DEFAULT 100,
  mvp_deadline          TIMESTAMPTZ NOT NULL,
  finals_actual_mvp     TEXT,
  perfect_round_bonuses JSONB NOT NULL DEFAULT '{}',
  champion_pick_deadline TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS league_members (
  league_id   UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, user_id)
);

CREATE TABLE IF NOT EXISTS series (
  id                  UUID PRIMARY KEY,
  round               TEXT NOT NULL CHECK (round IN ('playIn','firstRound','semis','finals','nbaFinals')),
  conference          TEXT NOT NULL CHECK (conference IN ('east','west','finals')),
  home_team_id        UUID NOT NULL,
  away_team_id        UUID NOT NULL,
  home_team_name      TEXT NOT NULL,
  away_team_name      TEXT NOT NULL,
  home_team_seed      INT NOT NULL,
  away_team_seed      INT NOT NULL,
  home_odds           NUMERIC(6,2) NOT NULL,
  away_odds           NUMERIC(6,2) NOT NULL,
  odds_locked_at      TIMESTAMPTZ,
  home_wins           INT NOT NULL DEFAULT 0,
  away_wins           INT NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','complete')),
  winner_id           UUID,
  final_series_score  TEXT,
  series_mvp_points   INT NOT NULL DEFAULT 0,
  series_mvp_winner   TEXT,
  win_points          INT,
  deadline            TIMESTAMPTZ NOT NULL,
  is_locked_manually  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS predictions (
  id                      UUID PRIMARY KEY,
  user_id                 UUID NOT NULL REFERENCES users(id),
  league_id               UUID NOT NULL REFERENCES leagues(id),
  series_id               UUID NOT NULL REFERENCES series(id),
  predicted_winner_id     UUID NOT NULL,
  predicted_series_score  TEXT,
  predicted_series_mvp    TEXT,
  is_locked               BOOLEAN NOT NULL DEFAULT false,
  winner_points           NUMERIC(8,2) NOT NULL DEFAULT 0,
  exact_score_points      INT NOT NULL DEFAULT 0,
  series_mvp_bonus        INT NOT NULL DEFAULT 0,
  total_points            NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, league_id, series_id)
);

CREATE TABLE IF NOT EXISTS league_perfect_round_awards (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round     TEXT NOT NULL CHECK (round IN ('firstRound','semis','finals','nbaFinals')),
  points    INT NOT NULL,
  PRIMARY KEY (league_id, user_id, round)
);

CREATE TABLE IF NOT EXISTS league_champion_team_points (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id   UUID NOT NULL,
  points    INT NOT NULL,
  PRIMARY KEY (league_id, team_id)
);

CREATE TABLE IF NOT EXISTS league_champion_picks (
  id              UUID PRIMARY KEY,
  league_id       UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id         UUID NOT NULL,
  points_awarded  INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

CREATE TABLE IF NOT EXISTS league_mvp_picks (
  id              UUID PRIMARY KEY,
  league_id       UUID NOT NULL REFERENCES leagues(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  player_name     TEXT NOT NULL,
  is_locked       BOOLEAN NOT NULL DEFAULT false,
  points_awarded  INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL CHECK (type IN ('leagueInvite','deadlineApproaching','seriesResult')),
  payload     JSONB NOT NULL DEFAULT '{}',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token       TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL
);
