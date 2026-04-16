import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { PlayoffSeries } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface NBATeam { name: string; seed: number; conference: 'east' | 'west'; }

const NBA_TEAMS: NBATeam[] = [
  // East
  { name: 'Boston Celtics',        seed: 1,  conference: 'east' },
  { name: 'New York Knicks',       seed: 2,  conference: 'east' },
  { name: 'Cleveland Cavaliers',   seed: 3,  conference: 'east' },
  { name: 'Indiana Pacers',        seed: 4,  conference: 'east' },
  { name: 'Milwaukee Bucks',       seed: 5,  conference: 'east' },
  { name: 'Detroit Pistons',       seed: 6,  conference: 'east' },
  { name: 'Miami Heat',            seed: 7,  conference: 'east' },
  { name: 'Orlando Magic',         seed: 8,  conference: 'east' },
  { name: 'Chicago Bulls',         seed: 9,  conference: 'east' },
  { name: 'Atlanta Hawks',         seed: 10, conference: 'east' },
  { name: 'Philadelphia 76ers',    seed: 11, conference: 'east' },
  { name: 'Toronto Raptors',       seed: 12, conference: 'east' },
  { name: 'Charlotte Hornets',     seed: 13, conference: 'east' },
  { name: 'Brooklyn Nets',         seed: 14, conference: 'east' },
  { name: 'Washington Wizards',    seed: 15, conference: 'east' },
  // West
  { name: 'Oklahoma City Thunder', seed: 1,  conference: 'west' },
  { name: 'Houston Rockets',       seed: 2,  conference: 'west' },
  { name: 'Los Angeles Lakers',    seed: 3,  conference: 'west' },
  { name: 'Denver Nuggets',        seed: 4,  conference: 'west' },
  { name: 'Memphis Grizzlies',     seed: 5,  conference: 'west' },
  { name: 'Golden State Warriors', seed: 6,  conference: 'west' },
  { name: 'Minnesota Timberwolves',seed: 7,  conference: 'west' },
  { name: 'LA Clippers',           seed: 8,  conference: 'west' },
  { name: 'Dallas Mavericks',      seed: 9,  conference: 'west' },
  { name: 'Sacramento Kings',      seed: 10, conference: 'west' },
  { name: 'Phoenix Suns',          seed: 11, conference: 'west' },
  { name: 'New Orleans Pelicans',  seed: 12, conference: 'west' },
  { name: 'San Antonio Spurs',     seed: 13, conference: 'west' },
  { name: 'Utah Jazz',             seed: 14, conference: 'west' },
  { name: 'Portland Trail Blazers',seed: 15, conference: 'west' },
];

/** Select value for placeholder team row (must match `selectTeam` branch). */
const TBD_TEAM_VALUE = 'TBD';

interface FormState {
  round: PlayoffSeries['round'];
  conference: PlayoffSeries['conference'];
  homeTeamName: string;
  awayTeamName: string;
  homeTeamSeed: string;
  awayTeamSeed: string;
  homeOdds: string;
  awayOdds: string;
  deadline: string;
  seriesMvpPoints: string;
  winPoints: string;
}

const INITIAL: FormState = {
  round: 'firstRound',
  conference: 'east',
  homeTeamName: '',
  awayTeamName: '',
  homeTeamSeed: '',
  awayTeamSeed: '',
  homeOdds: '',
  awayOdds: '',
  deadline: '',
  seriesMvpPoints: '0',
  winPoints: '',
};

