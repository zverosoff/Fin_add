import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

const onlineUsers = new Map(); // userId → Set<socketId>

function addOnline(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function removeOnline(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineUsers.delete(userId);
}

function getOnlineList() {
  return Array.from(onlineUsers.keys());
}

export function attachSocket(io) {
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
    const user = socket.user;
    console.log(`[ws] ✓ подключился ${user} (${socket.id})`);

    addOnline(user, socket.id);
    io.emit('users:online', getOnlineList());

    socket.on('disconnect', (reason) => {
      console.log(`[ws] ✗ отключился ${user} (${reason})`);
      removeOnline(user, socket.id);
      io.emit('users:online', getOnlineList());
    });

    socket.on('ping:client', () => {
      socket.emit('pong:server', { t: Date.now() });
    });
  });
}

function parseCookieToken(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}