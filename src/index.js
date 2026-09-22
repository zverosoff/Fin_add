import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server as SocketServer } from 'socket.io';

import authRoutes from './routes/auth.js';
import stateRoutes from './routes/state.js';
import txRoutes from './routes/transactions.js';
import { attachSocket } from './services/wsService.js';

// ============================================================
// Проверка окружения
// ============================================================
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET должен быть не короче 32 символов в .env');
  process.exit(1);
}

// ============================================================
// Express
// ============================================================
const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://fin.mia0.amvera.tech',  
  'https://fin-opal-five.vercel.app',
  'https://fin-zverosoff.mia0.amvera.tech',
  process.env.FRONTEND_URL,
].filter(Boolean);

console.log('[init] CORS разрешён для:', ALLOWED_ORIGINS);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (/\.vercel\.app$/.test(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'PATCH', 'PUT'],   // ← добавить
  allowedHeaders: ['Content-Type', 'Authorization'],               // ← добавить
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Логирование запросов
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ============================================================
// Маршруты
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/transactions', txRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// 404
app.use('/api/*', (_req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ ok: false, error: err.message || 'Internal error' });
});

// ============================================================
// Socket.IO
// ============================================================
const io = new SocketServer(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
});
attachSocket(io);
app.set('io', io);

// ============================================================
// Запуск
// ============================================================
const PORT = Number(process.env.PORT) || 80;
server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`  🚀 Backend запущен: http://localhost:${PORT}`);
  console.log(`  🌍 NODE_ENV:      ${process.env.NODE_ENV}`);
  console.log(`  🩺 Health check:  http://localhost:${PORT}/api/health`);
  console.log('='.repeat(60));
});