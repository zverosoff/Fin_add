<script setup>
import { ref, computed } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useCategoriesStore } from '@/stores/categories';
import { fmt } from '@/composables/useFormat';

const accounts = useAccountsStore();
const categoriesStore = useCategoriesStore();

// Список отключённых категорий (по умолчанию — все включены)
const disabled = ref(new Set());

function isEnabled(cat) {
  return !disabled.value.has(cat);
}

function toggle(cat) {
  const next = new Set(disabled.value);
  if (next.has(cat)) next.delete(cat);
  else next.add(cat);
  disabled.value = next;
}

function enableAll() {
  disabled.value = new Set();
}

function disableAll(allCats) {
  disabled.value = new Set(allCats.map(c => c.category));
}

function onlyTop5(allCats) {
  const top5 = new Set(allCats.slice(0, 5).map(c => c.category));
  disabled.value = new Set(
    allCats.filter(c => !top5.has(c.category)).map(c => c.category)
  );
}

// Текущий месяц
const now = new Date();
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

const monthName = computed(() => {
  return ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
          'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'][now.getMonth()];
});

// Группируем все расходы за месяц по категориям
const allCategories = computed(() => {
  const map = new Map();

  for (const t of accounts.transactions || []) {
    if (t.fixed) continue;
    if (t.fromReconcile) continue;
    if (t.type !== 'expense') continue;

    const d = new Date(t.date);
    if (isNaN(d.getTime())) continue;
    if (d < monthStart || d > monthEnd) continue;

    const cat = String(t.category || 'Прочее');
    map.set(cat, (map.get(cat) || 0) + (Number(t.amount) || 0));
  }

  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
});

// Итог ТОЛЬКО выбранных категорий
const selectedTotal = computed(() => {
  let sum = 0;
  for (const c of allCategories.value) {
    if (isEnabled(c.category)) sum += c.amount;
  }
  return sum;
});

// Обработанный список с процентами
const enriched = computed(() => {
  const total = selectedTotal.value || 1;
  return allCategories.value.map(c => ({
    ...c,
    enabled: isEnabled(c.category),
    pct: c.amount / total * 100,
  }));
});

const enabledCount = computed(() =>
  allCategories.value.filter(c => isEnabled(c.category)).length
);

const allSelected = computed(() =>
  enabledCount.value === allCategories.value.length
);

const noneSelected = computed(() => enabledCount.value === 0);
</script>

<template>
  <section class="category-breakdown">
    <header class="cb-head">
      <div class="cb-head-left">
        <div class="cb-icon">📊</div>
        <div class="cb-titles">
          <div class="cb-title">Расходы по категориям</div>
          <div class="cb-sub">{{ monthName }} · {{ enabledCount }} из {{ allCategories.length }}</div>
        </div>
      </div>

      <div class="cb-total">
        <div class="cb-total-value">{{ fmt(selectedTotal) }} ₽</div>
        <div class="cb-total-label">выбрано</div>
      </div>
    </header>

    <div v-if="allCategories.length === 0" class="cb-empty">
      За этот месяц ещё нет расходов
    </div>

    <template v-else>
      <div class="cb-controls">
        <button
          class="cb-btn"
          :class="{ active: allSelected }"
          type="button"
          @click="enableAll"
        >Все</button>
        <button
          class="cb-btn"
          type="button"
          @click="onlyTop5(allCategories)"
        >Топ-5</button>
        <button
          class="cb-btn"
          :class="{ active: noneSelected }"
          type="button"
          @click="disableAll(allCategories)"
        >Ничего</button>
      </div>

      <div class="cb-list">
        <label
          v-for="c in enriched"
          :key="c.category"
          class="cb-row"
          :class="{ disabled: !c.enabled }"
        >
          <input
            type="checkbox"
            class="cb-check"
            :checked="c.enabled"
            @change="toggle(c.category)"
          />

          <span class="cb-cat-icon">{{ categoriesStore.icon(c.category) }}</span>

          <span class="cb-cat-name">{{ c.category }}</span>

          <span class="cb-cat-amount">{{ fmt(c.amount) }} ₽</span>

          <span class="cb-cat-pct">{{ c.enabled ? c.pct.toFixed(0) + '%' : '—' }}</span>

          <span class="cb-bar-track">
            <span
              class="cb-bar-fill"
              :class="{ disabled: !c.enabled }"
              :style="{ width: (c.enabled ? c.pct : 0) + '%' }"
            ></span>
          </span>
        </label>
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
.category-breakdown {
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

.cb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.cb-head-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cb-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--grad-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 -2px 0 rgba(0, 0, 0, 0.2) inset,
    0 6px 16px -6px rgba(139, 92, 246, 0.7);
}

