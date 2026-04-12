import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaguesApi } from '../api/leagues';

export function CreateLeaguePage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxMembers, setMaxMembers] = useState(20);
  const [baseWinPoints, setBaseWinPoints] = useState(100);
  const [exactScoreBonus, setExactScoreBonus] = useState(50);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await leaguesApi.create({
        name,
        password: password || undefined,
        isPublic,
        maxMembers,
        baseWinPoints,
        exactScoreBonus,
      });
      navigate(`/leagues/${res.data.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to create league';
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Create a League</h1>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">League Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              className="input mt-1 w-full"
              placeholder="My Playoff Gang"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Password <span className="text-gray-400">(optional — leave blank for open join)</span>
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1 w-full"
            />
          </label>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 accent-nba-blue"
            />
            <label htmlFor="isPublic" className="text-sm text-gray-700 cursor-pointer">
              Public (visible to all users)
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Max members <span className="text-gray-400">(20–30)</span>
            </span>
            <input
              type="number"
              min={20}
              max={30}
              value={maxMembers}
              onChange={(e) => setMaxMembers(parseInt(e.target.value))}
              required
              className="input mt-1 w-full"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Base Win Points</span>
              <input
                type="number"
                min={1}
                value={baseWinPoints}
                onChange={(e) => setBaseWinPoints(parseInt(e.target.value))}
                required
                className="input mt-1 w-full"
              />
              <p className="text-xs text-gray-400 mt-1">Points multiplied by upset factor</p>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Exact Score Bonus</span>
              <input
                type="number"
                min={0}
                value={exactScoreBonus}
                onChange={(e) => setExactScoreBonus(parseInt(e.target.value))}
                required
                className="input mt-1 w-full"
              />
              <p className="text-xs text-gray-400 mt-1">Flat bonus for correct series score</p>
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={creating} className="btn-primary w-full">
            {creating ? 'Creating…' : 'Create League'}
          </button>
        </form>
      </div>
    </div>
  );
}
