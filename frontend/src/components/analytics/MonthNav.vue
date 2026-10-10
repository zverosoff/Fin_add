<!-- frontend/src/components/analytics/MonthNav.vue -->
<script setup>
import { computed } from 'vue';
import { useTransactionsStore } from '@/stores/transactions';
import { fmtMonth } from '@/composables/useFormat';

const txStore = useTransactionsStore();

const monthLabel = computed(() => fmtMonth(txStore.currentMonth));

function prev() { txStore.prevMonth(); }
function next() { txStore.nextMonth(); }
function goToday() { txStore.goToday(); }
</script>

<template>
  <div class="month-nav">
    <button class="mn-btn" type="button" @click="prev" aria-label="Предыдущий месяц">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
        <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <button class="mn-label" type="button" @click="goToday">
      {{ monthLabel }}
    </button>

    <button class="mn-btn" type="button" @click="next" aria-label="Следующий месяц">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
        <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
.month-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border-radius: 999px;
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 12px 32px -10px rgba(139, 92, 246, 0.35);
}

.mn-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, transform 0.15s;

  &:hover { background: rgba(255, 255, 255, 0.12); }
  &:active { transform: scale(0.94); }
}

.mn-label {
  flex: 1;
  padding: 8px 12px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: #ffffff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  text-align: center;
  letter-spacing: 0.02em;
  transition: background 0.15s;

  &:hover { background: rgba(255, 255, 255, 0.06); }
  &:active { transform: scale(0.98); }
}

@media (max-width: 700px) {
  .month-nav { padding: 4px; gap: 4px; }
  .mn-btn { width: 32px; height: 32px; }
  .mn-label { font-size: 12px; padding: 7px 10px; }
}
</style>