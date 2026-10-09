<script setup>
import { computed } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics';
import { fmt } from '@/composables/useFormat';

const analytics = useAnalyticsStore();

function computeDelta(curr, prev) {
  if (prev === 0) return { text: '— нет данных', cls: 'flat' };
  const diff = curr - prev;
  const pct = (diff / Math.abs(prev)) * 100;
  const sign = diff > 0 ? '+' : '';
  const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
  return {
    text: `${arrow} ${sign}${pct.toFixed(0)}%`,
    cls: Math.abs(diff) < 1 ? 'flat' : (diff > 0 ? 'up' : 'down'),
  };
}

const incomeDelta = computed(() =>
  computeDelta(analytics.comparison.curr.income, analytics.comparison.prev.income)
);

const expenseDelta = computed(() =>
  computeDelta(analytics.comparison.curr.expense, analytics.comparison.prev.expense)
);

const balanceDelta = computed(() => {
  const curr = analytics.comparison.curr.income - analytics.comparison.curr.expense;
  const prev = analytics.comparison.prev.income - analytics.comparison.prev.expense;
  return computeDelta(curr, prev);
});

const currBalance = computed(() =>
  analytics.comparison.curr.income - analytics.comparison.curr.expense
);
</script>

<template>
  <div class="compare-grid">
    <div class="compare-item">
      <div class="compare-label">Расходы</div>
      <div class="compare-value">{{ fmt(analytics.comparison.curr.expense) }} ₽</div>
      <div class="compare-delta" :class="expenseDelta.cls">{{ expenseDelta.text }}</div>
    </div>

    <div class="compare-item">
      <div class="compare-label">Доходы</div>
      <div class="compare-value">{{ fmt(analytics.comparison.curr.income) }} ₽</div>
      <div class="compare-delta" :class="incomeDelta.cls">{{ incomeDelta.text }}</div>
    </div>

    <div class="compare-item">
      <div class="compare-label">Баланс</div>
      <div class="compare-value" :class="currBalance >= 0 ? 'positive' : 'negative'">
        {{ fmt(currBalance) }} ₽
      </div>
      <div class="compare-delta" :class="balanceDelta.cls">{{ balanceDelta.text }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.compare-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.compare-item {
  padding: 12px 16px;
  background: var(--grad-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-md);
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.compare-label {
  font-size: 10px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.compare-value {
  font-family: var(--mono);
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.02em;
  line-height: 1.2;
  margin-top: 2px;

  &.positive { color: var(--accent-2, #16a34a); }
  &.negative { color: var(--danger, #dc2626); }
}

.compare-delta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 700;
  margin-top: 4px;

  &.up   { color: var(--danger, #dc2626); }
  &.down { color: var(--accent-2, #16a34a); }
  &.flat { color: var(--muted); }
}

:global(:root[data-app-theme="dark"]) {
  .compare-item {
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.35),
      0 12px 28px -8px rgba(139, 92, 246, 0.15),
      0 0 0 1px rgba(139, 92, 246, 0.06) inset;
  }

  .compare-value.positive {
    color: #4ade80;
    text-shadow: 0 0 10px rgba(74, 222, 128, 0.4);
  }
  .compare-value.negative {
    color: #f43f5e;
    text-shadow: 0 0 10px rgba(244, 63, 94, 0.4);
  }

  .compare-delta.up {
    color: #f43f5e;
    text-shadow: 0 0 8px rgba(244, 63, 94, 0.4);
  }
  .compare-delta.down {
    color: #4ade80;
    text-shadow: 0 0 8px rgba(74, 222, 128, 0.4);
  }
}

@media (max-width: 700px) {
  .compare-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .compare-item { padding: 10px 10px; border-radius: 12px; }
  .compare-label { font-size: 9px; }
  .compare-value { font-size: 13px; }
  .compare-delta { font-size: 10px; margin-top: 2px; }
}

@media (max-width: 380px) {
  .compare-value { font-size: 12px; }
  .compare-delta { font-size: 9px; }
}
</style>