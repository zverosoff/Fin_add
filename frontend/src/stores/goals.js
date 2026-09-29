// frontend/src/stores/goals.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';
import { useAccountsStore } from './accounts';

export const useGoalsStore = defineStore('goals', () => {
  const accountsStore = useAccountsStore();

  const loading = ref(false);

  const goals = computed(() => accountsStore.goals ?? []);

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

  async function add(goalData) {
    const newGoal = {
      id: 'goal_' + Date.now(),
      name: goalData.name,
      target: Number(goalData.target) || 0,
      emoji: goalData.emoji || '🎯',
      owner: goalData.owner || 'Сергей',
      contributions: {},
      primary: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const list = [...goals.value, newGoal];
    await saveAll(list);
    return newGoal;
  }

  async function update(id, patch) {
    const list = goals.value.map(g =>
      g.id === id
        ? { ...g, ...patch, updatedAt: new Date().toISOString() }
        : g
    );
    await saveAll(list);
  }

  async function remove(id) {
    const list = goals.value.filter(g => g.id !== id);
    await saveAll(list);
  }

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

  async function setContribution(goalId, user, amount) {
    const goal = goals.value.find(g => g.id === goalId);
    if (!goal) throw new Error('Цель не найдена');

    const contributions = { ...(goal.contributions ?? {}) };
    if (amount <= 0) delete contributions[user];
    else contributions[user] = amount;

    await update(goalId, { contributions });
  }

  // ============================================================
  // ✅ ОСНОВНАЯ ЦЕЛЬ
  // ============================================================
  async function setPrimary(id) {
    const now = new Date().toISOString();
    const list = goals.value.map(g => {
      const isPrimary = g.id === id;
      if (g.primary === isPrimary) return g;
      return {
        ...g,
        primary: isPrimary,
        updatedAt: now,
      };
    });
    await saveAll(list);
  }

  async function clearPrimary() {
    const now = new Date().toISOString();
    const list = goals.value.map(g => {
      if (!g.primary) return g;
      return {
        ...g,
        primary: false,
        updatedAt: now,
      };
    });
    await saveAll(list);
  }

  const primaryGoal = computed(() =>
    enrichedGoals.value.find(g => g.primary) || null
  );

  return {
    loading,
    goals,
    enrichedGoals,
    primaryGoal,
    saveAll,
    add,
    update,
    remove,
    contribute,
    setContribution,
    setPrimary,
    clearPrimary,
  };
});