<script setup>
import { computed } from 'vue';
import { useTransactionsStore } from '@/stores/transactions';
import { fmtMonth } from '@/composables/useFormat';

const tx = useTransactionsStore();

const label = computed(() => fmtMonth(tx.currentMonth));

const isCurrentMonth = computed(() => {
  const now = new Date();
  const cur = tx.currentMonth;
  return now.getMonth() === cur.getMonth() && now.getFullYear() === cur.getFullYear();
});
</script>

<template>
  <div class="month-nav">
    <button @click="tx.prevMonth()" aria-label="Предыдущий месяц">◀</button>

    <div class="month-label">
      <span>{{ label }}</span>
      <small v-if="isCurrentMonth" class="today-mark">сегодня</small>
    </div>

    <button @click="tx.nextMonth()" aria-label="Следующий месяц">▶</button>

    <button class="today-btn" @click="tx.goToday()">Сегодня</button>
  </div>
</template>

<style scoped lang="scss">
.month-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.05), transparent 60%), rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 8px 12px;
  box-shadow: var(--shadow-md);

  button {
    background: #f1f5f9;
    border: 1px solid var(--border);
    border-radius: 10px;
    width: 36px;
    height: 36px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
    transition: all 0.15s;

    &:hover {
      background: rgba(56, 189, 248, 0.15);
      border-color: var(--accent);
      color: var(--accent);
    }
    &:active { transform: scale(0.94); }
  }
}

.month-label {
  flex: 1;
  text-align: center;
  font-size: 15px;
  font-weight: 700;

  .today-mark {
    display: inline-block;
    margin-left: 8px;
    padding: 1px 8px;
    font-size: 10px;
    font-weight: 700;
    border-radius: 999px;
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.35);
    vertical-align: middle;
  }
}

.today-btn {
  width: auto !important;
  padding: 0 14px !important;
  font-size: 12px !important;
}
</style>