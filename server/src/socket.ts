import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';

export function initSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.info(`[socket] client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.info(`[socket] client disconnected: ${socket.id}`);
    });
  });

  return io;
}
