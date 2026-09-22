<script setup>
import { useAnalyticsStore } from '@/stores/analytics';

const analytics = useAnalyticsStore();

const periods = [
  { value: 1, label: '1 мес' },
  { value: 3, label: '3 мес' },
  { value: 6, label: '6 мес' },
  { value: 12, label: '12 мес' },
  { value: 'all', label: 'Всё' },
];
</script>

<template>
  <div class="period-selector">
    <button
      v-for="p in periods"
      :key="p.value"
      :class="{ active: analytics.periodMonths === p.value }"
      @click="analytics.setPeriod(p.value)"
    >
      {{ p.label }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.period-selector {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 12px;

  button {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: #f8fafc;
    color: var(--muted);
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;

    &:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    &.active {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 6px 16px -8px rgba(59, 130, 246, 0.7);
    }
  }
}
</style>