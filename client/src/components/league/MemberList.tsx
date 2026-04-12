import { useState } from 'react';
import { LeagueMember } from '../../types';
import { leaguesApi } from '../../api/leagues';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  leagueId: string;
  members: LeagueMember[];
  isCommissioner: boolean;
  commissionerId: string;
  currentUserId: string;
}

export function MemberList({ leagueId, members, isCommissioner, commissionerId, currentUserId }: Props) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<string | null>(null);

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this member from the league?')) return;
    setRemoving(userId);
    try {
      await leaguesApi.removeMember(leagueId, userId);
      queryClient.invalidateQueries({ queryKey: ['leagueMembers', leagueId] });
    } catch {
      alert('Failed to remove member');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-700">Members ({members.length})</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              {m.avatarUrl ? (
                <img src={m.avatarUrl} alt={m.displayName} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-nba-blue text-white flex items-center justify-center text-xs font-bold">
                  {m.displayName[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm text-gray-800">{m.displayName}</span>
              {m.isCommissioner && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-medium">
                  Commissioner
                </span>
              )}
              {m.userId === currentUserId && (
                <span className="text-xs text-gray-400">(you)</span>
              )}
            </div>
            {isCommissioner && m.userId !== commissionerId && m.userId !== currentUserId && (
              <button
                onClick={() => handleRemove(m.userId)}
                disabled={removing === m.userId}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                {removing === m.userId ? '…' : 'Remove'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
