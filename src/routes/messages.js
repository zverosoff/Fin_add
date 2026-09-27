// src/routes/messages.js
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const USERS = ['Сергей', 'Саша'];

// ============================================================
// Внутренние функции
// ============================================================
function rowToMessage(row) {
  return {
    id: row.id,
    from: row.from_user,
    to: row.to_user,
    text: row.text,
    createdAt: row.created_at,
    readAt: row.read_at,
    payload: row.payload ? JSON.parse(row.payload) : null,
  };
}

const insertMsg = db.prepare(`
  INSERT INTO messages (id, from_user, to_user, text, created_at, read_at, payload)
  VALUES (@id, @from, @to, @text, @createdAt, NULL, @payload)
`);

const listByUserStmt = db.prepare(`
  SELECT * FROM messages
  WHERE (from_user = @user AND to_user = @peer)
     OR (from_user = @peer AND to_user = @user)
  ORDER BY created_at ASC
  LIMIT @limit
`);

const listAllForUserStmt = db.prepare(`
  SELECT * FROM messages
  WHERE from_user = @user OR to_user = @user
  ORDER BY created_at DESC
  LIMIT @limit
`);

const unreadStmt = db.prepare(`
  SELECT from_user, COUNT(*) as cnt FROM messages
  WHERE to_user = @user AND read_at IS NULL
  GROUP BY from_user
`);

const markReadStmt = db.prepare(`
  UPDATE messages
  SET read_at = @readAt
  WHERE from_user = @peer AND to_user = @user AND read_at IS NULL
`);

const deleteMsgStmt = db.prepare('DELETE FROM messages WHERE id = ?');

// ============================================================
// GET /api/messages?peer=Саша&limit=100
// История переписки с конкретным пользователем
// ============================================================
router.get('/', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const peer = String(req.query.peer || '').trim();
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    if (!peer || !USERS.includes(peer)) {
      return res.status(400).json({ ok: false, error: 'peer обязателен и должен быть одним из пользователей' });
    }
    if (peer === me) {
      return res.status(400).json({ ok: false, error: 'Нельзя писать самому себе' });
    }

    const rows = listByUserStmt.all({ user: me, peer, limit });
    res.json({ ok: true, messages: rows.map(rowToMessage) });
  } catch (err) {
    console.error('[messages] GET ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// GET /api/messages/conversations
// Список диалогов + непрочитанные
// ============================================================
router.get('/conversations', requireAuth, (req, res) => {
  try {
    const me = req.user;

    // Последнее сообщение с каждым пользователем
    const conversations = USERS
      .filter(u => u !== me)
      .map(peer => {
        const rows = listByUserStmt.all({ user: me, peer, limit: 1000 });
        const last = rows[rows.length - 1];
        const unread = rows.filter(r => r.to_user === me && !r.read_at).length;
        return {
          peer,
          lastMessage: last ? rowToMessage(last) : null,
          unread,
          total: rows.length,
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
// Количество непрочитанных по каждому пользователю
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
    console.error('[messages] unread ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// POST /api/messages
// { to: 'Саша', text: 'Привет!' }
// ============================================================
router.post('/', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const { to, text } = req.body ?? {};

    if (!to || !USERS.includes(to)) {
      return res.status(400).json({ ok: false, error: 'to обязателен и должен быть пользователем' });
    }
    if (to === me) {
      return res.status(400).json({ ok: false, error: 'Нельзя писать самому себе' });
    }

    const cleanText = String(text ?? '').trim().slice(0, 2000);
    if (!cleanText) {
      return res.status(400).json({ ok: false, error: 'Текст сообщения пуст' });
    }

    const msg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      from: me,
      to,
      text: cleanText,
      createdAt: new Date().toISOString(),
      payload: JSON.stringify({ fromUser: me }),
    };

    insertMsg.run(msg);

    const saved = rowToMessage({
      id: msg.id,
      from_user: msg.from,
      to_user: msg.to,
      text: msg.text,
      created_at: msg.createdAt,
      read_at: null,
      payload: msg.payload,
    });

    // ✅ WebSocket — мгновенная доставка
    const io = req.app.get('io');
    if (io) {
      // Отправляем обоим участникам
      io.emit('message:new', saved);
    }

    res.json({ ok: true, message: saved });
  } catch (err) {
    console.error('[messages] POST ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// PATCH /api/messages/:id/read
// Пометить одно сообщение как прочитанное
// ============================================================
router.patch('/:id/read', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const { id } = req.params;

    const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ ok: false, error: 'Сообщение не найдено' });
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
// PATCH /api/messages/read-all?peer=Саша
// Пометить все сообщения от peer как прочитанные
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
// DELETE /api/messages/:id
// ============================================================
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const { id } = req.params;

    const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ ok: false, error: 'Не найдено' });
    if (row.from_user !== me) {
      return res.status(403).json({ ok: false, error: 'Можно удалять только свои' });
    }

    const result = deleteMsgStmt.run(id);

    const io = req.app.get('io');
    if (io) io.emit('message:deleted', { id, by: me });

    res.json({ ok: true, deleted: result.changes });
  } catch (err) {
    console.error('[messages] delete ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;