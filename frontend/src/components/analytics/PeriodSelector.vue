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
  background: var(--grad-card);
  border: 1px solid var(--border);
  border-radius: 12px;

  box-shadow: var(--shadow-sm);

  transition: background 0.3s ease, border-color 0.3s ease;

  button {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--panel-2);
    color: var(--muted);
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.18s cubic-bezier(.34,1.56,.64,1);
    white-space: nowrap;

    &:hover {
      border-color: var(--accent);
      color: var(--accent);
      transform: translateY(-1px);
    }

    &:active { transform: scale(0.97); }

    &.active {
      background: var(--grad-primary);
      color: #fff;
      border-color: transparent;
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.3) inset,
        0 -2px 0 rgba(0, 0, 0, 0.15) inset,
        0 6px 16px -4px rgba(139, 92, 246, 0.6);
    }
  }
}

:global(:root[data-app-theme="dark"]) {
  .period-selector {
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.35),
      0 8px 20px -6px rgba(139, 92, 246, 0.2);
  }

  .period-selector button.active {
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.25) inset,
      0 -2px 0 rgba(0, 0, 0, 0.25) inset,
      0 6px 20px -4px rgba(168, 85, 247, 0.7),
      0 0 0 1px rgba(168, 85, 247, 0.4);
  }
}

@media (max-width: 700px) {
  .period-selector {
    padding: 5px 6px;
    gap: 3px;

    button {
      flex: 1;
      padding: 6px 4px;
      font-size: 11px;
      text-align: center;
      min-width: 0;
    }
  }
}
</style>