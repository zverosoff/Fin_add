import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

/**
 * Проверяет JWT-токен. Токен ищем:
 *  1) в httpOnly cookie `token`
 *  2) в заголовке `Authorization: Bearer xxx`
 * Если всё ок — кладём имя пользователя в req.user.
 */
export function requireAuth(req, res, next) {
  const cookieToken = req.cookies?.token;
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}