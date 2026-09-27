// src/routes/messages.js
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { runMigrations } from '../db/migrate.js';

runMigrations();

const router = Router();

const USERS = ['Сергей', 'Саша'];
const ALLOWED_EMOJI = ['❤️', '👍', '🔥', '😂', '😮', '😢', '👎', '🎉'];

// ============================================================
// Внутренние функции
// ============================================================
function rowToMessage(row, reactionsMap) {
  const reactions = reactionsMap?.[row.id] || [];
  return {
    id: row.id,
    from: row.from_user,
    to: row.to_user,
    text: row.text,
    createdAt: row.created_at,
    readAt: row.read_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    pinnedAt: row.pinned_at,
    replyTo: row.reply_to,
    payload: row.payload ? JSON.parse(row.payload) : null,
    reactions,   // [{ emoji, users: ['Сергей'] }]
  };
}

function loadReactionsForMessages(ids) {
  if (!ids.length) return {};
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT message_id, user, emoji FROM message_reactions
    WHERE message_id IN (${placeholders})
    ORDER BY created_at ASC
  `).all(...ids);

  const map = {};
  for (const r of rows) {
    if (!map[r.message_id]) map[r.message_id] = {};
    if (!map[r.message_id][r.emoji]) map[r.message_id][r.emoji] = new Set();
    map[r.message_id][r.emoji].add(r.user);
  }

  // Преобразуем Set → массив, объект → массив
  const result = {};
  for (const [msgId, byEmoji] of Object.entries(map)) {
    result[msgId] = Object.entries(byEmoji).map(([emoji, users]) => ({
      emoji,
      users: [...users],
    }));
  }
  return result;
}

const insertMsg = db.prepare(`
  INSERT INTO messages
    (id, from_user, to_user, text, created_at, read_at, edited_at, deleted_at, pinned_at, reply_to, payload)
  VALUES
    (@id, @from, @to, @text, @createdAt, NULL, NULL, NULL, NULL, @replyTo, @payload)
`);

const listByUserStmt = db.prepare(`
  SELECT * FROM messages
  WHERE ((from_user = @user AND to_user = @peer)
      OR (from_user = @peer AND to_user = @user))
    AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT @limit
`);

const unreadStmt = db.prepare(`
  SELECT from_user, COUNT(*) as cnt FROM messages
  WHERE to_user = @user AND read_at IS NULL AND deleted_at IS NULL
  GROUP BY from_user
`);

const markReadStmt = db.prepare(`
  UPDATE messages
  SET read_at = @readAt
  WHERE from_user = @peer AND to_user = @user AND read_at IS NULL AND deleted_at IS NULL
`);

const getMsgStmt = db.prepare('SELECT * FROM messages WHERE id = ?');

const touchPresenceStmt = db.prepare(`
  INSERT INTO user_presence (user, last_seen, updated_at)
  VALUES (@user, @now, @now)
  ON CONFLICT(user) DO UPDATE SET
    last_seen = @now,
    updated_at = @now
`);

const getPresenceStmt = db.prepare('SELECT * FROM user_presence WHERE user = ?');
const getAllPresenceStmt = db.prepare('SELECT * FROM user_presence');

// Реакции
const addReactionStmt = db.prepare(`
  INSERT OR IGNORE INTO message_reactions (message_id, user, emoji, created_at)
  VALUES (@messageId, @user, @emoji, @createdAt)
`);
const removeReactionStmt = db.prepare(`
  DELETE FROM message_reactions WHERE message_id = ? AND user = ? AND emoji = ?
`);
const getAllReactionsStmt = db.prepare(`
  SELECT message_id, user, emoji FROM message_reactions
  WHERE message_id = ?
  ORDER BY created_at ASC
`);

function buildReactionsFor(msgId) {
  const rows = getAllReactionsStmt.all(msgId);
  const map = {};
  for (const r of rows) {
    if (!map[r.emoji]) map[r.emoji] = [];
    map[r.emoji].push(r.user);
  }
  return Object.entries(map).map(([emoji, users]) => ({ emoji, users }));
}

// ============================================================
// GET /api/messages/presence
// ============================================================
router.get('/presence', requireAuth, (req, res) => {
  try {
    const rows = getAllPresenceStmt.all();
    const map = {};
    for (const u of USERS) {
      const r = rows.find(x => x.user === u);
      map[u] = r ? r.last_seen : null;
    }
    res.json({ ok: true, presence: map });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// POST /api/messages/heartbeat
// ============================================================
router.post('/heartbeat', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const now = new Date().toISOString();
    touchPresenceStmt.run({ user: me, now });
    const io = req.app.get('io');
    if (io) io.emit('presence:update', { user: me, lastSeen: now });
    res.json({ ok: true, lastSeen: now });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// POST /api/messages/typing
// body: { to: 'Саша', typing: true }
// ============================================================
router.post('/typing', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const { to, typing } = req.body ?? {};

    if (!to || !USERS.includes(to)) {
      return res.status(400).json({ ok: false, error: 'to обязателен' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('typing:update', {
        from: me,
        to,
        typing: !!typing,
        at: new Date().toISOString(),
      });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// GET /api/messages/conversations
// ============================================================
router.get('/conversations', requireAuth, (req, res) => {
  try {
    const me = req.user;

    const conversations = USERS
      .filter(u => u !== me)
      .map(peer => {
        const rows = listByUserStmt.all({ user: me, peer, limit: 1000 });
        const last = rows[rows.length - 1];
        const unread = rows.filter(r => r.to_user === me && !r.read_at).length;

        const pinned = db.prepare(`
          SELECT * FROM messages
          WHERE ((from_user = @user AND to_user = @peer)
              OR (from_user = @peer AND to_user = @user))
            AND pinned_at IS NOT NULL
            AND deleted_at IS NULL
          ORDER BY pinned_at DESC
        `).all({ user: me, peer });

        const presence = getPresenceStmt.get(peer);

        return {
          peer,
          lastMessage: last ? rowToMessage(last) : null,
          unread,
          total: rows.length,
          pinned: pinned.map(r => rowToMessage(r)),
          lastSeen: presence ? presence.last_seen : null,
        };
      });

    res.json({ ok: true, conversations });
  } catch (err) {
    console.error('[messages] conversations ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// GET /api/messages/unread
// ============================================================
router.get('/unread', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const rows = unreadStmt.all({ user: me });
    const map = {};
    for (const u of USERS) map[u] = 0;
    for (const r of rows) map[r.from_user] = r.cnt;
    const total = Object.values(map).reduce((s, n) => s + n, 0);
    res.json({ ok: true, unread: map, total });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// GET /api/messages?peer=Саша&limit=200
// ============================================================
router.get('/', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const peer = String(req.query.peer || '').trim();
    const limit = Math.min(Number(req.query.limit) || 200, 500);

    if (!peer || !USERS.includes(peer)) {
      return res.status(400).json({ ok: false, error: 'peer обязателен' });
    }
    if (peer === me) {
      return res.status(400).json({ ok: false, error: 'Нельзя писать самому себе' });
    }

    const rows = listByUserStmt.all({ user: me, peer, limit });
    const reactionsMap = loadReactionsForMessages(rows.map(r => r.id));

    res.json({ ok: true, messages: rows.map(r => rowToMessage(r, reactionsMap)) });
  } catch (err) {
    console.error('[messages] GET ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// POST /api/messages
// ============================================================
router.post('/', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const { to, text, replyTo } = req.body ?? {};

    if (!to || !USERS.includes(to)) {
      return res.status(400).json({ ok: false, error: 'to обязателен' });
    }
    if (to === me) {
      return res.status(400).json({ ok: false, error: 'Нельзя писать самому себе' });
    }

    const cleanText = String(text ?? '').trim().slice(0, 2000);
    if (!cleanText) {
      return res.status(400).json({ ok: false, error: 'Текст пуст' });
    }

    const msg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      from: me,
      to,
      text: cleanText,
      createdAt: new Date().toISOString(),
      replyTo: replyTo || null,
      payload: JSON.stringify({ fromUser: me }),
    };

    insertMsg.run(msg);

    const now = new Date().toISOString();
    touchPresenceStmt.run({ user: me, now });

    const saved = rowToMessage(getMsgStmt.get(msg.id));

    const io = req.app.get('io');
    if (io) {
      io.emit('message:new', saved);
      // Сброс typing у отправителя
      io.emit('typing:update', { from: me, to, typing: false });
    }

    res.json({ ok: true, message: saved });
  } catch (err) {
    console.error('[messages] POST ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// POST /api/messages/:id/reaction
// body: { emoji: '❤️' }
// ============================================================
router.post('/:id/reaction', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const { id } = req.params;
    const { emoji } = req.body ?? {};

    if (!ALLOWED_EMOJI.includes(emoji)) {
      return res.status(400).json({ ok: false, error: 'Недопустимый emoji' });
    }

    const row = getMsgStmt.get(id);
    if (!row) return res.status(404).json({ ok: false, error: 'Не найдено' });
    if (row.deleted_at) return res.status(400).json({ ok: false, error: 'Удалено' });
    if (row.from_user !== me && row.to_user !== me) {
      return res.status(403).json({ ok: false, error: 'Нет доступа' });
    }

    // Проверим, уже стоит ли реакция
    const existing = db.prepare(`
      SELECT 1 FROM message_reactions
      WHERE message_id = ? AND user = ? AND emoji = ?
    `).get(id, me, emoji);

    if (existing) {
      removeReactionStmt.run(id, me, emoji);
    } else {
      addReactionStmt.run({
        messageId: id,
        user: me,
        emoji,
        createdAt: new Date().toISOString(),
      });
    }

    const reactions = buildReactionsFor(id);

    const io = req.app.get('io');
    if (io) io.emit('reaction:update', { messageId: id, reactions });

    res.json({ ok: true, messageId: id, reactions });
  } catch (err) {
    console.error('[messages] reaction ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// PATCH /read-all
// ============================================================
router.patch('/read-all', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const peer = String(req.query.peer || '').trim();

    if (!peer || !USERS.includes(peer)) {
      return res.status(400).json({ ok: false, error: 'peer обязателен' });
    }

    const readAt = new Date().toISOString();
    const result = markReadStmt.run({ peer, user: me, readAt });

    const io = req.app.get('io');
    if (io) io.emit('message:read-all', { peer, by: me, readAt });

    res.json({ ok: true, count: result.changes, readAt });
  } catch (err) {
    console.error('[messages] read-all ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// PATCH /:id/read
// ============================================================
router.patch('/:id/read', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const { id } = req.params;

    const row = getMsgStmt.get(id);
    if (!row) return res.status(404).json({ ok: false, error: 'Не найдено' });
    if (row.to_user !== me) {
      return res.status(403).json({ ok: false, error: 'Нет доступа' });
    }

    const readAt = new Date().toISOString();
    db.prepare('UPDATE messages SET read_at = ? WHERE id = ?').run(readAt, id);

    const io = req.app.get('io');
    if (io) io.emit('message:read', { id, readAt, by: me });

    res.json({ ok: true, id, readAt });
  } catch (err) {
    console.error('[messages] read ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// PATCH /:id
// ============================================================
router.patch('/:id', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const { id } = req.params;
    const { text } = req.body ?? {};

    const row = getMsgStmt.get(id);
    if (!row) return res.status(404).json({ ok: false, error: 'Не найдено' });
    if (row.from_user !== me) {
      return res.status(403).json({ ok: false, error: 'Только автор' });
    }
    if (row.deleted_at) {
      return res.status(400).json({ ok: false, error: 'Удалено' });
    }

    const cleanText = String(text ?? '').trim().slice(0, 2000);
    if (!cleanText) return res.status(400).json({ ok: false, error: 'Текст пуст' });

    const editedAt = new Date().toISOString();
    db.prepare('UPDATE messages SET text = ?, edited_at = ? WHERE id = ?')
      .run(cleanText, editedAt, id);

    const updated = rowToMessage(getMsgStmt.get(id), loadReactionsForMessages([id]));

    const io = req.app.get('io');
    if (io) io.emit('message:edited', updated);

    res.json({ ok: true, message: updated });
  } catch (err) {
    console.error('[messages] edit ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// DELETE /:id
// ============================================================
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const { id } = req.params;

    const row = getMsgStmt.get(id);
    if (!row) return res.status(404).json({ ok: false, error: 'Не найдено' });
    if (row.from_user !== me && row.to_user !== me) {
      return res.status(403).json({ ok: false, error: 'Нет доступа' });
    }

    const deletedAt = new Date().toISOString();
    db.prepare('UPDATE messages SET deleted_at = ? WHERE id = ?').run(deletedAt, id);

    const io = req.app.get('io');
    if (io) io.emit('message:deleted', { id, deletedAt, by: me });

    res.json({ ok: true, id, deletedAt });
  } catch (err) {
    console.error('[messages] delete ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// POST /:id/pin
// ============================================================
router.post('/:id/pin', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const { id } = req.params;

    const row = getMsgStmt.get(id);
    if (!row) return res.status(404).json({ ok: false, error: 'Не найдено' });
    if (row.from_user !== me && row.to_user !== me) {
      return res.status(403).json({ ok: false, error: 'Нет доступа' });
    }
    if (row.deleted_at) {
      return res.status(400).json({ ok: false, error: 'Удалено' });
    }

    const wasPinned = !!row.pinned_at;
    const pinnedAt = wasPinned ? null : new Date().toISOString();

    db.prepare('UPDATE messages SET pinned_at = ? WHERE id = ?').run(pinnedAt, id);

    const updated = rowToMessage(getMsgStmt.get(id), loadReactionsForMessages([id]));

    const io = req.app.get('io');
    if (io) io.emit('message:pinned', updated);

    res.json({ ok: true, message: updated, pinned: !wasPinned });
  } catch (err) {
    console.error('[messages] pin ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;