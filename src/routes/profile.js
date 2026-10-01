// src/routes/profile.js
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const getProfileStmt = db.prepare(
  'SELECT user, display_name, avatar, created_at, updated_at FROM user_profiles WHERE user = ?'
);

// ✅ Upsert с created_at — сохраняем при первом создании
const upsertProfileStmt = db.prepare(`
  INSERT INTO user_profiles (user, display_name, avatar, created_at, updated_at)
  VALUES (@user, @displayName, @avatar, @createdAt, @updatedAt)
  ON CONFLICT(user) DO UPDATE SET
    display_name = excluded.display_name,
    avatar = excluded.avatar,
    updated_at = excluded.updated_at
`);

function rowToProfile(row, fallbackUser) {
  if (!row) {
    return {
      user: fallbackUser,
      displayName: fallbackUser,
      avatar: null,
      createdAt: null,
      updatedAt: null,
    };
  }
  return {
    user: row.user,
    displayName: row.display_name || row.user,
    avatar: row.avatar || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// GET /api/profile/:user — профиль любого пользователя
// ============================================================
router.get('/:user', requireAuth, (req, res) => {
  try {
    const { user } = req.params;
    if (!user) {
      return res.status(400).json({ ok: false, error: 'user обязателен' });
    }
    const row = getProfileStmt.get(user);
    res.json({ ok: true, profile: rowToProfile(row, user) });
  } catch (err) {
    console.error('[profile] GET /:user ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// GET /api/profile — текущий профиль
// ============================================================
router.get('/', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const row = getProfileStmt.get(me);
    res.json({ ok: true, profile: rowToProfile(row, me) });
  } catch (err) {
    console.error('[profile] GET ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// POST /api/profile — сохранить
// ============================================================
router.post('/', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const { displayName, avatar } = req.body ?? {};

    const cleanName = String(displayName ?? '').trim().slice(0, 60);
    if (!cleanName) {
      return res.status(400).json({ ok: false, error: 'Имя не может быть пустым' });
    }

    const cleanAvatar = typeof avatar === 'string' && avatar.length > 0
      ? avatar.slice(0, 3_000_000)
      : null;

    const updatedAt = new Date().toISOString();

    // ✅ Устанавливаем createdAt только при первом сохранении
    const existing = getProfileStmt.get(me);
    const createdAt = existing?.created_at || updatedAt;

    upsertProfileStmt.run({
      user: me,
      displayName: cleanName,
      avatar: cleanAvatar,
      createdAt,
      updatedAt,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('profile:update', {
        user: me,
        displayName: cleanName,
        avatar: cleanAvatar,
      });
    }

    res.json({
      ok: true,
      profile: {
        user: me,
        displayName: cleanName,
        avatar: cleanAvatar,
        createdAt,
        updatedAt,
      },
    });
  } catch (err) {
    console.error('[profile] POST ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;