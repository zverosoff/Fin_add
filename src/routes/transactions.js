import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

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
// Санитизация — защита от CHECK constraint и NaN
// ============================================================
const ALLOWED_TYPES = ['income', 'expense'];

function normalizeType(raw) {
  if (ALLOWED_TYPES.includes(raw)) return raw;
  const s = String(raw ?? '').toLowerCase().trim();
  if (s === 'income' || s === 'доход' || s === 'приход') return 'income';
  return 'expense';
}

function normalizeAmount(raw) {
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

function normalizeString(raw, fallback = '') {
  if (raw == null) return fallback;
  const s = String(raw).trim();
  return s.length ? s : fallback;
}

function normalizeDate(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

// ============================================================
// POST /api/transactions
// ============================================================
router.post('/', requireAuth, (req, res) => {
  try {
    const incoming = req.body ?? {};

    const tx = {
      id: normalizeString(incoming.id, `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
      name: normalizeString(incoming.name, 'Операция'),
      amount: normalizeAmount(incoming.amount),
      type: normalizeType(incoming.type),
      category: normalizeString(incoming.category, 'Прочее'),
      date: normalizeDate(incoming.date),
      user: incoming.user ? String(incoming.user) : null,
      accountId: incoming.accountId ? String(incoming.accountId) : null,
      fromReconcile: incoming.fromReconcile ? 1 : 0,
      fixed: incoming.fixed ? 1 : 0,
    };

    if (tx.amount <= 0) {
      return res.status(400).json({ ok: false, error: 'amount должен быть > 0' });
    }

    upsertTx.run({
      id: tx.id,
      name: tx.name,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      date: tx.date,
      user: tx.user,
      accountId: tx.accountId,
      fromReconcile: tx.fromReconcile,
      fixed: tx.fixed,
      payload: JSON.stringify({ ...incoming, ...tx }),
    });

    const io = req.app.get('io');
    if (io) io.emit('state', buildFullState());

    res.json({ ok: true, transaction: tx });
  } catch (err) {
    console.error('[transactions] ошибка сохранения:', err.message);
    console.error('[transactions] payload:', JSON.stringify(req.body));
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// DELETE /api/transactions?id=xxx
// ============================================================
router.delete('/', requireAuth, (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ ok: false, error: 'id обязателен' });

    const result = deleteTxStmt.run(String(id));

    const io = req.app.get('io');
    if (io) io.emit('state', buildFullState());

    res.json({ ok: true, deleted: result.changes });
  } catch (err) {
    console.error('[transactions] ошибка удаления:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;