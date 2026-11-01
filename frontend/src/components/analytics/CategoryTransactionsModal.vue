<script setup>
import { computed } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { fmt, fmtDateLong } from '@/composables/useFormat';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  category: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);

const accounts = useAccountsStore();
const txStore = useTransactionsStore();

const monthLabel = computed(() => {
  const m = txStore.currentMonth;
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  return `${months[m.getMonth()]} ${m.getFullYear()}`;
});

// ✅ Фильтруем операции за текущий месяц по выбранной категории
const categoryTxs = computed(() => {
  if (!props.category) return [];
  
  const m = txStore.currentMonth;
  const start = new Date(m.getFullYear(), m.getMonth(), 1);
  const end = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59, 999);

  return (accounts.transactions || []).filter(t => {
    if (t.type !== 'expense') return false;
    if (t.fromReconcile) return false;
    if (t.category !== props.category) return false;
    const d = new Date(t.date);
    return d >= start && d <= end;
  }).sort((a, b) => new Date(b.date) - new Date(a.date)); // Сначала новые
});

const totalAmount = computed(() => 
  categoryTxs.value.reduce((s, t) => s + (Number(t.amount) || 0), 0)
);

const groupedByDay = computed(() => {
  const groups = {};
  for (const t of categoryTxs.value) {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!groups[key]) {
      groups[key] = { date: d, items: [] };
    }
    groups[key].items.push(t);
  }
  return Object.values(groups).sort((a, b) => b.date - a.date);
});
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="`📁 ${category}`"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="cat-modal">
      <div class="cat-modal__head">
        <span class="cat-modal__month">{{ monthLabel }}</span>
        <span class="cat-modal__total">{{ fmt(totalAmount) }} ₽</span>
      </div>

      <div v-if="groupedByDay.length === 0" class="cat-modal__empty">
        Нет операций по этой категории
      </div>

      <div v-else class="cat-modal__list">
        <div v-for="group in groupedByDay" :key="group.date.toISOString()" class="cat-modal__day">
          <div class="cat-modal__day-title">{{ fmtDateLong(group.date) }}</div>
          <div class="cat-modal__items">
            <div v-for="t in group.items" :key="t.id" class="cat-modal__item">
              <div class="cat-modal__item-name">{{ t.name }}</div>
              <div class="cat-modal__item-amount">−{{ fmt(t.amount) }} ₽</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped lang="scss">
.cat-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cat-modal__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--border);
}

.cat-modal__month {
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.cat-modal__total {
  font-family: var(--mono);
  font-size: 20px;
  font-weight: 800;
  color: var(--danger);
}

.cat-modal__empty {
  text-align: center;
  padding: 30px 10px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}

.cat-modal__list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 50vh;
  overflow-y: auto;
  padding-right: 4px;
}

.cat-modal__day-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.cat-modal__items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cat-modal__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--panel-2);
  border: 1px solid var(--border);
}

.cat-modal__item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-modal__item-amount {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 800;
  color: var(--danger);
  white-space: nowrap;
}

@media (max-width: 700px) {
  .cat-modal__total { font-size: 18px; }
  .cat-modal__list { max-height: 55vh; }
  .cat-modal__item { padding: 8px 10px; }
  .cat-modal__item-name { font-size: 12px; }
  .cat-modal__item-amount { font-size: 12px; }
}
</style>