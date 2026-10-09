<script setup>
import { onMounted, computed, ref } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useAnalyticsStore } from '@/stores/analytics';
import { useGoalsStore } from '@/stores/goals';
import { useToast } from '@/composables/useToast';
import { notifySaved, notifyError } from '@/composables/useDataStatus';
import { fmt } from '@/composables/useFormat';

import PeriodSelector from '@/components/analytics/PeriodSelector.vue';
import MetricCard from '@/components/analytics/MetricCard.vue';
import ComparisonCard from '@/components/analytics/ComparisonCard.vue';
import GoalsList from '@/components/goals/GoalsList.vue';
import GoalModal from '@/components/goals/GoalModal.vue';
import ContributeModal from '@/components/goals/ContributeModal.vue';
import EditContribModal from '@/components/goals/EditContribModal.vue';
import FinancialAssistant from '@/components/analytics/FinancialAssistant.vue';
import FinanceQuotes from '@/components/analytics/FinanceQuotes.vue';

const accounts = useAccountsStore();
const analytics = useAnalyticsStore();
const goalsStore = useGoalsStore();
const toast = useToast();

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
  } catch (e) {
    notifyError(e.message || 'Не удалось загрузить данные');
    toast.error('Не удалось загрузить данные');
    console.error(e);
  }
});

const metrics = computed(() => analytics.currentMonthMetrics);

const saveRateHint = computed(() => {
  const m = metrics.value;
  return `${m.savePercent}% от дохода ${fmt(m.monthIncome)} ₽`;
});

const runwayHint = computed(() => {
  const r = metrics.value.runway;
  if (r >= 6) return '✅ Надёжная подушка';
  if (r >= 3) return '⚠️ Минимум';
  return '❗ Мало';
});

const saveMonthlyHint = computed(() => {
  const m = metrics.value;
  return `${m.monthName}: рекомендовано ${m.savePercent}% от ${fmt(m.monthIncome)} ₽`;
});

const realFreeHint = computed(() => {
  const m = metrics.value;
  if (m.realFree > 0) return `Свободно после расходов: ${fmt(m.realFree)} ₽`;
  if (m.realFree < 0) return `Перерасход: ${fmt(Math.abs(m.realFree))} ₽`;
  return 'Нет данных';
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

async function onSetPrimary(goal) {
  try {
    if (goal.primary) {
      await goalsStore.clearPrimary();
      toast.info('☆ Основная цель снята');
    } else {
      await goalsStore.setPrimary(goal.id);
      toast.success(`⭐ «${goal.name}» — основная цель`);
    }
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
    <div class="analytics-grid">
      <div class="an-col an-col-left">
        <div class="metrics-grid">
          <MetricCard
            icon="💰"
            label="Можно откладывать (10%)"
            :value="fmt(metrics.monthSave) + ' ₽'"
            :hint="saveMonthlyHint"
            accent
            size="big"
            style="animation-delay: 0ms"
          />
          <MetricCard
            icon="📊"
            label="Свободно после расходов"
            :value="fmt(metrics.realFree) + ' ₽'"
            :hint="realFreeHint"
            style="animation-delay: 70ms"
          />
          <MetricCard
            icon="⏳"
            label="Подушка"
            :value="metrics.runway.toFixed(1) + ' мес'"
            :hint="runwayHint"
            style="animation-delay: 140ms"
          />
          <MetricCard
            icon="🔥"
            label="Расход в день"
            :value="fmt(metrics.dailyAvg) + ' ₽'"
            :hint="'при ' + fmt(metrics.avgExpense) + ' ₽/мес'"
            style="animation-delay: 210ms"
          />
        </div>

        <PeriodSelector />

        <section class="card">
          <h2 class="card-title">🔀 Сравнение с прошлым периодом</h2>
          <ComparisonCard />
        </section>

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
            @set-primary="onSetPrimary"
          />
        </section>
      </div>

      <div class="an-col an-col-right">
        <FinancialAssistant />
        <FinanceQuotes />
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
  padding: 20px 20px 20px;
  position: relative;
}

.analytics-page::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 50% at 15% 0%, rgba(99, 102, 241, 0.08), transparent 60%),
    radial-gradient(ellipse 60% 40% at 85% 40%, rgba(139, 92, 246, 0.06), transparent 60%),
    radial-gradient(ellipse 80% 60% at 50% 100%, rgba(236, 72, 153, 0.05), transparent 65%),
    linear-gradient(180deg, #fafbff 0%, #f3f5fb 100%);
  transition: background 0.4s ease;
}

:global(:root[data-app-theme="dark"]) .analytics-page::before {
  background:
    radial-gradient(ellipse 70% 50% at 15% 0%, rgba(139, 92, 246, 0.15), transparent 60%),
    radial-gradient(ellipse 60% 40% at 85% 40%, rgba(168, 85, 247, 0.10), transparent 60%),
    radial-gradient(ellipse 80% 60% at 50% 100%, rgba(236, 72, 153, 0.08), transparent 65%),
    linear-gradient(180deg, #0a0612 0%, #100820 100%);
}

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
  background: var(--grad-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  animation: cardEnter 0.55s cubic-bezier(.34,1.56,.64,1) both;
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

@keyframes cardEnter {
  from { opacity: 0; transform: translateY(16px) scale(0.95); filter: blur(4px); }
  to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
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
  background: var(--grad-primary);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 -2px 0 rgba(0, 0, 0, 0.15) inset,
    0 6px 16px -8px rgba(139, 92, 246, 0.7);
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 -2px 0 rgba(0, 0, 0, 0.15) inset,
      0 10px 22px -10px rgba(139, 92, 246, 0.9);
  }
}

.an-col-left .card:nth-child(3) { animation-delay: 280ms; }
.an-col-left .card:nth-child(4) { animation-delay: 350ms; }
.an-col-right .card:nth-child(1) { animation-delay: 300ms; }
.an-col-right .card:nth-child(2) { animation-delay: 400ms; }

:global(:root[data-app-theme="dark"]) {
  .card {
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.35),
      0 12px 28px -8px rgba(139, 92, 246, 0.25),
      0 0 0 1px rgba(139, 92, 246, 0.08) inset;
  }
}

@media (max-width: 1100px) {
  .analytics-grid { grid-template-columns: 1fr; max-width: 900px; }
  .an-col-right { position: static; }
  .metrics-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    & > :first-child { grid-column: 1 / -1; }
  }
}

@media (max-width: 700px) {
  .analytics-page { padding: 12px 12px 20px; }
  .analytics-grid { gap: 10px; }
  .an-col { gap: 10px; }
  .card { padding: 12px 14px; border-radius: 14px; }
  .card-title { font-size: 11px; letter-spacing: 0.06em; }
  .card-head { margin-bottom: 10px; gap: 6px; }
  .btn-add-goal { padding: 6px 12px; font-size: 11px; }
}

@media (max-width: 380px) {
  .metrics-grid { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .card,
  :deep(.metric-card) { animation: none !important; }
}
</style>