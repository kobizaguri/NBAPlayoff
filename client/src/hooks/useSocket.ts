import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/socket.io', transports: ['websocket'] });
  }
  return socket;
}

export function useSocket() {
  const queryClient = useQueryClient();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    const s = getSocket();

    s.on('leaderboard:update', () => {
      // Invalidate all leaderboard queries
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['predictions'] });
    });

    s.on('series:update', () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
    });

    s.on('series:complete', () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    });

    return () => {
      s.off('leaderboard:update');
      s.off('series:update');
      s.off('series:complete');
      registeredRef.current = false;
    };
  }, [queryClient]);
}
