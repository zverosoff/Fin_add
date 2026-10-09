<script setup>
import { ref, computed, watch } from 'vue';
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

const LS_KEY = 'financeProCollapsedDays_v3';
const collapsedDays = ref({});

try {
  const saved = localStorage.getItem(LS_KEY);
  if (saved) collapsedDays.value = JSON.parse(saved);
} catch (e) {}

watch(collapsedDays, (val) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(val)); } catch (e) {}
}, { deep: true });

const lastDayKey = computed(() =>
  tx.groupedByDay.length > 0 ? tx.groupedByDay[0].key : null
);

watch(
  () => tx.groupedByDay.map(g => g.key).join(','),
  () => {
    const newState = {};
    for (const group of tx.groupedByDay) {
      newState[group.key] = group.key !== lastDayKey.value;
    }
    collapsedDays.value = newState;
  },
  { immediate: true }
);

function toggleDay(key) {
  collapsedDays.value = {
    ...collapsedDays.value,
    [key]: !collapsedDays.value[key],
  };
}

function isDayCollapsed(key) {
  return !!collapsedDays.value[key];
}

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

    <template v-else>
      <template v-for="group in tx.groupedByDay" :key="group.key">
        <div
          class="tx-day-header"
          :class="{ collapsed: isDayCollapsed(group.key) }"
          @click="toggleDay(group.key)"
        >
          <svg class="day-chev" :class="{ open: !isDayCollapsed(group.key) }" viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z" fill="currentColor"/>
          </svg>

          <span class="day-date" :class="{ today: isToday(group.date) }">
            {{ fmtDateLong(group.date) }}
          </span>

          <span class="day-count" v-if="isDayCollapsed(group.key)">
            {{ group.items.length }} оп.
          </span>

          <span
            class="day-sum"
            :class="group.sum > 0 ? 'positive' : group.sum < 0 ? 'negative' : ''"
          >
            {{ group.sum >= 0 ? '+' : '−' }}{{ fmt(Math.abs(group.sum)) }} ₽
          </span>
        </div>

        <div v-if="!isDayCollapsed(group.key)" class="tx-day-items">
          <TransactionItem
            v-for="t in group.items"
            :key="t.id"
            :tx="t"
            @edit="onEdit"
            @delete="onDelete"
          />
        </div>
      </template>
    </template>

    <EditModal v-model="editOpen" :tx="editTx" />
  </div>
</template>

<style scoped lang="scss">
.tx-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tx-active-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 10px 14px;

  background: var(--grad-card);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  font-size: 12px;

  box-shadow: var(--shadow-md);
}

.taf-label {
  font-weight: 800;
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
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.35);
  color: var(--accent);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.1) inset;

  &:hover {
    background: rgba(244, 63, 94, 0.18);
    border-color: rgba(244, 63, 94, 0.5);
    color: var(--danger);
    transform: translateY(-1px);
  }
  .taf-close { font-size: 12px; line-height: 1; opacity: 0.8; }
}

.taf-reset {
  margin-left: auto;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px dashed var(--border-strong);
  background: var(--panel-2);
  color: var(--muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--danger);
    color: var(--danger);
    background: rgba(244, 63, 94, 0.08);
    transform: translateY(-1px);
  }
}

.tx-empty {
  text-align: center;
  padding: 60px 24px;
  background: var(--grad-card);
  border: 1px dashed var(--border-strong);
  border-radius: 16px;

  box-shadow: var(--shadow-sm);

  .empty-icon { font-size: 48px; opacity: 0.6; }
  .empty-title { font-size: 17px; font-weight: 700; margin-top: 12px; color: var(--text); }
  .empty-sub { font-size: 13px; color: var(--muted); margin-top: 6px; }
}

.empty-reset {
  margin-top: 16px;
  padding: 9px 18px;
  border-radius: 10px;
  border: 1px solid rgba(139, 92, 246, 0.4);
  background: rgba(139, 92, 246, 0.1);
  color: var(--accent);
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--grad-primary);
    color: #ffffff;
    border-color: transparent;
    transform: translateY(-1px);
    box-shadow: 0 6px 14px -4px rgba(139, 92, 246, 0.5);
  }
}

