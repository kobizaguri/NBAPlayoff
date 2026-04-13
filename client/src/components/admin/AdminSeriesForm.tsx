import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { PlayoffSeries } from '../../types';
import { v4 as uuidv4 } from 'uuid';

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
        homeOdds: parseFloat(form.homeOdds),
        awayOdds: parseFloat(form.awayOdds),
        deadline: new Date(form.deadline).toISOString(),
        seriesMvpPoints: parseInt(form.seriesMvpPoints) || 0,
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

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-gray-600">Home Team</span>
          <input value={form.homeTeamName} onChange={set('homeTeamName')} required placeholder="e.g. Boston Celtics" className="input mt-1 w-full" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Away Team</span>
          <input value={form.awayTeamName} onChange={set('awayTeamName')} required placeholder="e.g. Miami Heat" className="input mt-1 w-full" />
        </label>
      </div>

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
          <span className="text-sm text-gray-600">Home Odds (decimal)</span>
          <input type="number" step="0.01" min="1" value={form.homeOdds} onChange={set('homeOdds')} required placeholder="e.g. 1.45" className="input mt-1 w-full" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Away Odds (decimal)</span>
          <input type="number" step="0.01" min="1" value={form.awayOdds} onChange={set('awayOdds')} required placeholder="e.g. 3.10" className="input mt-1 w-full" />
        </label>
      </div>

      <label className="block">
        <span className="text-sm text-gray-600">Prediction Deadline</span>
        <input type="datetime-local" value={form.deadline} onChange={set('deadline')} required className="input mt-1 w-full" />
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
