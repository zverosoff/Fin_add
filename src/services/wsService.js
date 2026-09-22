import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

/**
 * Подключаем Socket.IO к HTTP-серверу.
 * Проверяем JWT перед установкой соединения.
 */
export function attachSocket(io) {
  // Middleware — выполняется ДО соединения
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      parseCookieToken(socket.handshake.headers?.cookie);

    if (!token) return next(new Error('No token'));

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.user = payload.sub;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[ws] ✓ подключился ${socket.user} (${socket.id})`);

    socket.on('disconnect', (reason) => {
      console.log(`[ws] ✗ отключился ${socket.user} (${reason})`);
    });
  });
}

function parseCookieToken(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}