<!-- frontend/src/components/analytics/ComparisonCard.vue -->
<script setup>
import { computed } from 'vue';
import { fmt } from '@/composables/useFormat';

const props = defineProps({
  current: { type: Object, default: () => ({ income: 0, expense: 0, balance: 0 }) },
  previous: { type: Object, default: () => ({ income: 0, expense: 0, balance: 0 }) },
});

function diffPercent(cur, prev) {
  if (!prev) return cur > 0 ? 100 : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

const items = computed(() => {
  const c = props.current;
  const p = props.previous;
  return [
    {
      key: 'expense', label: 'Расходы', emoji: '📉',
      current: c.expense, prev: p.expense,
      diff: diffPercent(c.expense, p.expense),
      invert: true,
    },
    {
      key: 'income', label: 'Доходы', emoji: '📈',
      current: c.income, prev: p.income,
      diff: diffPercent(c.income, p.income),
      invert: false,
    },
    {
      key: 'balance', label: 'Баланс', emoji: '⚖️',
      current: c.balance, prev: p.balance,
      diff: diffPercent(c.balance, p.balance),
      invert: false,
    },
  ];
});

function isPositive(item) {
  if (item.diff === 0) return null;
  return item.invert ? item.diff < 0 : item.diff > 0;
}
</script>

<template>
  <section class="cmp">
    <div class="cmp__head">
      <span class="cmp__head-icon">🔀</span>
      <span class="cmp__head-title">Сравнение с прошлым</span>
    </div>

    <div class="cmp__grid">
      <div
        v-for="item in items"
        :key="item.key"
        class="cmp-tile"
        :class="{
          'is-good': isPositive(item) === true,
          'is-bad': isPositive(item) === false,
        }"
      >
        <div class="cmp-tile__label">
          <span>{{ item.emoji }}</span>
          <span>{{ item.label }}</span>
        </div>

        <div class="cmp-tile__value">{{ fmt(item.current) }} ₽</div>

        <div class="cmp-tile__diff">
          <span class="cmp-tile__arrow">
            {{ item.diff > 0 ? '↑' : item.diff < 0 ? '↓' : '→' }}
          </span>
          <span>{{ Math.abs(item.diff).toFixed(1) }}%</span>
          <span class="cmp-tile__prev">vs {{ fmt(item.prev) }} ₽</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.cmp {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  border-radius: 20px;
  padding: 20px;
  color: #ffffff;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 12px 32px -10px rgba(139, 92, 246, 0.35);
}

.cmp__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.cmp__head-icon { font-size: 18px; }

.cmp__head-title {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cmp__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.cmp-tile {
  position: relative;
  border-radius: 14px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  transition: background 0.2s, transform 0.15s;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 3px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.2);
    transition: background 0.2s, box-shadow 0.2s;
  }

  &.is-good::before {
    background: #4ade80;
    box-shadow: 0 0 10px rgba(74, 222, 128, 0.7);
  }
  &.is-bad::before {
    background: #f87171;
    box-shadow: 0 0 10px rgba(248, 113, 113, 0.7);
  }

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
  }
}

.cmp-tile__label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.85;
  margin-bottom: 8px;
}

.cmp-tile__value {
  font-family: var(--mono);
  font-size: 18px;
  font-weight: 300;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin-bottom: 6px;
}

.cmp-tile__diff {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  flex-wrap: wrap;
}

.cmp-tile__arrow { font-size: 13px; }

.cmp-tile.is-good .cmp-tile__diff { color: #4ade80; }
.cmp-tile.is-bad  .cmp-tile__diff { color: #f87171; }

.cmp-tile__prev {
  opacity: 0.5;
  font-weight: 500;
  font-size: 10px;
}

@media (max-width: 700px) {
  .cmp { padding: 16px; border-radius: 16px; }
  .cmp__grid { gap: 8px; }
  .cmp-tile { padding: 10px; border-radius: 12px; }
  .cmp-tile__value { font-size: 14px; }
  .cmp-tile__label { font-size: 10px; }
  .cmp-tile__prev { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .cmp-tile { transition: none; }
  .cmp-tile:hover { transform: none; }
}
</style>