export function AdminSeriesForm({ onCreated }: { onCreated?: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const selectTeam = (side: 'home' | 'away') => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === TBD_TEAM_VALUE) {
      setForm((f) => ({
        ...f,
        [side === 'home' ? 'homeTeamName' : 'awayTeamName']: 'TBD',
        [side === 'home' ? 'homeTeamSeed' : 'awayTeamSeed']: side === 'home' ? '8' : '9',
      }));
      return;
    }
    const team = NBA_TEAMS.find((t) => t.name === v);
    if (!team) return;
    setForm((f) => ({
      ...f,
      [side === 'home' ? 'homeTeamName' : 'awayTeamName']: team.name,
      [side === 'home' ? 'homeTeamSeed' : 'awayTeamSeed']: String(team.seed),
    }));
  };

  const isPlayIn = form.round === 'playIn';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSubmitting(true);
    try {
      const homeId = uuidv4();
      const awayId = uuidv4();
      await adminApi.createSeries({
        round: form.round,
        conference: form.conference,
        homeTeamId: homeId,
        awayTeamId: awayId,
        homeTeamName: form.homeTeamName.trim(),
        awayTeamName: form.awayTeamName.trim(),
        homeTeamSeed: parseInt(form.homeTeamSeed),
        awayTeamSeed: parseInt(form.awayTeamSeed),
        homeOdds: parseInt(form.homeOdds),
        awayOdds: parseInt(form.awayOdds),
        deadline: new Date(form.deadline).toISOString(),
        seriesMvpPoints: parseInt(form.seriesMvpPoints) || 0,
        winPoints: form.winPoints ? parseInt(form.winPoints) : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setForm(INITIAL);
      setSuccess(true);
      onCreated?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to create series';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
      <h3 className="font-bold text-gray-800 text-lg">Add New Series</h3>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-gray-600">Round</span>
          <select value={form.round} onChange={set('round')} required className="input mt-1 w-full">
            <option value="playIn">Play-In</option>
            <option value="firstRound">First Round</option>
            <option value="semis">Conf. Semifinals</option>
            <option value="finals">Conf. Finals</option>
            <option value="nbaFinals">NBA Finals</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">Conference</span>
          <select value={form.conference} onChange={set('conference')} required className="input mt-1 w-full">
            <option value="east">East</option>
            <option value="west">West</option>
            <option value="finals">Finals</option>
          </select>
        </label>
      </div>

      {/* Team dropdowns */}
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-gray-600">Home Team</span>
          <select
            value={form.homeTeamName}
            onChange={selectTeam('home')}
            required
            className="input mt-1 w-full"
          >
            <option value="">— select team —</option>
            <option value={TBD_TEAM_VALUE}>TBD (placeholder — edit series later)</option>
            <optgroup label="Eastern Conference">
              {NBA_TEAMS.filter((t) => t.conference === 'east').map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </optgroup>
            <optgroup label="Western Conference">
              {NBA_TEAMS.filter((t) => t.conference === 'west').map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Away Team</span>
          <select
            value={form.awayTeamName}
            onChange={selectTeam('away')}
            required
            className="input mt-1 w-full"
          >
            <option value="">— select team —</option>
            <option value={TBD_TEAM_VALUE}>TBD (placeholder — edit series later)</option>
            <optgroup label="Eastern Conference">
              {NBA_TEAMS.filter((t) => t.conference === 'east').map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </optgroup>
            <optgroup label="Western Conference">
              {NBA_TEAMS.filter((t) => t.conference === 'west').map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>

      <button
        type="button"
        className="btn-secondary btn-sm text-xs w-full sm:w-auto"
        onClick={() =>
          setForm((f) => ({
            ...f,
            homeTeamName: 'TBD',
            awayTeamName: 'TBD',
            homeTeamSeed: '8',
            awayTeamSeed: '9',
          }))
        }
      >
        Set both teams to TBD placeholders
      </button>
      <p className="text-xs text-gray-500 -mt-2">
        Placeholder rows keep stable team IDs for picks. Update names, seeds, and odds later via{' '}
        <strong>Edit</strong> on the series list.
      </p>

      {/* Seeds — auto-filled but editable */}
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-gray-600">Home Seed</span>
          <input type="number" min={1} max={16} value={form.homeTeamSeed} onChange={set('homeTeamSeed')} required className="input mt-1 w-full" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Away Seed</span>
          <input type="number" min={1} max={16} value={form.awayTeamSeed} onChange={set('awayTeamSeed')} required className="input mt-1 w-full" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-gray-600">Home ML Odds</span>
          <input type="number" step="1" value={form.homeOdds} onChange={set('homeOdds')} required placeholder="e.g. -180 or +160" className="input mt-1 w-full" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Away ML Odds</span>
          <input type="number" step="1" value={form.awayOdds} onChange={set('awayOdds')} required placeholder="e.g. +160 or -180" className="input mt-1 w-full" />
        </label>
      </div>

      <label className="block">
        <span className="text-sm text-gray-600">Prediction Deadline</span>
        <input type="datetime-local" value={form.deadline} onChange={set('deadline')} required className="input mt-1 w-full" />
      </label>

      <label className="block">
        <span className="text-sm text-gray-600">
          Win Points <span className="text-gray-400">(leave blank = use league default)</span>
        </span>
        <input
          type="number"
          min={1}
          value={form.winPoints}
          onChange={set('winPoints')}
          placeholder="e.g. 100"
          className="input mt-1 w-full"
        />
      </label>

      {/* Series MVP Points — not available for Play-In */}
      {!isPlayIn && (
        <label className="block">
          <span className="text-sm text-gray-600">
            Series MVP Points <span className="text-gray-400">(0 = disabled)</span>
          </span>
          <input
            type="number"
            min={0}
            value={form.seriesMvpPoints}
            onChange={set('seriesMvpPoints')}
            className="input mt-1 w-full"
          />
        </label>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">Series created successfully!</p>}

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? 'Creating…' : 'Create Series'}
      </button>
    </form>
  );
}
