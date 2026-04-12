import { LeaderboardEntry } from '../../types';

interface Props {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}

export function Leaderboard({ entries, currentUserId }: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <p>No scores yet. Leaderboard will update once predictions are resolved.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-nba-blue text-white">
          <tr>
            <th className="px-4 py-3 text-left font-semibold w-12">Rank</th>
            <th className="px-4 py-3 text-left font-semibold">Player</th>
            <th className="px-4 py-3 text-right font-semibold">Points</th>
            <th className="px-4 py-3 text-right font-semibold hidden sm:table-cell">
              ✓ Winner
            </th>
            <th className="px-4 py-3 text-right font-semibold hidden sm:table-cell">
              ✓ Score
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry) => {
            const isMe = entry.userId === currentUserId;
            return (
              <tr
                key={entry.userId}
                className={`transition-colors ${
                  isMe ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-3 font-bold text-gray-700 w-12">
                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {entry.avatarUrl ? (
                      <img
                        src={entry.avatarUrl}
                        alt={entry.displayName}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-nba-blue text-white flex items-center justify-center text-xs font-bold">
                        {entry.displayName[0].toUpperCase()}
                      </div>
                    )}
                    <span className={`font-medium ${isMe ? 'text-nba-blue' : 'text-gray-800'}`}>
                      {entry.displayName}
                      {isMe && <span className="ml-1 text-xs text-gray-500">(you)</span>}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-bold text-nba-blue">
                  {entry.totalPoints.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">
                  {entry.correctWinners}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">
                  {entry.correctExactScores}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
