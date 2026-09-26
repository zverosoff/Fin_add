// backend/src/routes/state.js
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

// ✅ Дефолтные счета — на случай восстановления
const DEFAULT_ACCOUNTS = [
  { id: 'tbank_sergey', name: 'Т-Банк',   owner: 'Сергей', value: 0, openingBalance: 0 },
  { id: 'sber_sergey',  name: 'СберБанк', owner: 'Сергей', value: 0, openingBalance: 0 },
  { id: 'tbank_sasha',  name: 'Т-Банк',   owner: 'Саша',   value: 0, openingBalance: 0 },
  { id: 'sber_sasha',   name: 'СберБанк', owner: 'Саша',   value: 0, openingBalance: 0 },
];

// ✅ Дефолтные наличные
const DEFAULT_CASH = {
  Сергей: 0,
  Саша: 0,
};

// ✅ Нормализация cash
function normalizeCash(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  return {
    Сергей: Number(src.Сергей) || 0,
    Саша:   Number(src.Саша)   || 0,
  };
}

// ✅ Убираем legacy-счета cash_* из accounts
function stripLegacyCashAccounts(accounts) {
  if (!Array.isArray(accounts)) return accounts;
  return accounts.filter(a => a && typeof a.id === 'string' && !a.id.startsWith('cash_'));
}

function buildFullState() {
  const state = readAppState();

  // ✅ Защита: если accounts потеряны — восстанавливаем
  if (!state.accounts || !Array.isArray(state.accounts) || state.accounts.length === 0) {
    state.accounts = DEFAULT_ACCOUNTS.map(a => ({ ...a }));
    console.log('[state] восстановлены дефолтные счета (GET)');
    writeAppState(state);
  } else {
    // ✅ Убираем legacy-счета cash_*
    const filtered = stripLegacyCashAccounts(state.accounts);
    if (filtered.length !== state.accounts.length) {
      state.accounts = filtered;
      console.log('[state] удалены legacy-счета cash_* (GET)');
      writeAppState(state);
    }
  }

  // ✅ Защита: если cash потерян — восстанавливаем
  if (!state.cash || typeof state.cash !== 'object') {
    state.cash = { ...DEFAULT_CASH };
    console.log('[state] восстановлены наличные (GET)');
    writeAppState(state);
  } else {
    state.cash = normalizeCash(state.cash);
  }

  state.transactions = readTransactions();
  return state;
}

// ============================================================
// GET /api/state
// ============================================================
router.get('/', requireAuth, (req, res) => {
  const state = buildFullState();
  res.json(state);
});

// ============================================================
// POST /api/state — частичное обновление
// ============================================================
router.post('/', requireAuth, (req, res) => {
  const incoming = req.body ?? {};
  const current = readAppState();

  // Простые поля — заменяем целиком, но только если значение пришло
  // и оно НЕ undefined / null (защита от затирания)
  for (const key of ['accountStart', 'rate', 'incomes', 'expenses', 'accounts']) {
    if (key in incoming && incoming[key] !== undefined && incoming[key] !== null) {
      current[key] = incoming[key];
    }
  }

  // ✅ НАЛИЧНЫЕ — отдельная обработка с нормализацией
  if ('cash' in incoming && incoming.cash !== undefined && incoming.cash !== null) {
    current.cash = normalizeCash(incoming.cash);
  }

  // Цели: полная замена или мёрж
  if ('goals' in incoming && Array.isArray(incoming.goals)) {
    if (incoming.replaceGoals === true) {
      current.goals = incoming.goals;
    } else {
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

  // ✅ Защита: если accounts потерялись — восстанавливаем
  if (!current.accounts || !Array.isArray(current.accounts) || current.accounts.length === 0) {
    current.accounts = DEFAULT_ACCOUNTS.map(a => ({ ...a }));
    console.log('[state] восстановлены дефолтные счета (POST)');
  } else {
    // ✅ Убираем legacy-счета cash_*
    const filtered = stripLegacyCashAccounts(current.accounts);
    if (filtered.length !== current.accounts.length) {
      current.accounts = filtered;
      console.log('[state] удалены legacy-счета cash_* (POST)');
    }
  }

  // ✅ Защита: если cash потерян — восстанавливаем
  if (!current.cash || typeof current.cash !== 'object') {
    current.cash = { ...DEFAULT_CASH };
    console.log('[state] восстановлены наличные (POST)');
  }

  writeAppState(current);
  const full = buildFullState();

  const io = req.app.get('io');
  if (io) io.emit('state', full);

  res.json({ ok: true, savedAt: new Date().toISOString() });
});

export default router;