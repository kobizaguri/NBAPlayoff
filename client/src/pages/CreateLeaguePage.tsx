import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaguesApi } from '../api/leagues';
import type { PerfectRoundBonuses } from '../types';

export function CreateLeaguePage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxMembers, setMaxMembers] = useState(20);
  const [baseWinPoints, setBaseWinPoints] = useState(100);
  const [playInWinPoints, setPlayInWinPoints] = useState(50);
  const [mvpPoints, setMvpPoints] = useState(100);
  const [mvpDeadline, setMvpDeadline] = useState('');
  const [championDeadline, setChampionDeadline] = useState('');
  const [prFirst, setPrFirst] = useState('');
  const [prSemis, setPrSemis] = useState('');
  const [prFinals, setPrFinals] = useState('');
  const [prNbaFinals, setPrNbaFinals] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mvpDeadline) {
      setError('MVP pick deadline is required');
      return;
    }
    setError('');
    setCreating(true);
    try {
      const perfectRoundBonuses: PerfectRoundBonuses = {};
      const a = parseInt(prFirst, 10);
      const b = parseInt(prSemis, 10);
      const c = parseInt(prFinals, 10);
      const d = parseInt(prNbaFinals, 10);
      if (!Number.isNaN(a) && a > 0) perfectRoundBonuses.firstRound = a;
      if (!Number.isNaN(b) && b > 0) perfectRoundBonuses.semis = b;
      if (!Number.isNaN(c) && c > 0) perfectRoundBonuses.finals = c;
      if (!Number.isNaN(d) && d > 0) perfectRoundBonuses.nbaFinals = d;

      const res = await leaguesApi.create({
        name,
        password: password || undefined,
        isPublic,
        maxMembers,
        baseWinPoints,
        playInWinPoints,
        mvpPoints,
        mvpDeadline: new Date(mvpDeadline).toISOString(),
        ...(Object.keys(perfectRoundBonuses).length > 0 ? { perfectRoundBonuses } : {}),
        championPickDeadline: championDeadline
          ? new Date(championDeadline).toISOString()
          : null,
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
            <p className="text-xs text-gray-400 mt-1">
              Used for upset-weighted winner points. Nailing the correct 4-x line (4-0 … 4-3) adds this many
              points again as a <strong>flat</strong> bonus (no odds adjustment).
            </p>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Play-In Win Points</span>
              <input
                type="number"
                min={0}
                value={playInWinPoints}
                onChange={(e) => setPlayInWinPoints(parseInt(e.target.value))}
                required
                className="input mt-1 w-full"
              />
              <p className="text-xs text-gray-400 mt-1">Flat points for Play-In winner</p>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Finals MVP Points</span>
              <input
                type="number"
                min={0}
                value={mvpPoints}
                onChange={(e) => setMvpPoints(parseInt(e.target.value))}
                required
                className="input mt-1 w-full"
              />
              <p className="text-xs text-gray-400 mt-1">Points for correct Finals MVP pick</p>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Finals MVP Pick Deadline</span>
            <input
              type="datetime-local"
              value={mvpDeadline}
              onChange={(e) => setMvpDeadline(e.target.value)}
              required
              className="input mt-1 w-full"
            />
            <p className="text-xs text-gray-400 mt-1">After this date, picks are locked and visible to all members</p>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Champion pick deadline <span className="text-gray-400">(optional)</span>
            </span>
            <input
              type="datetime-local"
              value={championDeadline}
              onChange={(e) => setChampionDeadline(e.target.value)}
              className="input mt-1 w-full"
            />
            <p className="text-xs text-gray-400 mt-1">
              Leave blank to disable champion picks until the commissioner sets one later.
            </p>
          </label>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Perfect-round bonuses <span className="text-gray-400 font-normal">(optional)</span>
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Extra points if a member nails every series winner in that round (both conferences). Leave blank to
              skip.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs">
                First round
                <input
                  type="number"
                  min={1}
                  className="input mt-1 w-full"
                  placeholder="—"
                  value={prFirst}
                  onChange={(e) => setPrFirst(e.target.value)}
                />
              </label>
              <label className="block text-xs">
                Conference semis
                <input
                  type="number"
                  min={1}
                  className="input mt-1 w-full"
                  placeholder="—"
                  value={prSemis}
                  onChange={(e) => setPrSemis(e.target.value)}
                />
              </label>
              <label className="block text-xs">
                Conference finals
                <input
                  type="number"
                  min={1}
                  className="input mt-1 w-full"
                  placeholder="—"
                  value={prFinals}
                  onChange={(e) => setPrFinals(e.target.value)}
                />
              </label>
              <label className="block text-xs">
                NBA Finals
                <input
                  type="number"
                  min={1}
                  className="input mt-1 w-full"
                  placeholder="—"
                  value={prNbaFinals}
                  onChange={(e) => setPrNbaFinals(e.target.value)}
                />
              </label>
            </div>
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