.cb-titles { min-width: 0; }
.cb-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: 0.02em;
}
.cb-sub {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
  margin-top: 1px;
}

.cb-total {
  text-align: right;
  flex-shrink: 0;
}
.cb-total-value {
  font-family: var(--mono);
  font-size: 17px;
  font-weight: 800;
  color: var(--accent-2, #16a34a);
  letter-spacing: -0.02em;
  white-space: nowrap;
  text-shadow: 0 0 10px rgba(34, 197, 94, 0.3);
}
.cb-total-label {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 2px;
}

.cb-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 12.5px;
  color: var(--muted);
  border: 1px dashed var(--border-strong);
  border-radius: 12px;
  background: var(--panel-2);
}

.cb-controls {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.cb-btn {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(.34,1.56,.64,1);
  white-space: nowrap;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    transform: translateY(-1px);
  }

  &.active {
    background: var(--grad-primary);
    color: #fff;
    border-color: transparent;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 4px 10px -2px rgba(139, 92, 246, 0.5);
  }
}

.cb-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cb-row {
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  grid-template-areas:
    "check icon name amount pct"
    "check icon bar bar bar";
  align-items: center;
  gap: 4px 10px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease, opacity 0.2s ease, transform 0.1s;

  &:hover {
    background: var(--panel-2);
    transform: translateX(1px);
  }

  &.disabled {
    opacity: 0.45;
  }
}

.cb-check {
  grid-area: check;
  width: 18px;
  height: 18px;
  accent-color: #a855f7;
  cursor: pointer;
  flex-shrink: 0;
}

.cb-cat-icon {
  grid-area: icon;
  font-size: 18px;
  line-height: 1;
  text-align: center;
}

.cb-cat-name {
  grid-area: name;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.cb-cat-amount {
  grid-area: amount;
  font-family: var(--mono);
  font-size: 12.5px;
  font-weight: 800;
  color: var(--text);
  white-space: nowrap;
  text-align: right;
}

.cb-cat-pct {
  grid-area: pct;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 800;
  color: var(--muted);
  white-space: nowrap;
  min-width: 34px;
  text-align: right;
}

.cb-bar-track {
  grid-area: bar;
  display: block;
  height: 4px;
  border-radius: 2px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  overflow: hidden;
  margin-top: 2px;
}

.cb-bar-fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #a855f7, #ec4899);
  transition: width 0.4s cubic-bezier(.22,.61,.36,1);
  box-shadow: 0 0 8px rgba(168, 85, 247, 0.5);

  &.disabled {
    background: transparent;
    box-shadow: none;
  }
}

/* Тёмная тема */
:global(:root[data-app-theme="dark"]) {
  .category-breakdown {
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.35),
      0 12px 28px -8px rgba(139, 92, 246, 0.25),
      0 0 0 1px rgba(139, 92, 246, 0.08) inset;
  }

  .cb-total-value {
    color: #4ade80;
    text-shadow: 0 0 12px rgba(74, 222, 128, 0.5);
  }

  .cb-cat-name { color: #f4f4f6; }
  .cb-cat-amount { color: #f4f4f6; }
  .cb-cat-pct { color: #8b8ba0; }

  .cb-bar-track {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(139, 92, 246, 0.15);
  }

  .cb-bar-fill {
    background: linear-gradient(90deg, #a855f7, #ec4899);
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.6);
  }
}

@media (max-width: 700px) {
  .category-breakdown { padding: 14px; border-radius: 14px; }
  .cb-icon { width: 32px; height: 32px; font-size: 16px; }
  .cb-title { font-size: 12px; }
  .cb-sub { font-size: 10.5px; }
  .cb-total-value { font-size: 15px; }

  .cb-row {
    grid-template-columns: auto auto 1fr auto;
    grid-template-areas:
      "check icon name pct"
      "check icon amount amount"
      "check icon bar bar";
    gap: 3px 8px;
    padding: 8px 10px;
  }

  .cb-cat-amount {
    text-align: left;
    font-size: 12px;
  }
  .cb-cat-pct {
    font-size: 11px;
    min-width: 30px;
  }
  .cb-cat-name { font-size: 12.5px; }

  .cb-btn { font-size: 10.5px; padding: 4px 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .category-breakdown,
  .cb-row,
  .cb-bar-fill,
  .cb-btn {
    animation: none !important;
    transition: none !important;
  }
  .cb-row:hover { transform: none !important; }
}
</style>