.tx-day-header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px 8px;
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 4px;
  cursor: pointer;
  user-select: none;
  border-radius: 10px 10px 0 0;

  background: var(--panel);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);

  box-shadow: var(--shadow-sm);

  border: 1px solid var(--border);
  border-bottom: none;

  transition: color 0.15s, transform 0.15s, box-shadow 0.2s;

  &:hover {
    color: var(--accent);
    transform: translateY(-1px);
  }

  &.collapsed {
    border-radius: 10px;
    padding: 10px 14px;
    margin-top: 6px;
    border-bottom: 1px solid var(--border);
  }
}

.day-chev {
  width: 14px;
  height: 14px;
  fill: currentColor;
  flex-shrink: 0;
  opacity: 0.6;
  transition: transform 0.25s cubic-bezier(.34,1.56,.64,1);
  &.open { transform: rotate(0deg); }
  &:not(.open) { transform: rotate(-90deg); }
}

.day-date {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  &.today {
    color: var(--accent-2, #16a34a);
    &::before {
      content: "";
      display: inline-block;
      width: 6px; height: 6px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #4ade80, #16a34a);
      box-shadow:
        0 0 0 3px rgba(34, 197, 94, 0.2),
        0 2px 4px rgba(34, 197, 94, 0.4);
    }
  }
}

.day-count {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--panel-2);
  color: var(--muted);
  text-transform: none;
  letter-spacing: 0;
  border: 1px solid var(--border);
}

.day-sum {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: none;
  &.positive { color: var(--accent-2, #16a34a); }
  &.negative { color: var(--danger, #dc2626); }
}

.tx-day-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
}

/* Тёмная тема — доп. неон */
:global(:root[data-app-theme="dark"]) {
  .day-date.today {
    color: #4ade80;
    text-shadow: 0 0 12px rgba(74, 222, 128, 0.5);

    &::before {
      box-shadow:
        0 0 0 3px rgba(74, 222, 128, 0.25),
        0 0 12px rgba(74, 222, 128, 0.6);
    }
  }

  .day-sum.positive {
    color: #4ade80;
    text-shadow: 0 0 10px rgba(74, 222, 128, 0.5);
  }
  .day-sum.negative {
    color: #f43f5e;
    text-shadow: 0 0 10px rgba(244, 63, 94, 0.5);
  }

  .tx-day-header {
    background: rgba(20, 9, 31, 0.85);
    border-color: rgba(139, 92, 246, 0.18);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.03) inset,
      0 2px 4px rgba(0, 0, 0, 0.4);
  }

  .taf-chip {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.4);
    color: #a855f7;
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.15);

    &:hover {
      background: rgba(244, 63, 94, 0.2);
      border-color: rgba(244, 63, 94, 0.55);
      color: #f43f5e;
      box-shadow: 0 0 12px rgba(244, 63, 94, 0.3);
    }
  }
}

@media (max-width: 700px) {
  .tx-active-filter { padding: 8px 10px; gap: 4px; font-size: 11px; }
  .taf-label { font-size: 10px; width: 100%; margin-bottom: 2px; }
  .taf-chip { padding: 4px 9px; font-size: 11px; }
  .taf-reset { font-size: 10px; padding: 4px 10px; }

  .tx-day-header { padding: 9px 10px 7px; font-size: 11px; gap: 6px; }
  .tx-day-header .day-sum { font-size: 11.5px; }
  .tx-day-header .day-count { font-size: 9px; padding: 1px 6px; }

  .tx-empty { padding: 40px 16px; border-radius: 14px; }
  .tx-empty .empty-icon { font-size: 40px; }
  .tx-empty .empty-title { font-size: 15px; margin-top: 10px; }
  .tx-empty .empty-sub { font-size: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .tx-day-header,
  .tx-active-filter,
  .tx-empty,
  .taf-chip,
  .taf-reset,
  .empty-reset { transition: none !important; transform: none !important; }
}
</style>