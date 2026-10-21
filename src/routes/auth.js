import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 30;
const IS_PROD = process.env.NODE_ENV === 'production';

const COOKIE_OPTS = {
  httpOnly: true,
  // ✅ Если фронт и бэк на ОДНОМ домене — 'lax' надёжнее
  sameSite: 'lax',
  secure: IS_PROD,
  path: '/',
};

const USERS = {
  'Сергей': {
    pinHash: bcrypt.hashSync(process.env.USER_SERGEY_PIN || '0000', 10),
  },
  'Саша': {
    pinHash: bcrypt.hashSync(process.env.USER_SASHA_PIN || '0000', 10),
  },
};

router.post('/login', async (req, res) => {
  try {
    const { user, pin } = req.body ?? {};

    if (!user || !pin) {
      return res.status(400).json({ ok: false, error: 'Введите имя и PIN' });
    }

    const u = USERS[user];
    if (!u) {
      return res.status(401).json({ ok: false, error: 'Неверное имя или PIN' });
    }

    const valid = await bcrypt.compare(String(pin), u.pinHash);
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Неверное имя или PIN' });
    }

    const token = jwt.sign({ sub: user }, JWT_SECRET, {
      expiresIn: `${SESSION_DAYS}d`,
    });

    res.cookie('token', token, {
      ...COOKIE_OPTS,
      maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    });

    console.log(`[auth] ✓ успешный вход: ${user} от ${req.ip}`);
    res.json({ ok: true, user, expiresInDays: SESSION_DAYS });
  } catch (err) {
    console.error('[auth] ошибка в /login:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTS);
  res.json({ ok: true });
});

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