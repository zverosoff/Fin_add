<script setup>
import { onMounted, computed, ref } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useAnalyticsStore } from '@/stores/analytics';
import { useGoalsStore } from '@/stores/goals';
import { useWebSocket } from '@/composables/useWebSocket';
import { useToast } from '@/composables/useToast';
import { notifySaved, notifyError } from '@/composables/useDataStatus';
import { fmt } from '@/composables/useFormat';

import PageHero from '@/components/ui/PageHero.vue';
import PeriodSelector from '@/components/analytics/PeriodSelector.vue';
import MetricCard from '@/components/analytics/MetricCard.vue';
import ComparisonCard from '@/components/analytics/ComparisonCard.vue';
import BarChart from '@/components/analytics/BarChart.vue';
import LineChart from '@/components/analytics/LineChart.vue';
import GoalsList from '@/components/goals/GoalsList.vue';
import GoalModal from '@/components/goals/GoalModal.vue';
import ContributeModal from '@/components/goals/ContributeModal.vue';
import EditContribModal from '@/components/goals/EditContribModal.vue';

const accounts = useAccountsStore();
const analytics = useAnalyticsStore();
const goalsStore = useGoalsStore();
const toast = useToast();
const { connect } = useWebSocket();

const goalModalOpen = ref(false);
const goalToEdit = ref(null);

const contributeModalOpen = ref(false);
const contributeGoal = ref(null);

const editContribModalOpen = ref(false);
const editContribGoal = ref(null);
const editContribUser = ref('');

onMounted(async () => {
  try {
    if (!accounts.loaded) await accounts.load();
    notifySaved('готово');
    connect();
  } catch (e) {
    notifyError(e.message || 'Не удалось загрузить данные');
    toast.error('Не удалось загрузить данные');
    console.error(e);
  }
});

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

const saveMonthlyHint = computed(() => {
  const m = metrics.value;
  if (m.monthSave > 0) return `${m.monthName}: ${fmt(m.monthIncome)} ₽ − ${fmt(m.monthExpense)} ₽`;
  if (m.monthSave < 0) return `${m.monthName}: перерасход ${fmt(Math.abs(m.monthSave))} ₽`;
  return `${m.monthName}: нет данных`;
});

function openAddGoal() {
  goalToEdit.value = null;
  goalModalOpen.value = true;
}

function openEditGoal(goal) {
  goalToEdit.value = goal;
  goalModalOpen.value = true;
}

async function onDeleteGoal(goal) {
  if (!confirm(`Удалить цель «${goal.name}»?`)) return;
  try {
    await goalsStore.remove(goal.id);
    toast.info('🗑 Цель удалена');
  } catch (e) {
    toast.error('Ошибка: ' + e.message);
  }
}

function openContribute(goal) {
  contributeGoal.value = goal;
  contributeModalOpen.value = true;
}

function openEditContrib({ goal, user }) {
  editContribGoal.value = goal;
  editContribUser.value = user;
  editContribModalOpen.value = true;
}
</script>

<template>
  <div class="analytics-page">
    <PageHero title="📊 Аналитика" />

      <div class="analytics-grid">
      <!-- ЛЕВАЯ КОЛОНКА -->
      <div class="an-col an-col-left">
        <!-- Метрики (4 в ряд) -->
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

        <!-- Период -->
        <PeriodSelector />

        <!-- Сравнение с прошлым периодом -->
        <section class="card">
          <h2 class="card-title">🔀 Сравнение с прошлым периодом</h2>
          <ComparisonCard />
        </section>

        <!-- Графики -->
        <section class="card">
          <h2 class="card-title">📊 Доходы и расходы по месяцам</h2>
          <BarChart :data="analytics.monthlyData" />
        </section>

        <section class="card">
          <h2 class="card-title">📈 Накопление баланса</h2>
          <LineChart :data="analytics.monthlyData" />
        </section>
      </div>

      <!-- ПРАВАЯ КОЛОНКА -->
      <div class="an-col an-col-right">
        <!-- Цели -->
        <section class="card">
          <div class="card-head">
            <h2 class="card-title">🎯 Цели накоплений и желаемые покупки</h2>
            <button class="btn-add-goal" @click="openAddGoal">+ Добавить</button>
          </div>
          <GoalsList
            @add="openAddGoal"
            @edit="openEditGoal"
            @delete="onDeleteGoal"
            @contribute="openContribute"
            @edit-contrib="openEditContrib"
          />
        </section>
      </div>
    </div>

    <GoalModal v-model="goalModalOpen" :goal="goalToEdit" />
    <ContributeModal v-model="contributeModalOpen" :goal="contributeGoal" />
    <EditContribModal
      v-model="editContribModalOpen"
      :goal="editContribGoal"
      :user="editContribUser"
    />
  </div>
</template>

<style scoped lang="scss">
.analytics-page {
  min-height: 100vh;
  padding: 20px 20px 60px;
}

/* ============================================================
   ДЕСКТОП — 2 колонки
   ============================================================ */
.analytics-grid {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 20px;
  align-items: start;
}

.an-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.an-col-right {
  position: sticky;
  top: 20px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 10px;
}

.card {
  padding: 16px 18px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.card-title {
  font-size: 12px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  margin: 0;
}

.card-head .card-title { margin-bottom: 0; }

.btn-add-goal {
  padding: 6px 14px;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 16px -8px rgba(59, 130, 246, 0.7);
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 22px -10px rgba(59, 130, 246, 0.9);
  }
}

/* ============================================================
   ПЛАНШЕТ
   ============================================================ */
@media (max-width: 1100px) {
  .analytics-grid {
    grid-template-columns: 1fr;
    max-width: 900px;
  }

  .an-col-right {
    position: static;
  }

  .metrics-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;

    & > :first-child { grid-column: 1 / -1; }
  }
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .analytics-page { padding: 12px 12px 40px; }
  .analytics-grid { gap: 10px; }

  .an-col { gap: 10px; }

  .card { padding: 12px 14px; border-radius: 14px; }

  .card-title { font-size: 11px; letter-spacing: 0.06em; }

  .card-head { margin-bottom: 10px; gap: 6px; }

  .btn-add-goal {
    padding: 6px 12px;
    font-size: 11px;
  }
}

@media (max-width: 380px) {
  .metrics-grid { grid-template-columns: 1fr; }
}
</style>