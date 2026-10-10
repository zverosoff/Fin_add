<!-- frontend/src/views/AnalyticsView.vue -->
<script setup>
import { computed, onMounted } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics';
import { useGoalsStore } from '@/stores/goals';
import { useCategoriesStore } from '@/stores/categories';

import AnalyticsHero from '@/components/analytics/AnalyticsHero.vue';
import MetricTile from '@/components/analytics/MetricTile.vue';
import GoalRing from '@/components/analytics/GoalRing.vue';
import MiniChart from '@/components/analytics/MiniChart.vue';
import ComparisonCard from '@/components/analytics/ComparisonCard.vue';
import CategoryBreakdown from '@/components/analytics/CategoryBreakdown.vue';
import PeriodSelector from '@/components/analytics/PeriodSelector.vue';
import PageHero from '@/components/ui/PageHero.vue';

const analytics = useAnalyticsStore();
const goals = useGoalsStore();
const categories = useCategoriesStore();

onMounted(() => {
  // Стор analytics сам подтянет данные из accountsStore
});

// ============================================================
// ✅ МЕТРИКИ — из currentMonthMetrics (реальные поля!)
// ============================================================
const metrics = computed(() => analytics.currentMonthMetrics || {});

// "Можно откладывать" = 10% от дохода
const savingsRecommended = computed(() => metrics.value.monthSave || 0);
const monthIncome = computed(() => metrics.value.monthIncome || 0);

// "Свободно" = реальный остаток (income - expense)
const freeAfterExpenses = computed(() => metrics.value.realFree || 0);

// "Подушка" = runway (месяцев)
const safetyMonths = computed(() => metrics.value.runway || 0);

// "Расход/день" = dailyAvg
const dailyAverage = computed(() => metrics.value.dailyAvg || 0);

// ============================================================
// ✅ ТРЕНДЫ — из monthlyData (реальные данные)
// ============================================================
const dailyExpenseChart = computed(() => {
  const data = analytics.monthlyData || [];
  // берём последние 7 месяцев (или сколько есть)
  return data.slice(-7).map(m => m.expense || 0);
});

const dailyIncomeChart = computed(() => {
  const data = analytics.monthlyData || [];
  return data.slice(-7).map(m => m.income || 0);
});

// ============================================================
// ✅ КАТЕГОРИИ — считаем из periodTransactions
// ============================================================
const categoriesBreakdown = computed(() => {
  const txs = analytics.periodTransactions || [];
  const expenses = txs.filter(t => t.type === 'expense' && !t.fromReconcile);

  const totalExpense = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  if (totalExpense === 0) return [];

  const map = new Map();
  for (const t of expenses) {
    const cat = t.category || 'Прочее';
    map.set(cat, (map.get(cat) || 0) + (Number(t.amount) || 0));
  }

  const sorted = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6); // топ-6

  return sorted.map(([category, amount]) => ({
    category,
    amount,
    percent: (amount / totalExpense) * 100,
    emoji: categories.icon(category) || '💳',
  }));
});

// ============================================================
// ✅ СРАВНЕНИЕ — из comparison (реальные поля curr/prev)
// ============================================================
const comparison = computed(() => {
  const c = analytics.comparison || {};
  const curr = c.curr || { income: 0, expense: 0 };
  const prev = c.prev || { income: 0, expense: 0 };

  return {
    current: {
      income: curr.income,
      expense: curr.expense,
      balance: curr.income - curr.expense,
    },
    previous: {
      income: prev.income,
      expense: prev.expense,
      balance: prev.income - prev.expense,
    },
  };
});

// ============================================================
// ЦЕЛЬ — из goalsStore.primaryGoal
// ============================================================
const primaryGoal = computed(() => goals.primaryGoal);

const goalSaved = computed(() => {
  const g = primaryGoal.value;
  if (!g) return 0;
  return Object.values(g.contributions ?? {})
    .reduce((s, v) => s + (Number(v) || 0), 0);
});

const goalPercent = computed(() => {
  const g = primaryGoal.value;
  if (!g || !g.target) return 0;
  return Math.min(100, (goalSaved.value / g.target) * 100);
});
</script>

