import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ============================================================
// Внутренние функции
// ============================================================

function readAppState() {
  const row = db.prepare('SELECT data FROM app_state WHERE id = 1').get();
  return JSON.parse(row.data);
}

function writeAppState(state) {
  db.prepare('UPDATE app_state SET data = ?, updated_at = ? WHERE id = 1')
    .run(JSON.stringify(state), new Date().toISOString());
}

function readTransactions() {
  const rows = db.prepare('SELECT payload FROM transactions ORDER BY date DESC').all();
  return rows.map(r => JSON.parse(r.payload));
}

function buildFullState() {
  const state = readAppState();
  state.transactions = readTransactions();
  return state;
}

// ============================================================
// GET /api/state — получить полное состояние
// ============================================================
router.get('/', requireAuth, (req, res) => {
  const state = buildFullState();
  res.json(state);
});

// ============================================================
// POST /api/state — частичное обновление
// body: { accountStart?, rate?, incomes?, expenses?, accounts?,
//         goals?, replaceGoals?, flat? }
// ============================================================
router.post('/', requireAuth, (req, res) => {
  const incoming = req.body ?? {};
  const current = readAppState();

  // Простые поля — заменяем целиком
  for (const key of ['accountStart', 'rate', 'incomes', 'expenses', 'accounts']) {
    if (key in incoming) current[key] = incoming[key];
  }

  // ✅ Цели: либо ПОЛНАЯ замена (если replaceGoals === true),
  //         либо мёрж по id (для частичных обновлений).
  if ('goals' in incoming && Array.isArray(incoming.goals)) {
    if (incoming.replaceGoals === true) {
      // Полная замена — так работает удаление целей
      current.goals = incoming.goals;
    } else {
      // Мёрж по id
      const map = new Map((current.goals ?? []).map(g => [g.id, g]));
      for (const g of incoming.goals) {
        if (g?.id) map.set(g.id, g);
      }
      current.goals = [...map.values()];
    }
  }

  // Квартира — заменяем целиком
  if ('flat' in incoming && typeof incoming.flat === 'object') {
    current.flat = incoming.flat;
  }

  writeAppState(current);
  const full = buildFullState();

  // Уведомляем всех подключённых по WebSocket
  const io = req.app.get('io');
  if (io) io.emit('state', full);

  res.json({ ok: true, savedAt: new Date().toISOString() });
});

export default router;