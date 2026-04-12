import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../../api/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { Notification } from '../../types';

const TYPE_LABELS: Record<Notification['type'], string> = {
  leagueInvite: '🏀 League',
  deadlineApproaching: '⏰ Deadline',
  seriesResult: '🏆 Result',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data),
    refetchInterval: 60_000, // refresh every minute
  });

  const unread = notifications.filter((n) => !n.readAt).length;

  const handleOpen = () => setOpen((v) => !v);

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  function notificationText(n: Notification): string {
    const p = n.payload as Record<string, string>;
    switch (n.type) {
      case 'leagueInvite':
        return `${p.joinedUserName} joined ${p.leagueName}`;
      case 'deadlineApproaching':
        return `Prediction deadline in 24h: ${p.homeTeamName} vs ${p.awayTeamName}`;
      case 'seriesResult':
        return `Series complete: ${p.homeTeamName} vs ${p.awayTeamName} — ${p.finalSeriesScore}`;
      default:
        return 'New notification';
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-1 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Notifications"
      >
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-nba-red text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white text-gray-800 rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold">Notifications</h3>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-nba-blue hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {notifications.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-gray-500">
                  No notifications yet
                </li>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <li
                    key={n.id}
                    onClick={() => !n.readAt && markRead(n.id)}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                      !n.readAt ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm shrink-0">{TYPE_LABELS[n.type]}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-700 leading-snug">{notificationText(n)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!n.readAt && (
                        <span className="w-2 h-2 bg-nba-blue rounded-full shrink-0 mt-1.5" />
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
