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

// ✅ Дефолтные счета
const DEFAULT_ACCOUNTS = [
  { id: 'tbank_sergey', name: 'Т-Банк',   owner: 'Сергей', value: 0, openingBalance: 0 },
  { id: 'sber_sergey',  name: 'СберБанк', owner: 'Сергей', value: 0, openingBalance: 0 },
  { id: 'tbank_sasha',  name: 'Т-Банк',   owner: 'Саша',   value: 0, openingBalance: 0 },
  { id: 'sber_sasha',   name: 'СберБанк', owner: 'Саша',   value: 0, openingBalance: 0 },
];

// ✅ Дефолтные наличные (новый формат: { balance, savings })
const DEFAULT_CASH = {
  Сергей: { balance: 0, savings: 0 },
  Саша:   { balance: 0, savings: 0 },
};

// ✅ Нормализация cash — поддерживает ОБА формата:
//   legacy: { Сергей: 5000, Саша: 300 }
//   new:    { Сергей: { balance: 5000, savings: 2000 }, Саша: {...} }
function normalizeCashOwner(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return {
      balance: Number(raw.balance) || 0,
      savings: Number(raw.savings) || 0,
    };
  }
  // legacy: число
  return {
    balance: Number(raw) || 0,
    savings: 0,
  };
}

function normalizeCash(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  return {
    Сергей: normalizeCashOwner(src.Сергей),
    Саша:   normalizeCashOwner(src.Саша),
  };
}

// ✅ Убираем legacy-счета cash_*
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
    const filtered = stripLegacyCashAccounts(state.accounts);
    if (filtered.length !== state.accounts.length) {
      state.accounts = filtered;
      console.log('[state] удалены legacy-счета cash_* (GET)');
      writeAppState(state);
    }
  }

  // ✅ Наличные — ВСЕГДА нормализуем к объекту
  state.cash = normalizeCash(state.cash);

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

  // Простые поля
  for (const key of ['accountStart', 'rate', 'incomes', 'expenses', 'accounts']) {
    if (key in incoming && incoming[key] !== undefined && incoming[key] !== null) {
      current[key] = incoming[key];
    }
  }

  // ✅ НАЛИЧНЫЕ — нормализация + сохранение
  if ('cash' in incoming && incoming.cash !== undefined && incoming.cash !== null) {
    current.cash = normalizeCash(incoming.cash);
  }

  // Цели
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

  // Квартира
  if ('flat' in incoming && typeof incoming.flat === 'object') {
    current.flat = incoming.flat;
  }

  // Защита accounts
  if (!current.accounts || !Array.isArray(current.accounts) || current.accounts.length === 0) {
    current.accounts = DEFAULT_ACCOUNTS.map(a => ({ ...a }));
    console.log('[state] восстановлены дефолтные счета (POST)');
  } else {
    const filtered = stripLegacyCashAccounts(current.accounts);
    if (filtered.length !== current.accounts.length) {
      current.accounts = filtered;
      console.log('[state] удалены legacy-счета cash_* (POST)');
    }
  }

  // ✅ Защита cash
  current.cash = normalizeCash(current.cash);

  writeAppState(current);
  const full = buildFullState();

  const io = req.app.get('io');
  if (io) io.emit('state', full);

  res.json({ ok: true, savedAt: new Date().toISOString() });
});

export default router;