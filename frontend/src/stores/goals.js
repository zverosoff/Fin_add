import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';
import { useAccountsStore } from './accounts';

export const useGoalsStore = defineStore('goals', () => {
  const accountsStore = useAccountsStore();

  const loading = ref(false);

  // ============================================================
  // Источник данных — из accountsStore (приходят с /api/state)
  // ============================================================
  const goals = computed(() => accountsStore.goals ?? []);

  // ============================================================
  // Список целей с посчитанными полями
  // ============================================================
  const enrichedGoals = computed(() =>
    goals.value.map(goal => {
      const contributions = goal.contributions ?? {};
      const totalSaved = Object.values(contributions)
        .reduce((s, v) => s + (Number(v) || 0), 0);

      const target = Number(goal.target) || 0;
      const pct = target > 0 ? Math.min(100, (totalSaved / target) * 100) : 0;
      const left = Math.max(0, target - totalSaved);
      const done = pct >= 100;

      return {
        ...goal,
        contributions,
        totalSaved,
        target,
        pct,
        left,
        done,
      };
    })
  );

  // ============================================================
  // Действия
  // ============================================================

  /**
   * Сохранить список целей ЦЕЛИКОМ.
   * ✅ Отправляем replaceGoals: true, чтобы backend заменил список,
   * а не мёржил (иначе удаление не работает).
   */
  async function saveAll(newGoals) {
    loading.value = true;
    try {
      const { data } = await api.post('/state', {
        goals: newGoals,
        replaceGoals: true,
      });
      if (!data.ok) throw new Error(data.error);
      return true;
    } finally {
      loading.value = false;
    }
  }

  /** Добавить новую цель */
  async function add(goalData) {
    const newGoal = {
      id: 'goal_' + Date.now(),
      name: goalData.name,
      target: Number(goalData.target) || 0,
      emoji: goalData.emoji || '🎯',
      owner: goalData.owner || 'Сергей',
      contributions: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const list = [...goals.value, newGoal];
    await saveAll(list);
    return newGoal;
  }

  /** Обновить цель */
  async function update(id, patch) {
    const list = goals.value.map(g =>
      g.id === id
        ? { ...g, ...patch, updatedAt: new Date().toISOString() }
        : g
    );
    await saveAll(list);
  }

  /** Удалить цель */
  async function remove(id) {
    const list = goals.value.filter(g => g.id !== id);
    await saveAll(list);
  }

  /** Внести/изъять взнос */
  async function contribute(goalId, user, amount, mode = 'add') {
    const goal = goals.value.find(g => g.id === goalId);
    if (!goal) throw new Error('Цель не найдена');

    const contributions = { ...(goal.contributions ?? {}) };
    const current = Number(contributions[user]) || 0;

    if (mode === 'add') {
      contributions[user] = current + amount;
    } else {
      const next = current - amount;
      if (next <= 0.001) delete contributions[user];
      else contributions[user] = next;
    }

    await update(goalId, { contributions });
  }

  /** Установить конкретное значение взноса */
  async function setContribution(goalId, user, amount) {
    const goal = goals.value.find(g => g.id === goalId);
    if (!goal) throw new Error('Цель не найдена');

    const contributions = { ...(goal.contributions ?? {}) };
    if (amount <= 0) delete contributions[user];
    else contributions[user] = amount;

    await update(goalId, { contributions });
  }

  return {
    loading,
    goals,
    enrichedGoals,
    saveAll,
    add,
    update,
    remove,
    contribute,
    setContribution,
  };
});