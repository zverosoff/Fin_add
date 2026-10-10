<!-- frontend/src/components/analytics/PeriodSelector.vue -->
<script setup>
import { computed } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics';

const analytics = useAnalyticsStore();

const periods = [
  { key: 1,   label: '1 мес',  months: 1 },
  { key: 3,   label: '3 мес',  months: 3 },
  { key: 6,   label: '6 мес',  months: 6 },
  { key: 12,  label: '12 мес', months: 12 },
  { key: 'all', label: 'Всё',  months: 'all' },
];

// ✅ Активный период из стора (periodMonths)
const active = computed(() => analytics.periodMonths);

function select(key) {
  analytics.setPeriod(key);
}
</script>

<template>
  <div class="period-selector">
    <button
      v-for="p in periods"
      :key="String(p.key)"
      type="button"
      class="period-btn"
      :class="{ 'is-active': active === p.key }"
      @click="select(p.key)"
    >
      {{ p.label }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.period-selector {
  display: flex;
  gap: 6px;
  padding: 6px;
  border-radius: 999px;
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 12px 32px -10px rgba(139, 92, 246, 0.35);
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.period-btn {
  flex: 1;
  padding: 8px 14px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s, transform 0.15s;

  &:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.06);
  }

  &:active { transform: scale(0.97); }

  &.is-active {
    background: linear-gradient(180deg, #a855f7, #7c3aed);
    color: #ffffff;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 6px 16px -4px rgba(168, 85, 247, 0.6);
  }
}

@media (max-width: 700px) {
  .period-selector { padding: 4px; gap: 4px; }
  .period-btn { padding: 7px 10px; font-size: 11.5px; }
}
</style>