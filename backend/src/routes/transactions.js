import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Подготовленные statements (для скорости)
const upsertTx = db.prepare(`
  INSERT INTO transactions
    (id, name, amount, type, category, date, user, account_id, from_reconcile, fixed, payload)
  VALUES
    (@id, @name, @amount, @type, @category, @date, @user, @accountId, @fromReconcile, @fixed, @payload)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    amount = excluded.amount,
    type = excluded.type,
    category = excluded.category,
    date = excluded.date,
    user = excluded.user,
    account_id = excluded.account_id,
    from_reconcile = excluded.from_reconcile,
    fixed = excluded.fixed,
    payload = excluded.payload
`);

const deleteTxStmt = db.prepare('DELETE FROM transactions WHERE id = ?');

function readAppState() {
  const row = db.prepare('SELECT data FROM app_state WHERE id = 1').get();
  return JSON.parse(row.data);
}

function buildFullState() {
  const state = readAppState();
  state.transactions = db
    .prepare('SELECT payload FROM transactions ORDER BY date DESC')
    .all()
    .map(r => JSON.parse(r.payload));
  return state;
}

// ============================================================
// POST /api/transactions — создать/обновить
// ============================================================
router.post('/', requireAuth, (req, res) => {
  const tx = { ...(req.body ?? {}) };

  if (!tx.id) {
    tx.id = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  if (!tx.name || !tx.type) {
    return res.status(400).json({ ok: false, error: 'name и type обязательны' });
  }

  upsertTx.run({
    id: tx.id,
    name: tx.name,
    amount: Number(tx.amount) || 0,
    type: tx.type,
    category: tx.category ?? 'Прочее',
    date: tx.date ?? new Date().toISOString(),
    user: tx.user ?? null,
    accountId: tx.accountId ?? null,
    fromReconcile: tx.fromReconcile ? 1 : 0,
    fixed: tx.fixed ? 1 : 0,
    payload: JSON.stringify(tx),
  });

  const io = req.app.get('io');
  if (io) io.emit('state', buildFullState());

  res.json({ ok: true, transaction: tx });
});

// ============================================================
// DELETE /api/transactions?id=xxx
// ============================================================
router.delete('/', requireAuth, (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ ok: false, error: 'id обязателен' });

  const result = deleteTxStmt.run(id);

  const io = req.app.get('io');
  if (io) io.emit('state', buildFullState());

  res.json({ ok: true, deleted: result.changes });
});

export default router;