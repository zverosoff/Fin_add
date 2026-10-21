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
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-md);
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

  &.positive { color: #16a34a; }
  &.negative { color: #dc2626; }
}

.compare-delta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 700;
  margin-top: 4px;

  &.up   { color: #dc2626; }
  &.down { color: #16a34a; }
  &.flat { color: var(--muted); }
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .compare-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .compare-item {
    padding: 10px 10px;
    border-radius: 12px;
  }

  .compare-label {
    font-size: 9px;
  }

  .compare-value {
    font-size: 13px;
  }

  .compare-delta {
    font-size: 10px;
    margin-top: 2px;
  }
}

@media (max-width: 380px) {
  .compare-value {
    font-size: 12px;
  }
  .compare-delta {
    font-size: 9px;
  }
}
</style>