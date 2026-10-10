<!-- frontend/src/components/analytics/CategoryBreakdown.vue -->
<script setup>
import { computed, ref, watch } from 'vue';
import { fmt } from '@/composables/useFormat';
import { useCategoriesStore } from '@/stores/categories';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';

const categories = useCategoriesStore();
const accounts = useAccountsStore();
const txStore = useTransactionsStore();

// ✅ Выбранные категории (по умолчанию — все)
const selected = ref(new Set());

const palette = [
  { grad: 'linear-gradient(135deg, #a855f7, #ec4899)', glow: 'rgba(168,85,247,0.5)' },
  { grad: 'linear-gradient(135deg, #06b6d4, #3b82f6)', glow: 'rgba(6,182,212,0.5)' },
  { grad: 'linear-gradient(135deg, #f59e0b, #facc15)', glow: 'rgba(245,158,11,0.5)' },
  { grad: 'linear-gradient(135deg, #10b981, #22c55e)', glow: 'rgba(16,185,129,0.5)' },
  { grad: 'linear-gradient(135deg, #f43f5e, #ef4444)', glow: 'rgba(244,63,94,0.5)' },
  { grad: 'linear-gradient(135deg, #8b5cf6, #6366f1)', glow: 'rgba(139,92,246,0.5)' },
];

// ✅ Категории за ВЫБРАННЫЙ месяц (из txStore.currentMonth)
const monthExpenses = computed(() => {
  const m = txStore.currentMonth;
  const start = new Date(m.getFullYear(), m.getMonth(), 1);
  const end = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59, 999);

  return (accounts.transactions || []).filter(t => {
    if (t.type !== 'expense') return false;
    if (t.fromReconcile) return false;
    const d = new Date(t.date);
    return d >= start && d <= end;
  });
});

const items = computed(() => {
  const expenses = monthExpenses.value;
  const totalExpense = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  if (totalExpense === 0) return [];

  const map = new Map();
  for (const t of expenses) {
    const cat = t.category || 'Прочее';
    map.set(cat, (map.get(cat) || 0) + (Number(t.amount) || 0));
  }

  const sorted = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return sorted.map(([category, amount], idx) => {
    const p = palette[idx % palette.length];
    return {
      category,
      amount,
      percent: (amount / totalExpense) * 100,
      emoji: categories.icon(category) || '💳',
      _grad: p.grad,
      _glow: p.glow,
      _selected: selected.value.has(category),
    };
  });
});

// ✅ Инициализация: по умолчанию ВСЕ выбраны
watch(items, (newItems) => {
  if (selected.value.size === 0 && newItems.length > 0) {
    selected.value = new Set(newItems.map(i => i.category));
  }
}, { immediate: true });

// ✅ Сброс выделения при смене месяца
watch(() => txStore.currentMonth, () => {
  selected.value = new Set();
  // Следующий watch(items) заполнит заново
});

function toggleItem(category) {
  const next = new Set(selected.value);
  if (next.has(category)) next.delete(category);
  else next.add(category);
  selected.value = next;
}

function selectAll() {
  selected.value = new Set(items.value.map(i => i.category));
}

function clearAll() {
  selected.value = new Set();
}

// ✅ Сумма по выбранным
const selectedTotal = computed(() => {
  return items.value
    .filter(i => selected.value.has(i.category))
    .reduce((s, i) => s + i.amount, 0);
});

const allTotal = computed(() =>
  items.value.reduce((s, i) => s + i.amount, 0)
);

const hasItems = computed(() => items.value.length > 0);

// ✅ Название месяца для заголовка
const monthLabel = computed(() => {
  const m = txStore.currentMonth;
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  return `${months[m.getMonth()]} ${m.getFullYear()}`;
});
</script>

<template>
  <section class="cat-breakdown">
    <!-- ✅ Абстрактные фоновые элементы -->
    <div class="cat-bg" aria-hidden="true">
      <span class="cat-bg__orb cat-bg__orb--1"></span>
      <span class="cat-bg__orb cat-bg__orb--2"></span>
      <span class="cat-bg__orb cat-bg__orb--3"></span>
      <span class="cat-bg__dot cat-bg__dot--1"></span>
      <span class="cat-bg__dot cat-bg__dot--2"></span>
      <span class="cat-bg__dot cat-bg__dot--3"></span>
    </div>

    <!-- Заголовок + период + кнопки -->
    <div class="cat-head">
      <div class="cat-head__left">
        <span class="cat-head__icon">📊</span>
        <div>
          <div class="cat-head__title">Расходы по категориям</div>
          <div class="cat-head__month">{{ monthLabel }}</div>
        </div>
      </div>

      <div class="cat-head__actions">
        <button class="cat-btn" type="button" @click="selectAll" title="Выбрать все">
          Все
        </button>
        <button class="cat-btn" type="button" @click="clearAll" title="Снять все">
          Ничего
        </button>
      </div>
    </div>

    <div v-if="!hasItems" class="cat-breakdown__empty">
      Нет расходов за этот месяц
    </div>

    <ul v-else class="cat-breakdown__list">
      <li
        v-for="item in items"
        :key="item.category"
        class="cat-row"
        :class="{ 'is-selected': item._selected }"
        :style="{ '--cat-grad': item._grad, '--cat-glow': item._glow }"
        @click="toggleItem(item.category)"
      >
        <div class="cat-row__stripe" aria-hidden="true"></div>

        <!-- ✅ ЧЕКБОКС -->
        <div class="cat-check" :class="{ 'is-checked': item._selected }">
          <svg v-if="item._selected" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12">
            <polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <div class="cat-row__icon">
          {{ item.emoji }}
        </div>

        <div class="cat-row__main">
          <div class="cat-row__top">
            <span class="cat-row__name">{{ item.category }}</span>
            <span class="cat-row__amount">{{ fmt(item.amount) }} ₽</span>
          </div>
          <div class="cat-row__bar-wrap">
            <div class="cat-row__bar">
              <div
                class="cat-row__bar-fill"
                :style="{ width: item.percent + '%' }"
              ></div>
            </div>
            <span class="cat-row__percent">{{ item.percent.toFixed(0) }}%</span>
          </div>
        </div>
      </li>
    </ul>

    <!-- ✅ ИТОГОВАЯ СУММА по выбранным -->
    <div v-if="hasItems" class="cat-total">
      <div class="cat-total__label">
        Выбрано {{ selected.size }} из {{ items.length }}
      </div>
      <div class="cat-total__value">
        <span class="cat-total__sum">{{ fmt(selectedTotal) }} ₽</span>
        <span v-if="selectedTotal !== allTotal" class="cat-total__of">
          из {{ fmt(allTotal) }} ₽
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.cat-breakdown {
  color: #ffffff;
  position: relative;
  isolation: isolate;
}

