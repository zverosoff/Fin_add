<script setup>
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useAnalyticsStore } from '@/stores/analytics';
import { useWebSocket } from '@/composables/useWebSocket';
import { useToast } from '@/composables/useToast';
import { fmt } from '@/composables/useFormat';

import AppTabs from '@/components/ui/AppTabs.vue';
import PeriodSelector from '@/components/analytics/PeriodSelector.vue';
import MetricCard from '@/components/analytics/MetricCard.vue';
import ComparisonCard from '@/components/analytics/ComparisonCard.vue';
import BarChart from '@/components/analytics/BarChart.vue';
import LineChart from '@/components/analytics/LineChart.vue';

const router = useRouter();
const auth = useAuthStore();
const accounts = useAccountsStore();
const analytics = useAnalyticsStore();
const toast = useToast();
const { connect } = useWebSocket();

// ============================================================
// Инициализация
// ============================================================
onMounted(async () => {
  try {
    if (!accounts.loaded) await accounts.load();
    connect();
  } catch (e) {
    toast.error('Не удалось загрузить данные');
    console.error(e);
  }
});

// ============================================================
// Метрики
// ============================================================
const metrics = computed(() => analytics.currentMonthMetrics);

const saveRateHint = computed(() => {
  const r = metrics.value.monthSaveRate;
  if (r >= 20) return '✅ Отличный показатель';
  if (r >= 10) return '⚠️ Можно улучшить';
  if (r > 0) return '❗ Слишком низко';
  return '🚨 Расходы превышают доходы';
});

const runwayHint = computed(() => {
  const r = metrics.value.runway;
  if (r >= 6) return '✅ Надёжная подушка';
  if (r >= 3) return '⚠️ Минимум';
  return '❗ Мало';
});

// Подсказка для карточки «Можно откладывать»
const saveMonthlyHint = computed(() => {
  const m = metrics.value;
  if (m.monthSave > 0) {
    return `${m.monthName}: ${fmt(m.monthIncome)} ₽ − ${fmt(m.monthExpense)} ₽`;
  }
  if (m.monthSave < 0) {
    return `${m.monthName}: перерасход ${fmt(Math.abs(m.monthSave))} ₽`;
  }
  return `${m.monthName}: нет данных`;
});

// ============================================================
// Выход
// ============================================================
async function handleLogout() {
  if (!confirm('Выйти из аккаунта?')) return;
  await auth.logout();
  router.push('/login');
}
</script>

<template>
  <div class="analytics-page">
    <!-- Шапка -->
    <header class="top-bar">
      <h1>📊 Аналитика</h1>
      <div class="user-info">
        <span>👤 {{ auth.user }}</span>
        <button @click="handleLogout">Выйти</button>
      </div>
    </header>

    <!-- Табы -->
    <AppTabs />

    <div class="container">
      <!-- Переключатель периода -->
      <PeriodSelector />

      <!-- Метрики -->
      <div class="metrics-grid">
        <MetricCard
          icon="💰"
          label="Можно откладывать в месяц"
          :value="fmt(metrics.monthSave) + ' ₽'"
          :hint="saveMonthlyHint"
          accent
          size="big"
        />

        <MetricCard
          icon="📊"
          label="Норма сбережений"
          :value="Math.round(metrics.monthSaveRate) + '%'"
          :hint="saveRateHint"
        />

        <MetricCard
          icon="⏳"
          label="Подушка"
          :value="metrics.runway.toFixed(1) + ' мес'"
          :hint="runwayHint"
        />

        <MetricCard
          icon="🔥"
          label="Расход в день"
          :value="fmt(metrics.dailyAvg) + ' ₽'"
          :hint="'при ' + fmt(metrics.avgExpense) + ' ₽/мес'"
        />
      </div>

      <!-- Сравнение периодов -->
      <section class="card">
        <h2 class="card-title">🔀 Сравнение с прошлым периодом</h2>
        <ComparisonCard />
      </section>

      <!-- Столбчатая диаграмма -->
      <section class="card">
        <h2 class="card-title">📊 Доходы и расходы по месяцам</h2>
        <BarChart :data="analytics.monthlyData" />
      </section>

      <!-- Линейный график -->
      <section class="card">
        <h2 class="card-title">📈 Накопление баланса</h2>
        <LineChart :data="analytics.monthlyData" />
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.analytics-page {
  min-height: 100vh;
  padding: 20px 20px 60px;
}

/* ============================================================
   Шапка
   ============================================================ */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 900px;
  margin: 0 auto 16px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  box-shadow: var(--shadow-md);

  h1 {
    font-size: 20px;
    margin: 0;
    background: linear-gradient(135deg, #0f172a, #0284c7);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--text);

  button {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      border-color: var(--danger);
      color: var(--danger);
      background: rgba(239, 68, 68, 0.05);
    }
  }
}

/* ============================================================
   Контейнер
   ============================================================ */
.container {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ============================================================
   Метрики
   ============================================================ */
.metrics-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 10px;
}

/* ============================================================
   Карточки-секции
   ============================================================ */
.card {
  padding: 16px 18px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: var(--shadow-lg);
  }
}

.card-title {
  font-size: 12px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  margin: 0 0 12px;
}

/* ============================================================
   Планшет
   ============================================================ */
@media (max-width: 900px) {
  .metrics-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .metrics-grid > :first-child {
    grid-column: 1 / -1;
  }
}

/* ============================================================
   Мобильный
   ============================================================ */
@media (max-width: 700px) {
  .analytics-page {
    padding: 16px 12px 40px;
  }

  .top-bar {
    padding: 10px 16px;
    margin-bottom: 12px;

    h1 { font-size: 17px; }
  }

  .user-info {
    gap: 8px;
    font-size: 12px;

    button {
      padding: 5px 10px;
      font-size: 11px;
    }
  }

  .container {
    gap: 10px;
  }

  .metrics-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .metrics-grid > :first-child {
    grid-column: 1 / -1;
  }

  .card {
    padding: 12px 14px;
    border-radius: 14px;
  }

  .card-title {
    font-size: 11px;
    margin-bottom: 10px;
  }
}

@media (max-width: 400px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>