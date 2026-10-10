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

const selected = ref(new Set());
const initialized = ref(false);

const palette = [
  { grad: 'linear-gradient(135deg, #a855f7, #ec4899)', glow: 'rgba(168,85,247,0.5)' },
  { grad: 'linear-gradient(135deg, #06b6d4, #3b82f6)', glow: 'rgba(6,182,212,0.5)' },
  { grad: 'linear-gradient(135deg, #f59e0b, #facc15)', glow: 'rgba(245,158,11,0.5)' },
  { grad: 'linear-gradient(135deg, #10b981, #22c55e)', glow: 'rgba(16,185,129,0.5)' },
  { grad: 'linear-gradient(135deg, #f43f5e, #ef4444)', glow: 'rgba(244,63,94,0.5)' },
  { grad: 'linear-gradient(135deg, #8b5cf6, #6366f1)', glow: 'rgba(139,92,246,0.5)' },
];

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

watch(items, (newItems) => {
  if (!initialized.value && newItems.length > 0) {
    selected.value = new Set(newItems.map(i => i.category));
    initialized.value = true;
  }
}, { immediate: true });

watch(() => txStore.currentMonth, () => {
  initialized.value = false;
  selected.value = new Set();
});

function toggleItem(category) {
  const next = new Set(selected.value);
  if (next.has(category)) next.delete(category);
  else next.add(category);
  selected.value = next;
}

function selectAll() {
  selected.value = new Set(items.value.map(i => i.category));
  initialized.value = true;
}

function clearAll() {
  selected.value = new Set();
  initialized.value = true;
}

const selectedTotal = computed(() =>
  items.value
    .filter(i => selected.value.has(i.category))
    .reduce((s, i) => s + i.amount, 0)
);

const allTotal = computed(() =>
  items.value.reduce((s, i) => s + i.amount, 0)
);

const hasItems = computed(() => items.value.length > 0);

const monthLabel = computed(() => {
  const m = txStore.currentMonth;
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  return `${months[m.getMonth()]} ${m.getFullYear()}`;
});
</script>

<template>
  <section class="cat-breakdown">
    <!-- ✅ 1. Диагональные полосы (через ::before) -->
    <!-- ✅ 2. Мелкая косая клетка (через ::after) -->

    <!-- ✅ 3. Верхний глянец -->
    <div class="cat-gloss" aria-hidden="true"></div>

    <!-- ✅ 4. Пунктирная кромка -->
    <div class="cat-frame" aria-hidden="true"></div>

    <!-- Отблеск -->
    <div class="cat-glare" aria-hidden="true"></div>

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

    <div v-if="!hasItems" class="cat-empty">
      <div class="cat-empty__mascot">
        <img
          src="/img/mascots/sad-coin.png"
          alt="Грустная монета"
          class="cat-empty__img"
          loading="lazy"
        />
      </div>
      <div class="cat-empty__title">Нет расходов за этот месяц</div>
      <div class="cat-empty__sub">Выбери другой месяц или добавь операцию</div>
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

        <div class="cat-check" :class="{ 'is-checked': item._selected }">
          <svg v-if="item._selected" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12">
            <polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <div class="cat-row__icon">{{ item.emoji }}</div>

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
  min-height: 200px;
  border-radius: 14px;
  overflow: hidden;
}

/* ✅ 1. ДИАГОНАЛЬНЫЕ ПОЛОСЫ 35° */
.cat-breakdown::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: repeating-linear-gradient(
    -35deg,
    rgba(255, 255, 255, 0) 0px,
    rgba(255, 255, 255, 0) 12px,
    rgba(255, 255, 255, 0.06) 12px,
    rgba(255, 255, 255, 0.06) 14px
  );
  opacity: 0.85;
}

/* ✅ 2. МЕЛКАЯ КОСАЯ КЛЕТКА 45° */
.cat-breakdown::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.025) 0 2px,
    transparent 2px 8px
  );
}

/* ✅ 3. ВЕРХНИЙ ГЛЯНЕЦ */
.cat-gloss {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background: radial-gradient(
    ellipse 60% 40% at 20% 10%,
    rgba(255, 255, 255, 0.15),
    transparent 60%
  );
  mix-blend-mode: overlay;
}

/* ✅ 4. ПУНКТИРНАЯ РАМКА */
.cat-frame {
  position: absolute;
  inset: 6px;
  border-radius: 10px;
  border: 1.5px dashed rgba(255, 255, 255, 0.15);
  pointer-events: none;
  z-index: 2;
}

/* Отблеск — уже был */
.cat-glare {
  position: absolute;
  top: -50%;
  left: -100%;
  width: 60%;
  height: 200%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 45%,
    rgba(255, 255, 255, 0.2) 50%,
    rgba(255, 255, 255, 0.1) 55%,
    transparent 100%
  );
  transform: rotate(25deg);
  animation: catGlareSweep 7s ease-in-out infinite;
  pointer-events: none;
  z-index: 1;
}

@keyframes catGlareSweep {
  0%, 60% { left: -100%; opacity: 0; }
  65%     { opacity: 1; }
  100%    { left: 200%; opacity: 0; }
}

.cat-head {
  position: relative;
  z-index: 3;
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

.cat-empty {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px 16px;
  text-align: center;
  min-height: 220px;
}

.cat-empty__mascot {
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cat-empty__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.45));
  opacity: 0.9;
}

.cat-empty__title {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.9);
}

.cat-empty__sub {
  font-size: 12px;
  opacity: 0.6;
  font-weight: 600;
}

.cat-breakdown__list {
  position: relative;
  z-index: 3;
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

.cat-total {
  position: relative;
  z-index: 3;
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
  .cat-empty__mascot { width: 130px; height: 130px; }
  .cat-frame { inset: 4px; border-radius: 8px; }
}
</style>