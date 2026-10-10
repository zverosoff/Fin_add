<!-- frontend/src/views/AnalyticsView.vue -->
<script setup>
import { onMounted, computed, ref } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useAnalyticsStore } from '@/stores/analytics';
import { useGoalsStore } from '@/stores/goals';
import { useToast } from '@/composables/useToast';
import { notifySaved, notifyError } from '@/composables/useDataStatus';
import { fmt } from '@/composables/useFormat';

import AnalyticsHero from '@/components/analytics/AnalyticsHero.vue';
import MetricTile from '@/components/analytics/MetricTile.vue';
import MascotImage from '@/components/analytics/MascotImage.vue';

import MonthNav from '@/components/analytics/MonthNav.vue';
import CategoryBreakdown from '@/components/analytics/CategoryBreakdown.vue';
import GoalsList from '@/components/goals/GoalsList.vue';
import GoalModal from '@/components/goals/GoalModal.vue';
import ContributeModal from '@/components/goals/ContributeModal.vue';
import EditContribModal from '@/components/goals/EditContribModal.vue';
import FinancialAssistant from '@/components/analytics/FinancialAssistant.vue';

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

const runwayHint = computed(() => {
  const r = metrics.value.runway;
  if (r >= 6) return '✅ Надёжная подушка';
  if (r >= 3) return '⚠️ Минимум';
  return '❗ Мало';
});

const realFreeHint = computed(() => {
  const m = metrics.value;
  if (m.realFree > 0) return 'после обязательных';
  if (m.realFree < 0) return 'перерасход';
  return 'нет данных';
});

const dailyAvgHint = computed(() => {
  const m = metrics.value;
  return `при ${fmt(m.avgExpense)} ₽/мес`;
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
        <AnalyticsHero />

        <div class="metrics-grid">
          <!-- ✅ Кошелёк слева -->
          <MetricTile
            label="Свободно"
            :value="metrics.realFree"
            unit="₽"
            :sub="realFreeHint"
            color="emerald"
            mascot="wallet"
            mascot-pos="left"
            emoji="💰"
            :mascot-size="150"
          />

          <!-- Подушка справа -->
          <MetricTile
            label="Подушка"
            :value="Number(metrics.runway || 0).toFixed(1)"
            unit="мес"
            :sub="runwayHint"
            color="amber"
            mascot="shield"
            mascot-pos="right"
            emoji="⏳"
            :mascot-size="150"
          />

          <!-- ✅ Калькулятор слева -->
          <MetricTile
            label="Расход/день"
            :value="metrics.dailyAvg"
            unit="₽"
            :sub="dailyAvgHint"
            color="rose"
            mascot="calculator"
            mascot-pos="left"
            emoji="🔥"
            :mascot-size="150"
          />
        </div>

        <MonthNav />

        <section class="card card-dark">
          <CategoryBreakdown />
        </section>

        <!-- ✅ ЦЕЛИ: звезда справа по центру -->
        <section class="card card-dark card-goals">
          <MascotImage
            name="star"
            position="goals-right-center"
            :size="220"
            fallback="🎯"
            alt="Цели"
          />

          <div class="card-goals__content">
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
          </div>
        </section>
      </div>

      <div class="an-col an-col-right">
        <FinancialAssistant />
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
/* ✅ ХАРДКОД ТЁМНОГО ФОНА */
.analytics-page {
  position: relative;
  min-height: 100vh;
  padding: 20px 20px 100px;
  background: linear-gradient(180deg, #0f0a1e 0%, #1a1035 100%) !important;
  color: #ffffff !important;
  z-index: 0;
}

/* ✅ Перебиваем белый фон body */
.analytics-page::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  background: linear-gradient(180deg, #0f0a1e 0%, #1a1035 100%);
  pointer-events: none;
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
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.card {
  padding: 16px 18px;
  border-radius: 18px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 12px 32px -10px rgba(139, 92, 246, 0.35);
}

.card-dark {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%) !important;
  color: #ffffff !important;
}

/* ✅ Блок целей — звезда справа по центру */
.card-goals {
  position: relative;
  overflow: visible;
  padding-right: 100px;
}

.card-goals__content {
  position: relative;
  z-index: 2;
  min-width: 0;
}

/* ✅ Перебиваем светлые стили GoalCard — тёмная тема */
.card-goals :deep(.goal-card),
.card-goals :deep(.goals-list),
.card-goals :deep(.goal-item) {
  background: rgba(255, 255, 255, 0.05) !important;
  color: #ffffff !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.card-goals :deep(.goal-card *) {
  color: inherit;
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
  color: rgba(255, 255, 255, 0.85);
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
  background: linear-gradient(180deg, #fde047, #facc15);
  color: #0a0612;
  font-family: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 6px 16px -8px rgba(250, 204, 21, 0.8);
  transition: transform 0.15s;
  white-space: nowrap;

  &:hover { transform: translateY(-1px); }
}

@media (max-width: 1100px) {
  .analytics-grid { grid-template-columns: 1fr; max-width: 900px; }
  .an-col-right { position: static; }
  .metrics-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
}

/* ✅ МОБИЛЬНЫЙ — звезда в углу, цель растянута */
@media (max-width: 700px) {
  .analytics-page {
    padding: 16px 16px 120px;
    background: linear-gradient(180deg, #0f0a1e 0%, #1a1035 100%) !important;
  }
  .analytics-grid { gap: 12px; }
  .an-col { gap: 12px; }
  .card { padding: 14px 16px; border-radius: 14px; }
  .card-title { font-size: 11px; letter-spacing: 0.06em; }
  .metrics-grid { grid-template-columns: 1fr; }

  /* ✅ Цель растянута по блоку, звезда сверху */
  .card-goals {
    padding-right: 0;
    padding-top: 130px;
  }

  /* ✅ Растяжка цели по ширине */
  .card-goals :deep(.goal-card),
  .card-goals :deep(.goals-list > *) {
    width: 100% !important;
    max-width: 100% !important;
  }
}
</style>