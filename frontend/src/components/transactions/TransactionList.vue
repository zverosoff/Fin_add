<script setup>
import { ref } from 'vue';
import { useTransactionsStore } from '@/stores/transactions';
import { useFiltersStore } from '@/stores/filters';
import { useToast } from '@/composables/useToast';
import { fmtDateLong, isToday, fmt } from '@/composables/useFormat';
import TransactionItem from './TransactionItem.vue';
import EditModal from './EditModal.vue';
import SearchBar from '@/components/filters/SearchBar.vue';
import QuickChips from '@/components/filters/QuickChips.vue';
import FiltersBar from '@/components/filters/FiltersBar.vue';
import FiltersModal from '@/components/filters/FiltersModal.vue';

const tx = useTransactionsStore();
const filters = useFiltersStore();
const toast = useToast();

const editOpen = ref(false);
const editTx = ref(null);
const filtersModalOpen = ref(false);

function onEdit(t) {
  editTx.value = t;
  editOpen.value = true;
}

async function onDelete(t) {
  if (!confirm(`Удалить операцию "${t.name}" на ${fmt(t.amount)} ₽?`)) return;

  const snapshot = JSON.parse(JSON.stringify(t));
  try {
    await tx.remove(t.id);
    toast.success('🗑 Операция удалена', {
      duration: 6000,
      action: { label: 'Вернуть', onClick: () => restoreFromSnapshot(snapshot) },
    });
  } catch (e) {
    toast.error('Ошибка удаления: ' + (e.response?.data?.error || e.message));
  }
}

async function restoreFromSnapshot(snapshot) {
  try {
    await tx.save(snapshot);
    toast.success('↩️ Операция восстановлена');
  } catch (e) {
    toast.error('Не удалось восстановить: ' + e.message);
  }
}
</script>

<template>
  <div class="tx-list">
    <!-- Поиск + фильтры -->
    <div class="tx-toolbar">
      <SearchBar />
      <button
        class="tx-filters-btn"
        :class="{ active: filters.hasActive }"
        type="button"
        @click="filtersModalOpen = true"
        title="Расширенные фильтры"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M3 5h18v2H3V5zm3 6h12v2H6v-2zm3 6h6v2H9v-2z"/>
        </svg>
        <span>Фильтры</span>
        <span v-if="filters.hasActive" class="badge">{{ filters.activeList.length }}</span>
      </button>
    </div>

    <!-- Быстрые чипы -->
    <QuickChips />

    <!-- Плашка активных фильтров -->
    <FiltersBar />

    <!-- Пусто -->
    <div v-if="tx.groupedByDay.length === 0" class="tx-empty">
      <div class="empty-icon">📭</div>
      <div class="empty-title">
        {{ filters.hasActive ? 'Ничего не найдено' : 'Пока нет операций' }}
      </div>
      <div class="empty-sub">
        {{ filters.hasActive ? 'Попробуйте снять фильтры' : 'Добавьте первую операцию кнопкой «+»' }}
      </div>
      <button v-if="filters.hasActive" class="empty-reset" @click="filters.reset()">
        Сбросить фильтры
      </button>
    </div>

    <!-- Группы по дням -->
    <template v-else>
      <template v-for="group in tx.groupedByDay" :key="group.key">
        <div class="tx-day-header">
          <span class="day-date" :class="{ today: isToday(group.date) }">
            {{ fmtDateLong(group.date) }}
          </span>
          <span
            class="day-sum"
            :class="group.sum > 0 ? 'positive' : group.sum < 0 ? 'negative' : ''"
          >
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

    <!-- Модалки -->
    <EditModal v-model="editOpen" :tx="editTx" />
    <FiltersModal v-model="filtersModalOpen" />
  </div>
</template>

<style scoped lang="scss">
.tx-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tx-toolbar {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.tx-filters-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.9);
  color: var(--muted);
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;

  svg {
    flex-shrink: 0;
  }

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: rgba(56, 189, 248, 0.06);
  }

  &.active {
    border-color: var(--accent);
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: #fff;
    box-shadow: 0 6px 16px -8px rgba(59, 130, 246, 0.7);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    background: #fff;
    color: #3b82f6;
    font-size: 10px;
    font-weight: 800;
  }
}

.tx-empty {
  text-align: center;
  padding: 60px 24px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px dashed var(--border-strong);
  border-radius: 16px;

  .empty-icon { font-size: 48px; opacity: 0.6; }
  .empty-title {
    font-size: 17px;
    font-weight: 700;
    margin-top: 12px;
    color: var(--text);
  }
  .empty-sub {
    font-size: 13px;
    color: var(--muted);
    margin-top: 6px;
  }
}

.empty-reset {
  margin-top: 16px;
  padding: 8px 18px;
  border-radius: 10px;
  border: 1px solid var(--accent);
  background: rgba(56, 189, 248, 0.1);
  color: var(--accent);
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--accent);
    color: #fff;
  }
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

  .day-date {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    &.today {
      color: #22c55e;

      &::before {
        content: "";
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #22c55e;
      }
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

@media (max-width: 700px) {
  .tx-toolbar {
    flex-direction: column;
  }

  .tx-filters-btn {
    justify-content: center;
    padding: 10px 14px;
  }
}
</style>