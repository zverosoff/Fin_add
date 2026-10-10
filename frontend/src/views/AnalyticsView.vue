<!-- frontend/src/views/AnalyticsView.vue -->
<script setup>
import { onMounted, computed, ref } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useAnalyticsStore } from '@/stores/analytics';
import { useGoalsStore } from '@/stores/goals';
import { useCategoriesStore } from '@/stores/categories';
import { useToast } from '@/composables/useToast';
import { notifySaved, notifyError } from '@/composables/useDataStatus';
import { fmt } from '@/composables/useFormat';

// ✅ Новые визуальные компоненты
import AnalyticsHero from '@/components/analytics/AnalyticsHero.vue';
import MetricTile from '@/components/analytics/MetricTile.vue';
import MascotImage from '@/components/analytics/MascotImage.vue';

// ✅ Рабочий функционал
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
const categories = useCategoriesStore();
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

// ✅ РЕАЛЬНЫЕ метрики
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

// ✅ РАСХОДЫ ПО КАТЕГОРИЯМ — считаем из periodTransactions
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
    .slice(0, 8); // топ-8

  return sorted.map(([category, amount]) => ({
    category,
    amount,
    percent: (amount / totalExpense) * 100,
    emoji: categories.icon(category) || '💳',
  }));
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
      <!-- ЛЕВАЯ КОЛОНКА -->
      <div class="an-col an-col-left">
        <!-- HERO -->
        <AnalyticsHero />

        <!-- Плитки метрик -->
        <div class="metrics-grid">
          <MetricTile
            label="Свободно"
            :value="metrics.realFree"
            unit="₽"
            :sub="realFreeHint"
            color="emerald"
            mascot="wallet"
            mascot-pos="left"
            emoji="💰"
            :mascot-size="130"
          />

          <MetricTile
            label="Подушка"
            :value="Number(metrics.runway || 0).toFixed(1)"
            unit="мес"
            :sub="runwayHint"
            color="amber"
            mascot="shield"
            mascot-pos="right"
            emoji="⏳"
            :mascot-size="130"
          />

          <MetricTile
            label="Расход/день"
            :value="metrics.dailyAvg"
            unit="₽"
            :sub="dailyAvgHint"
            color="rose"
            mascot="calculator"
            mascot-pos="corner"
            emoji="🔥"
            :mascot-size="110"
          />
        </div>

        <!-- Навигация по месяцам -->
        <MonthNav />

        <!-- ✅ РАСХОДЫ ПО КАТЕГОРИЯМ — вернули -->
        <section class="card card-dark">
          <CategoryBreakdown
            :items="categoriesBreakdown"
            :total="metrics.monthExpense || 0"
          />
        </section>

        <!-- ✅ ЦЕЛИ — с персонажем -->
        <section class="card card-dark card-goals">
          <!-- Персонаж — звезда, парит справа в углу -->
          <MascotImage
            name="star"
            position="corner"
            :size="110"
            fallback="🎯"
            alt="Цели"
          />

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

      <!-- ПРАВАЯ КОЛОНКА — только помощник -->
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
.analytics-page {
  min-height: 100vh;
  padding: 20px 20px 100px;
  background: linear-gradient(180deg, #0f0a1e 0%, #1a1035 100%);
  color: #ffffff;
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
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  color: #ffffff;
}

/* ✅ Блок целей — с персонажем, overflow visible */
.card-goals {
  position: relative;
  overflow: visible;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  padding-right: 80px; /* отступ справа под звезду */
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

@media (max-width: 700px) {
  .analytics-page { padding: 12px 12px 100px; }
  .analytics-grid { gap: 10px; }
  .an-col { gap: 10px; }
  .card { padding: 12px 14px; border-radius: 14px; }
  .card-title { font-size: 11px; letter-spacing: 0.06em; }
  .metrics-grid { grid-template-columns: 1fr; }
  .card-head { padding-right: 70px; }
}
</style>