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

const editOpen = ref(false);
const editTx = ref(null);

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
    <!-- Индикатор активных фильтров (компактный, если что-то выбрано) -->
    <div v-if="filters.hasActive" class="tx-active-filter">
      <span class="taf-label">🎯 Фильтр:</span>
      <span
        v-for="f in filters.activeList"
        :key="f.key"
        class="taf-chip"
        @click="f.key === 'search' ? filters.set('search', '') : filters.set(f.key, 'all')"
      >
        {{ f.label }}
        <span class="taf-close">✕</span>
      </span>
      <button class="taf-reset" @click="filters.reset()">Сбросить</button>
    </div>

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

    <!-- Список операций -->
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

    <!-- Модалка редактирования -->
    <EditModal v-model="editOpen" :tx="editTx" />
  </div>
</template>

<style scoped lang="scss">
/* ============================================================
   СПИСОК
   ============================================================ */
.tx-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ============================================================
   КОМПАКТНЫЙ ИНДИКАТОР АКТИВНОГО ФИЛЬТРА
   ============================================================ */
.tx-active-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 12px;
  font-size: 12px;
  animation: filterIn 0.2s ease;
}

@keyframes filterIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.taf-label {
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 11px;
}

.taf-chip {
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
  transition: all 0.15s;

  &:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.5);
    color: var(--danger);
  }

  .taf-close {
    font-size: 12px;
    line-height: 1;
    opacity: 0.8;
  }
}

.taf-reset {
  margin-left: auto;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--danger);
    color: var(--danger);
    background: rgba(239, 68, 68, 0.08);
  }
}

/* ============================================================
   ПУСТО
   ============================================================ */
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

/* ============================================================
   ЗАГОЛОВОК ДНЯ
   ============================================================ */
.tx-day-header {
  position: sticky;
  top: 0;
  z-index: 30;

  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 4px;

  background: linear-gradient(
    180deg,
    rgba(238, 242, 248, 1) 0%,
    rgba(238, 242, 248, 0.95) 70%,
    rgba(238, 242, 248, 0) 100%
  );
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 8px 8px 0 0;

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
        box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
      }
    }
  }

  .day-sum {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: none;

    &.positive { color: #22c55e; }
    &.negative { color: #ef4444; }
  }
}

/* ============================================================
   МОБИЛЬНАЯ
   ============================================================ */
@media (max-width: 700px) {
  .tx-active-filter {
    padding: 8px 10px;
    gap: 4px;
    font-size: 11px;
  }

  .taf-label {
    font-size: 10px;
    width: 100%;
    margin-bottom: 2px;
  }

  .taf-chip {
    padding: 4px 9px;
    font-size: 11px;
  }

  .taf-reset {
    font-size: 10px;
    padding: 3px 9px;
  }

  .tx-day-header {
    padding: 8px 4px 6px;
    font-size: 11px;

    .day-sum { font-size: 11px; }
  }

  .tx-empty {
    padding: 40px 16px;
    border-radius: 14px;

    .empty-icon { font-size: 40px; }
    .empty-title { font-size: 15px; margin-top: 10px; }
    .empty-sub { font-size: 12px; }
  }
}
</style>