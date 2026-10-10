<!-- frontend/src/views/AnalyticsView.vue -->
<script setup>
import { computed, onMounted } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics';
import { useGoalsStore } from '@/stores/goals';

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

onMounted(() => {
  analytics.refresh?.();
});

// ============================================================
// Демо-данные (используются, если стор пуст)
// ============================================================
const DEMO = {
  freeAfterExpenses: 10703,
  safetyMonths: 2.4,
  dailyAverage: 17640,
  dailyExpenseTrend: [3, 5, 8, 6, 9, 7, 10],
  dailyIncomeTrend: [5, 4, 7, 8, 6, 9, 8],
  categoriesBreakdown: [
    { category: 'Продукты', amount: 5200, percent: 32, emoji: '🛒' },
    { category: 'Кафе',     amount: 3100, percent: 19, emoji: '☕' },
    { category: 'Такси',    amount: 2400, percent: 15, emoji: '🚕' },
    { category: 'Связь',    amount: 1500, percent: 9,  emoji: '📱' },
  ],
  currentMonthSummary:  { income: 169465, expense: 158760, balance: 10705 },
  previousMonthSummary: { income: 152000, expense: 149000, balance: 3000 },
};

// ============================================================
// Метрики — берём из стора, иначе демо
// ============================================================
const freeAfterExpenses = computed(() =>
  analytics.freeAfterExpenses || DEMO.freeAfterExpenses
);

const safetyMonths = computed(() =>
  analytics.safetyMonths || DEMO.safetyMonths
);

const dailyAverage = computed(() =>
  analytics.dailyAverage || DEMO.dailyAverage
);

const dailyExpenseChart = computed(() => {
  const v = analytics.dailyExpenseTrend;
  return (v && v.length) ? v : DEMO.dailyExpenseTrend;
});

const dailyIncomeChart = computed(() => {
  const v = analytics.dailyIncomeTrend;
  return (v && v.length) ? v : DEMO.dailyIncomeTrend;
});

const categories = computed(() => {
  const v = analytics.categoriesBreakdown;
  return (v && v.length) ? v : DEMO.categoriesBreakdown;
});

const comparison = computed(() => ({
  current:  analytics.currentMonthSummary  || DEMO.currentMonthSummary,
  previous: analytics.previousMonthSummary || DEMO.previousMonthSummary,
}));

// ============================================================
// Цель
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
  <div class="analytics">
    <PageHero title="Аналитика" subtitle="Обзор финансов за период" />

    <div class="bento">
      <!-- Hero -->
      <div class="bento__hero">
        <AnalyticsHero />
      </div>

      <!-- Плитки — у каждой своя позиция персонажа -->
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

      <!-- Цель — кольцо или плитка -->
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
            <span class="chart-card__title">Тренд расходов (7 дней)</span>
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
            <span class="chart-card__title">Тренд доходов (7 дней)</span>
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
        <CategoryBreakdown :items="categories" :total="comparison.current.expense" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.analytics {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 80px;
}

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

@media (max-width: 1100px) {
  .bento { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 700px) {
  .analytics { gap: 12px; }
  .bento { grid-template-columns: 1fr; gap: 12px; }
  .bento__chart { grid-column: 1 / -1; }
  .chart-card { padding: 14px; border-radius: 16px; }
}
</style>