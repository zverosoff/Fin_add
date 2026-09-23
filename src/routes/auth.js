import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 30;
const IS_PROD = process.env.NODE_ENV === 'production';

// ✅ Единый набор опций cookie для login и logout
const COOKIE_OPTS = {
  httpOnly: true,
  // Для кросс-доменных запросов (Vercel ↔ Amvera) нужен 'none' + secure.
  // В dev (localhost) — 'lax', иначе браузер отклонит cookie без HTTPS.
  sameSite: IS_PROD ? 'none' : 'lax',
  secure: IS_PROD,
  path: '/',
};

// Пользователи — берём PIN из .env, хешируем при старте
// ⚠️ В продакшене пользователей стоит хранить в БД
const USERS = {
  'Сергей': {
    pinHash: bcrypt.hashSync(process.env.USER_SERGEY_PIN || '0000', 10),
  },
  'Саша': {
    pinHash: bcrypt.hashSync(process.env.USER_SASHA_PIN || '0000', 10),
  },
};

/**
 * POST /api/auth/login
 * body: { user: 'Сергей', pin: '2528' }
 */
router.post('/login', async (req, res) => {
  try {
    const { user, pin } = req.body ?? {};

    if (!user || !pin) {
      return res.status(400).json({ ok: false, error: 'Введите имя и PIN' });
    }

    const u = USERS[user];
    if (!u) {
      console.warn(`[auth] пользователь не найден: ${user} от ${req.ip}`);
      return res.status(401).json({ ok: false, error: 'Неверное имя или PIN' });
    }

    const valid = await bcrypt.compare(String(pin), u.pinHash);
    if (!valid) {
      console.warn(`[auth] неверный PIN для ${user} от ${req.ip}`);
      return res.status(401).json({ ok: false, error: 'Неверное имя или PIN' });
    }

    const token = jwt.sign(
      { sub: user },
      JWT_SECRET,
      { expiresIn: `${SESSION_DAYS}d` }
    );

    // ✅ Ставим httpOnly-cookie для кросс-доменной работы
    res.cookie('token', token, {
      ...COOKIE_OPTS,
      maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    });

    console.log(`[auth] ✓ успешный вход: ${user} от ${req.ip}`);
    console.log(`[auth] cookie: sameSite=${COOKIE_OPTS.sameSite}, secure=${COOKIE_OPTS.secure}`);

    // ✅ НЕ отдаём токен в JSON — он уже в httpOnly-cookie
    res.json({ ok: true, user, expiresInDays: SESSION_DAYS });

  } catch (err) {
    console.error('[auth] ОШИБКА в /login:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  // ✅ Те же опции, что при установке — иначе clearCookie может не сработать
  res.clearCookie('token', COOKIE_OPTS);
  res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * Проверка текущей сессии
 */
router.get('/me', (req, res) => {
  const cookieToken = req.cookies?.token;
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = cookieToken || headerToken;

  if (!token) return res.json({ ok: true, valid: false, user: null });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ ok: true, valid: true, user: payload.sub });
  } catch {
    res.json({ ok: true, valid: false, user: null });
  }
});

export default router;