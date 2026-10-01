// src/routes/profile.js
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const getProfileStmt = db.prepare(
  'SELECT user, display_name, avatar, created_at, updated_at FROM user_profiles WHERE user = ?'
);

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

// ✅ Fallback: если created_at null, берём дату первой транзакции
function ensureCreatedAt(user) {
  const row = getProfileStmt.get(user);
  if (!row) return null;
  if (row.created_at) return row;

  const firstTx = db.prepare(`
    SELECT payload FROM transactions
    WHERE user = ?
    ORDER BY date ASC
    LIMIT 1
  `).get(user);

  let fallback = new Date().toISOString();
  if (firstTx) {
    try {
      const tx = JSON.parse(firstTx.payload);
      if (tx.date) fallback = tx.date;
    } catch {}
  }

  db.prepare('UPDATE user_profiles SET created_at = ? WHERE user = ?')
    .run(fallback, user);

  console.log(`[profile] created_at проставлен для ${user}: ${fallback}`);
  return getProfileStmt.get(user);
}

// ============================================================
// GET /api/profile/stats
// ============================================================
router.get('/stats', requireAuth, (req, res) => {
  try {
    const me = req.user;

    const rows = db.prepare(`
      SELECT payload FROM transactions
      WHERE user = ? AND fixed = 0
      ORDER BY date DESC
    `).all(me);

    const txs = rows.map(r => {
      try { return JSON.parse(r.payload); } catch { return null; }
    }).filter(Boolean);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // СЕРИЯ
    const dayKeys = new Set();
    for (const t of txs) {
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dayKeys.add(key);
    }

    let streak = 0;
    const cursor = new Date(todayStart);
    const todayKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (!dayKeys.has(todayKey)) cursor.setDate(cursor.getDate() - 1);

    for (let i = 0; i < 366; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (dayKeys.has(key)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }

    // СРАВНЕНИЕ
    function aggregateInRange(start, end) {
      let income = 0, expense = 0;
      for (const t of txs) {
        if (t.fromReconcile) continue;
        const d = new Date(t.date);
        if (isNaN(d.getTime())) continue;
        if (d < start || d > end) continue;
        if (t.type === 'income') income += Number(t.amount) || 0;
        else expense += Number(t.amount) || 0;
      }
      return { income, expense };
    }

    const current = aggregateInRange(monthStart, monthEnd);
    const previous = aggregateInRange(prevMonthStart, prevMonthEnd);

    function pctDiff(curr, prev) {
      if (prev === 0) return curr === 0 ? 0 : null;
      return ((curr - prev) / prev) * 100;
    }

    const monthCompare = {
      current,
      previous,
      incomePct: pctDiff(current.income, previous.income),
      expensePct: pctDiff(current.expense, previous.expense),
      balancePct: pctDiff(
        current.income - current.expense,
        previous.income - previous.expense
      ),
    };

    // ТОП-3
    const catMap = new Map();
    for (const t of txs) {
      if (t.type !== 'expense') continue;
      if (t.fromReconcile) continue;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      if (d < monthStart || d > monthEnd) continue;
      const cat = String(t.category || 'Прочее');
      catMap.set(cat, (catMap.get(cat) || 0) + (Number(t.amount) || 0));
    }

    const totalExpense = current.expense || 1;
    const topCategories = [...catMap.entries()]
      .map(([category, amount]) => ({
        category,
        amount,
        pct: (amount / totalExpense) * 100,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    res.json({
      ok: true,
      stats: { streak, monthCompare, topCategories },
    });
  } catch (err) {
    console.error('[profile] stats ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// GET /api/profile/:user
// ============================================================
router.get('/:user', requireAuth, (req, res) => {
  try {
    const { user } = req.params;
    if (!user) return res.status(400).json({ ok: false, error: 'user обязателен' });

    const row = ensureCreatedAt(user);
    res.json({ ok: true, profile: rowToProfile(row, user) });
  } catch (err) {
    console.error('[profile] GET /:user ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// GET /api/profile — текущий
// ============================================================
router.get('/', requireAuth, (req, res) => {
  try {
    const me = req.user;
    const row = ensureCreatedAt(me);
    res.json({ ok: true, profile: rowToProfile(row, me) });
  } catch (err) {
    console.error('[profile] GET ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// POST /api/profile
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