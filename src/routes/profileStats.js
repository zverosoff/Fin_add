// src/routes/profileStats.js
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ============================================================
// GET /api/profile-stats — статистика текущего пользователя
// Возвращает:
//   - streak (серия дней подряд)
//   - monthCompare (сравнение текущего месяца с прошлым)
//   - topCategories (топ-3 расходов за месяц)
// ============================================================
router.get('/', requireAuth, (req, res) => {
  try {
    const me = req.user;

    // ✅ Все транзакции пользователя
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

    // ============================================================
    // ✅ СЕРИЯ ДНЕЙ — сколько дней подряд были операции
    // ============================================================
    const dayKeys = new Set();
    for (const t of txs) {
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dayKeys.add(key);
    }

    // Идём назад от сегодня и считаем подряд идущие дни
    let streak = 0;
    const cursor = new Date(todayStart);
    // Разрешаем «пропуск» сегодня — если сегодня ещё нет операций, но вчера была
    const todayKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    const hasToday = dayKeys.has(todayKey);
    if (!hasToday) cursor.setDate(cursor.getDate() - 1);

    for (let i = 0; i < 366; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (dayKeys.has(key)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    // ============================================================
    // ✅ СРАВНЕНИЕ МЕСЯЦЕВ
    // ============================================================
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
      if (prev === 0) {
        if (curr === 0) return 0;
        return null; // null = «было 0, стало больше»
      }
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

    // ============================================================
    // ✅ ТОП-3 КАТЕГОРИИ РАСХОДОВ за текущий месяц
    // ============================================================
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

    // ============================================================
    // Ответ
    // ============================================================
    res.json({
      ok: true,
      stats: {
        streak,
        monthCompare,
        topCategories,
      },
    });
  } catch (err) {
    console.error('[profile-stats] ошибка:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;