<template>
  <div class="analytics-page">
    <div class="analytics">
      <PageHero title="Аналитика" subtitle="Обзор финансов за период" />

      <div class="bento">
        <!-- Hero -->
        <div class="bento__hero">
          <AnalyticsHero />
        </div>

        <!-- Плитки с разными позициями персонажей -->
        <MetricTile
          label="Свободно"
          :value="freeAfterExpenses"
          unit="₽"
          sub="после обязательных"
          color="emerald"
          mascot="wallet"
          mascot-pos="left"
          emoji="💰"
          :mascot-size="90"
        />

        <MetricTile
          label="Подушка"
          :value="Number(safetyMonths).toFixed(1)"
          unit="мес"
          :sub="safetyMonths < 3 ? '⚠️ Мало' : '✅ Ок'"
          color="amber"
          mascot="shield"
          mascot-pos="right"
          emoji="⏳"
          :mascot-size="90"
        />

        <MetricTile
          label="Расход/день"
          :value="dailyAverage"
          unit="₽"
          sub="средний за месяц"
          color="rose"
          mascot="calculator"
          mascot-pos="corner"
          emoji="🔥"
          :mascot-size="80"
        />

        <!-- Цель -->
        <GoalRing
          v-if="primaryGoal"
          :percent="goalPercent"
          :saved="goalSaved"
          :target="primaryGoal.target"
          :goal-name="primaryGoal.name"
          :goal-emoji="primaryGoal.emoji || '🎯'"
        />
        <MetricTile
          v-else
          label="Цель"
          value="—"
          sub="не задана"
          color="violet"
          mascot="star"
          mascot-pos="floating"
          emoji="🎯"
          :mascot-size="80"
        />

        <!-- Тренды -->
        <div class="bento__chart">
          <div class="chart-card">
            <div class="chart-card__head">
              <span class="chart-card__icon">📊</span>
              <span class="chart-card__title">Тренд расходов</span>
            </div>
            <MiniChart
              :data="dailyExpenseChart"
              :width="400"
              :height="60"
              color="#f87171"
              track-color="rgba(255,255,255,0.06)"
            />
          </div>
        </div>

        <div class="bento__chart">
          <div class="chart-card">
            <div class="chart-card__head">
              <span class="chart-card__icon">📈</span>
              <span class="chart-card__title">Тренд доходов</span>
            </div>
            <MiniChart
              :data="dailyIncomeChart"
              :width="400"
              :height="60"
              color="#4ade80"
              track-color="rgba(255,255,255,0.06)"
            />
          </div>
        </div>

        <!-- Периоды -->
        <div class="bento__period">
          <PeriodSelector />
        </div>

        <!-- Сравнение -->
        <div class="bento__cmp">
          <ComparisonCard
            :current="comparison.current"
            :previous="comparison.previous"
          />
        </div>

        <!-- Категории -->
        <div class="bento__cat">
          <CategoryBreakdown
            :items="categoriesBreakdown"
            :total="metrics.monthExpense || 0"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* ============================================================
   ✅ ТЁМНЫЙ ФОН на всю страницу (принудительно для вкладки)
   ============================================================ */
.analytics-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0f0a1e 0%, #1a1035 100%);
  color: #ffffff;
  padding: 16px 20px 100px;
  margin: 0 -16px; /* компенсируем возможный padding родителя */
  box-sizing: border-box;
}

.analytics {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1280px;
  margin: 0 auto;
}

/* ============================================================
   BENTO GRID
   ============================================================ */
.bento {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.bento__hero { grid-column: 1 / -1; }
.bento__chart { grid-column: span 2; }
.bento__period,
.bento__cmp,
.bento__cat { grid-column: 1 / -1; }

.chart-card {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  border-radius: 18px;
  padding: 16px 18px;
  color: #ffffff;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 12px 32px -10px rgba(139, 92, 246, 0.35);
}

.chart-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.chart-card__icon { font-size: 16px; }

.chart-card__title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.9;
}

/* ============================================================
   АДАПТИВ
   ============================================================ */
@media (max-width: 1100px) {
  .bento { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 700px) {
  .analytics-page { padding: 12px 12px 100px; }
  .analytics { gap: 12px; }
  .bento { grid-template-columns: 1fr; gap: 12px; }
  .bento__chart { grid-column: 1 / -1; }
  .chart-card { padding: 14px; border-radius: 16px; }
}
</style>