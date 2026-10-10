<!-- frontend/src/views/AnalyticsView.vue -->
<script setup>
import { computed, onMounted } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics';
import { useTransactionsStore } from '@/stores/transactions';
import { useAccountsStore } from '@/stores/accounts';
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
const txStore = useTransactionsStore();
const accounts = useAccountsStore();
const goals = useGoalsStore();

onMounted(() => {
  analytics.refresh?.();
});

// ============================================================
// Мини-графики (тренд за 7 дней)
// ============================================================
const dailyExpenseChart = computed(() => analytics.dailyExpenseTrend || []);
const dailyIncomeChart  = computed(() => analytics.dailyIncomeTrend  || []);

// ============================================================
// Цель
// ============================================================
const primaryGoal = computed(() => goals.primaryGoal);
const goalSaved = computed(() => {
  const g = primaryGoal.value;
  if (!g) return 0;
  return Object.values(g.contributions ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
});
const goalPercent = computed(() => {
  const g = primaryGoal.value;
  if (!g || !g.target) return 0;
  return Math.min(100, (goalSaved.value / g.target) * 100);
});

// ============================================================
// Плитки
// ============================================================
const freeAfterExpenses = computed(() => analytics.freeAfterExpenses || 0);
const safetyMonths = computed(() => analytics.safetyMonths || 0);
const dailyAverage = computed(() => analytics.dailyAverage || 0);

const categories = computed(() => analytics.categoriesBreakdown || []);
const comparison = computed(() => ({
  current: analytics.currentMonthSummary || { income: 0, expense: 0, balance: 0 },
  previous: analytics.previousMonthSummary || { income: 0, expense: 0, balance: 0 },
}));
</script>

<template>
  <div class="analytics">
    <PageHero title="Аналитика" subtitle="Обзор финансов за период" />

    <!-- Bento grid -->
    <div class="bento">
      <!-- Hero — на всю ширину -->
      <div class="bento__hero">
        <AnalyticsHero />
      </div>

      <!-- 4 плитки: 2×2 -->
      <MetricTile
        label="Свободно"
        :value="freeAfterExpenses"
        unit="₽"
        sub="после обязательных"
        color="emerald"
        mascot="wallet"
        mascot-pos="floating"
        emoji="💰"
        :mascot-size="80"
      />

      <MetricTile
        label="Подушка"
        :value="safetyMonths.toFixed(1)"
        unit="мес"
        :sub="safetyMonths < 3 ? '⚠️ Мало' : '✅ Ок'"
        color="amber"
        mascot="shield"
        mascot-pos="floating"
        emoji="⏳"
        :mascot-size="80"
      />

      <MetricTile
        label="Расход/день"
        :value="dailyAverage"
        unit="₽"
        sub="средний за месяц"
        color="rose"
        mascot="calculator"
        mascot-pos="floating"
        emoji="🔥"
        :mascot-size="80"
      />

      <!-- Цель — с кольцом -->
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

      <!-- Мини-график: тренд расходов (на всю ширину, 2 колонки) -->
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

      <!-- Мини-график: тренд доходов -->
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

      <!-- PeriodSelector — на всю ширину -->
      <div class="bento__period">
        <PeriodSelector />
      </div>

      <!-- ComparisonCard — на всю ширину -->
      <div class="bento__cmp">
        <ComparisonCard
          :current="comparison.current"
          :previous="comparison.previous"
        />
      </div>

      <!-- CategoryBreakdown — на всю ширину -->
      <div class="bento__cat">
        <CategoryBreakdown
          :items="categories"
          :total="analytics.currentMonthSummary?.expense || 0"
        />
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
  border-radius: 20px;
  padding: 18px 20px;
  color: #ffffff;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 12px 32px -10px rgba(139, 92, 246, 0.35);
}

.chart-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
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
  .analytics { gap: 12px; }
  .bento { grid-template-columns: 1fr; gap: 12px; }
  .bento__chart { grid-column: 1 / -1; }
  .chart-card { padding: 14px; border-radius: 16px; }
}
</style>