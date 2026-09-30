// src/routes/profile.js
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const getProfileStmt = db.prepare(
  'SELECT user, display_name, avatar, updated_at FROM user_profiles WHERE user = ?'
);

const upsertProfileStmt = db.prepare(`
  INSERT INTO user_profiles (user, display_name, avatar, updated_at)
  VALUES (@user, @displayName, @avatar, @updatedAt)
  ON CONFLICT(user) DO UPDATE SET
    display_name = excluded.display_name,
    avatar = excluded.avatar,
    updated_at = excluded.updated_at
`);

// ============================================================
// GET /api/profile — текущий профиль
// ============================================================
router.get('/', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const row = getProfileStmt.get(me);
    if (!row) {
      return res.json({
        ok: true,
        profile: { user: me, displayName: me, avatar: null },
      });
    }
    res.json({
      ok: true,
      profile: {
        user: row.user,
        displayName: row.display_name || row.user,
        avatar: row.avatar || null,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    console.error('[profile] GET ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// POST /api/profile — сохранить имя и аватар
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
      ? avatar.slice(0, 2_000_000)
      : null;

    const updatedAt = new Date().toISOString();

    upsertProfileStmt.run({
      user: me,
      displayName: cleanName,
      avatar: cleanAvatar,
      updatedAt,
    });

    const io = req.app.get('io');
    if (io) io.emit('profile:update', { user: me, displayName: cleanName, avatar: cleanAvatar });

    res.json({
      ok: true,
      profile: { user: me, displayName: cleanName, avatar: cleanAvatar, updatedAt },
    });
  } catch (err) {
    console.error('[profile] POST ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;