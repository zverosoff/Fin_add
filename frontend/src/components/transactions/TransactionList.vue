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

/* ============================================================
   ✅ Плашка активных фильтров — стеклянная + объёмная
   ============================================================ */
.tx-active-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 10px 14px;

  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 14px;
  font-size: 12px;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(148, 163, 184, 0.05) inset,
    0 2px 6px rgba(15, 23, 42, 0.04),
    0 8px 16px -6px rgba(99, 102, 241, 0.15);
}

.taf-label {
  font-weight: 800;
  color: #64748b;
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
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.08));
  border: 1px solid rgba(99, 102, 241, 0.35);
  color: #4f46e5;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 2px 4px rgba(99, 102, 241, 0.1);

  &:hover {
    background: linear-gradient(180deg, rgba(239, 68, 68, 0.18), rgba(239, 68, 68, 0.1));
    border-color: rgba(239, 68, 68, 0.5);
    color: #dc2626;
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.7) inset,
      0 4px 8px -2px rgba(239, 68, 68, 0.3);
  }
  .taf-close { font-size: 12px; line-height: 1; opacity: 0.8; }
}

.taf-reset {
  margin-left: auto;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px dashed rgba(148, 163, 184, 0.5);
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  color: #64748b;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;

  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.9) inset;

  &:hover {
    border-color: #dc2626;
    color: #dc2626;
    background: linear-gradient(180deg, #fef2f2, #fee2e2);
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.9) inset,
      0 4px 8px -2px rgba(239, 68, 68, 0.25);
  }
}

/* ============================================================
   ✅ Пустой список — вложенная карточка
   ============================================================ */
.tx-empty {
  text-align: center;
  padding: 60px 24px;
  background: linear-gradient(180deg, #ffffff, #fafbff);
  border: 1px dashed rgba(148, 163, 184, 0.4);
  border-radius: 16px;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 4px 12px -4px rgba(15, 23, 42, 0.06);

  .empty-icon { font-size: 48px; opacity: 0.6; }
  .empty-title { font-size: 17px; font-weight: 700; margin-top: 12px; color: var(--text); }
  .empty-sub { font-size: 13px; color: var(--muted); margin-top: 6px; }
}

.empty-reset {
  margin-top: 16px;
  padding: 9px 18px;
  border-radius: 10px;
  border: 1px solid rgba(99, 102, 241, 0.4);
  background: linear-gradient(180deg, #eef2ff, #e0e7ff);
  color: #4f46e5;
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 2px 6px rgba(99, 102, 241, 0.15);

  &:hover {
    background: linear-gradient(180deg, #6366f1, #4f46e5);
    color: #ffffff;
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 6px 14px -4px rgba(99, 102, 241, 0.5);
  }
}

/* ============================================================
   ✅ Заголовок дня — объёмный, стеклянный
   ============================================================ */
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

  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(248, 250, 252, 0.85) 100%
  );
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(148, 163, 184, 0.08) inset,
    0 2px 4px rgba(15, 23, 42, 0.03);

  border: 1px solid rgba(226, 232, 240, 0.6);
  border-bottom: none;

  transition: color 0.15s, transform 0.15s, box-shadow 0.2s;

  &:hover {
    color: var(--accent);
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 -1px 0 rgba(148, 163, 184, 0.08) inset,
      0 4px 10px -2px rgba(99, 102, 241, 0.15);
  }

  &.collapsed {
    border-radius: 10px;
    padding: 10px 14px;
    margin-top: 6px;
    border-bottom: 1px solid rgba(226, 232, 240, 0.6);

    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 -1px 0 rgba(148, 163, 184, 0.08) inset,
      0 2px 6px rgba(15, 23, 42, 0.05);
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
    color: #16a34a;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
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
  background: linear-gradient(180deg, #f1f5f9, #e2e8f0);
  color: var(--muted);
  text-transform: none;
  letter-spacing: 0;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.8) inset,
    0 1px 2px rgba(15, 23, 42, 0.05);
}

.day-sum {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: none;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
  &.positive { color: #16a34a; }
  &.negative { color: #dc2626; }
}

.tx-day-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
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