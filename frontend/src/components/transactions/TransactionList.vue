<script setup>
import { ref } from 'vue';
import { useTransactionsStore } from '@/stores/transactions';
import { useFiltersStore } from '@/stores/filters';
import { useToast } from '@/composables/useToast';
import { fmtDateLong, isToday, fmt } from '@/composables/useFormat';
import TransactionItem from './TransactionItem.vue';
import EditModal from './EditModal.vue';

const tx = useTransactionsStore();
const filters = useFiltersStore();
const toast = useToast();

// ============================================================
// Редактирование
// ============================================================
const editOpen = ref(false);
const editTx = ref(null);

function onEdit(t) {
  editTx.value = t;
  editOpen.value = true;
}

// ============================================================
// Удаление с Undo
// ============================================================
async function onDelete(t) {
  if (!confirm(`Удалить операцию "${t.name}" на ${fmt(t.amount)} ₽?`)) return;

  const snapshot = JSON.parse(JSON.stringify(t));

  try {
    await tx.remove(t.id);
    toast.success('🗑 Операция удалена', {
      duration: 6000,
      action: {
        label: 'Вернуть',
        onClick: () => restoreFromSnapshot(snapshot),
      },
    });
  } catch (e) {
    toast.error('Ошибка удаления: ' + (e.response?.data?.error || e.message));
  }
}

async function restoreFromSnapshot(snapshot) {
  try {
    await tx.restore(snapshot);
    toast.success('↩️ Операция восстановлена');
  } catch (e) {
    toast.error('Не удалось восстановить: ' + e.message);
  }
}
</script>

<template>
  <div class="tx-list">
    <!-- Плашка активных фильтров -->
    <div v-if="filters.hasActive" class="tx-filters-bar">
      <span class="bar-label">🎯 Фильтр:</span>
      <span
        v-for="f in filters.activeList"
        :key="f.key"
        class="tx-filter-chip"
        @click="filters.set(f.key, 'all')"
      >
        {{ f.label }}
        <span class="close">✕</span>
      </span>
      <button class="tx-filter-reset" @click="filters.reset()">Сбросить</button>
    </div>

    <!-- Пусто -->
    <div v-if="tx.groupedByDay.length === 0" class="tx-empty">
      <div class="empty-icon">📭</div>
      <div class="empty-title">
        {{ filters.hasActive ? 'Ничего не найдено по фильтрам' : 'Пока нет операций' }}
      </div>
      <div class="empty-sub">
        {{ filters.hasActive ? 'Попробуйте снять фильтры' : 'Добавьте первую операцию кнопкой «+»' }}
      </div>
    </div>

    <!-- Группы по дням -->
    <template v-else>
      <template v-for="group in tx.groupedByDay" :key="group.key">
        <div class="tx-day-header">
          <span class="day-date" :class="{ today: isToday(group.date) }">
            {{ fmtDateLong(group.date) }}
          </span>
          <span class="day-sum" :class="group.sum > 0 ? 'positive' : group.sum < 0 ? 'negative' : ''">
            {{ group.sum >= 0 ? '+' : '−' }}{{ fmt(Math.abs(group.sum)) }} ₽
          </span>
        </div>

        <TransactionItem
          v-for="t in group.items"
          :key="t.id"
          :tx="t"
          @edit="onEdit"
          @delete="onDelete"
        />
      </template>
    </template>

    <!-- Модалка редактирования -->
    <EditModal v-model="editOpen" :tx="editTx" />
  </div>
</template>

<style scoped lang="scss">
/* Те же стили, что были */
.tx-list { display: flex; flex-direction: column; gap: 8px; }

.tx-filters-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 12px;
  font-size: 12px;
  margin-bottom: 4px;

  .bar-label {
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.06em;
  }
}

.tx-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: var(--accent);
  font-weight: 700;
  cursor: pointer;

  &:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.5);
    color: var(--danger);
  }

  .close { font-size: 13px; }
}

.tx-filter-reset {
  margin-left: auto;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;

  &:hover { border-color: var(--danger); color: var(--danger); }
}

.tx-empty {
  text-align: center;
  padding: 60px 24px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px dashed var(--border-strong);
  border-radius: 16px;

  .empty-icon { font-size: 48px; opacity: 0.6; }
  .empty-title { font-size: 17px; font-weight: 700; margin-top: 12px; }
  .empty-sub { font-size: 13px; color: var(--muted); margin-top: 6px; }
}

.tx-day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 8px 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;

  .day-date.today {
    color: #22c55e;
    &::before {
      content: "";
      display: inline-block;
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #22c55e;
      margin-right: 6px;
    }
  }

  .day-sum {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 800;
    &.positive { color: #22c55e; }
    &.negative { color: #ef4444; }
  }
}
</style>