/* ✅ Абстрактные фоновые элементы */
.cat-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  border-radius: 14px;
}

.cat-bg__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.25;
}

.cat-bg__orb--1 {
  width: 140px;
  height: 140px;
  background: #a855f7;
  top: -40px;
  right: -30px;
}

.cat-bg__orb--2 {
  width: 120px;
  height: 120px;
  background: #ec4899;
  bottom: -50px;
  left: 20%;
  opacity: 0.18;
}

.cat-bg__orb--3 {
  width: 100px;
  height: 100px;
  background: #6366f1;
  top: 30%;
  left: -30px;
  opacity: 0.2;
}

.cat-bg__dot {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #ffffff;
  opacity: 0.4;
}

.cat-bg__dot--1 { top: 20%; right: 15%; }
.cat-bg__dot--2 { top: 60%; right: 25%; opacity: 0.25; width: 3px; height: 3px; }
.cat-bg__dot--3 { bottom: 25%; left: 45%; opacity: 0.3; }

/* Заголовок */
.cat-head {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.cat-head__left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cat-head__icon { font-size: 20px; }

.cat-head__title {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cat-head__month {
  font-size: 11px;
  opacity: 0.7;
  font-weight: 600;
  margin-top: 2px;
  letter-spacing: 0.04em;
}

.cat-head__actions {
  display: flex;
  gap: 6px;
}

.cat-btn {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.3);
  }
  &:active { transform: scale(0.96); }
}

.cat-breakdown__empty {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 24px 0;
  font-size: 13px;
  opacity: 0.6;
}

/* Список */
.cat-breakdown__list {
  position: relative;
  z-index: 2;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cat-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px 10px 16px;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;

  background: rgba(255, 255, 255, 0.04);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  transition: transform 0.15s, background 0.2s, opacity 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateX(2px);
  }

  &.is-selected {
    background: rgba(255, 255, 255, 0.08);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.15) inset,
      0 4px 12px -4px var(--cat-glow);
  }

  &:not(.is-selected) {
    opacity: 0.55;
  }
}

.cat-row__stripe {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--cat-grad);
  box-shadow: 0 0 12px var(--cat-glow);
}

/* ✅ ЧЕКБОКС */
.cat-check {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s cubic-bezier(.34,1.56,.64,1);

  &.is-checked {
    background: var(--cat-grad);
    border-color: transparent;
    color: #ffffff;
    box-shadow: 0 2px 8px -2px var(--cat-glow);
    transform: scale(1.05);
  }
}

.cat-row__icon {
  font-size: 22px;
  line-height: 1;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--cat-grad);
  box-shadow: 0 4px 12px -2px var(--cat-glow);
  flex-shrink: 0;
}

.cat-row__main { flex: 1; min-width: 0; }

.cat-row__top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}

.cat-row__name {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-row__amount {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.cat-row__bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cat-row__bar {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.cat-row__bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--cat-grad);
  box-shadow: 0 0 10px var(--cat-glow);
  transition: width 0.6s cubic-bezier(.4,0,.2,1);
}

.cat-row__percent {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  opacity: 0.75;
  min-width: 32px;
  text-align: right;
}

/* ✅ ИТОГ */
.cat-total {
  position: relative;
  z-index: 2;
  margin-top: 14px;
  padding: 12px 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(250, 204, 21, 0.12), rgba(250, 204, 21, 0.04));
  border: 1px solid rgba(250, 204, 21, 0.3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.cat-total__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

.cat-total__value {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.cat-total__sum {
  font-family: var(--mono);
  font-size: 22px;
  font-weight: 300;
  color: #facc15;
  text-shadow: 0 0 16px rgba(250, 204, 21, 0.4);
}

.cat-total__of {
  font-size: 11px;
  opacity: 0.6;
  font-weight: 600;
}

@media (max-width: 700px) {
  .cat-head { flex-direction: column; align-items: flex-start; }
  .cat-head__actions { align-self: stretch; }
  .cat-btn { flex: 1; }
  .cat-row { padding: 8px 10px 8px 14px; gap: 10px; }
  .cat-row__icon { width: 32px; height: 32px; font-size: 18px; }
  .cat-row__name { font-size: 12px; }
  .cat-row__amount { font-size: 12px; }
  .cat-check { width: 20px; height: 20px; }
  .cat-total { padding: 10px 12px; }
  .cat-total__sum { font-size: 18px; }
}
</style>