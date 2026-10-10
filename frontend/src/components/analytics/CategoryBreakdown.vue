<!-- frontend/src/components/analytics/CategoryBreakdown.vue -->
<script setup>
import { computed } from 'vue';
import { fmt } from '@/composables/useFormat';

const props = defineProps({
  items: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
});

const palette = [
  { grad: 'linear-gradient(135deg, #a855f7, #ec4899)', glow: 'rgba(168,85,247,0.5)' },
  { grad: 'linear-gradient(135deg, #06b6d4, #3b82f6)', glow: 'rgba(6,182,212,0.5)' },
  { grad: 'linear-gradient(135deg, #f59e0b, #facc15)', glow: 'rgba(245,158,11,0.5)' },
  { grad: 'linear-gradient(135deg, #10b981, #22c55e)', glow: 'rgba(16,185,129,0.5)' },
  { grad: 'linear-gradient(135deg, #f43f5e, #ef4444)', glow: 'rgba(244,63,94,0.5)' },
  { grad: 'linear-gradient(135deg, #8b5cf6, #6366f1)', glow: 'rgba(139,92,246,0.5)' },
];

const enriched = computed(() => {
  if (!props.items.length) return [];
  const maxPercent = Math.max(...props.items.map(i => i.percent || 0), 1);
  return props.items.map((item, idx) => {
    const p = palette[idx % palette.length];
    return {
      ...item,
      _grad: item.color || p.grad,
      _glow: p.glow,
      _barWidth: ((item.percent || 0) / maxPercent) * 100,
    };
  });
});

const hasItems = computed(() => enriched.value.length > 0);
</script>

<template>
  <section class="cat-breakdown">
    <div class="cat-breakdown__head">
      <span class="cat-breakdown__icon">📊</span>
      <span class="cat-breakdown__title">Расходы по категориям</span>
    </div>

    <div v-if="!hasItems" class="cat-breakdown__empty">
      Нет данных за этот период
    </div>

    <ul v-else class="cat-breakdown__list">
      <li
        v-for="item in enriched"
        :key="item.category"
        class="cat-row"
        :style="{ '--cat-grad': item._grad, '--cat-glow': item._glow }"
      >
        <div class="cat-row__stripe" aria-hidden="true"></div>

        <div class="cat-row__icon">
          {{ item.emoji || '💳' }}
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
                :style="{ width: item._barWidth + '%' }"
              ></div>
            </div>
            <span class="cat-row__percent">{{ (item.percent || 0).toFixed(0) }}%</span>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.cat-breakdown {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  border-radius: 20px;
  padding: 20px;
  color: #ffffff;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 12px 32px -10px rgba(139, 92, 246, 0.35);
}

.cat-breakdown__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.cat-breakdown__icon { font-size: 18px; }

.cat-breakdown__title {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cat-breakdown__empty {
  text-align: center;
  padding: 24px 0;
  font-size: 13px;
  opacity: 0.6;
}

.cat-breakdown__list {
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

  background: rgba(255, 255, 255, 0.04);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  transition: transform 0.15s, background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateX(2px);
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

@media (max-width: 700px) {
  .cat-breakdown { padding: 16px; border-radius: 16px; }
  .cat-row { padding: 8px 10px 8px 14px; gap: 10px; }
  .cat-row__icon { width: 32px; height: 32px; font-size: 18px; }
  .cat-row__name { font-size: 12px; }
  .cat-row__amount { font-size: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .cat-row { transition: none; }
  .cat-row:hover { transform: none; }
  .cat-row__bar-fill { transition: none; }
}
</style>