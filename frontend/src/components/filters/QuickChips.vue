<script setup>
import { useFiltersStore } from '@/stores/filters';

const filters = useFiltersStore();

const types = [
  { value: 'all',     label: 'Все',     icon: '' },
  { value: 'income',  label: 'Доходы',  icon: '📈' },
  { value: 'expense', label: 'Расходы', icon: '📉' },
];

const users = [
  { value: 'all',    label: 'Все' },
  { value: 'Сергей', label: '👨 Сергей' },
  { value: 'Саша',   label: '👩 Саша' },
];
</script>

<template>
  <div class="quick-chips">
    <!-- Тип -->
    <div class="chips-group">
      <button
        v-for="t in types"
        :key="t.value"
        type="button"
        class="chip"
        :class="{ active: filters.filters.type === t.value }"
        @click="filters.set('type', t.value)"
      >
        <span v-if="t.icon" class="chip-icon">{{ t.icon }}</span>
        {{ t.label }}
      </button>
    </div>

    <div class="divider"></div>

    <!-- Пользователь -->
    <div class="chips-group">
      <button
        v-for="u in users"
        :key="u.value"
        type="button"
        class="chip"
        :class="{ active: filters.filters.user === u.value }"
        @click="filters.set('user', u.value)"
      >
        {{ u.label }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.quick-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.chips-group {
  display: inline-flex;
  gap: 4px;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
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

  .chip-icon {
    font-size: 12px;
    line-height: 1;
  }

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: rgba(56, 189, 248, 0.08);
  }

  &.active {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: #fff;
    border-color: transparent;
    box-shadow: 0 6px 16px -8px rgba(59, 130, 246, 0.7);
  }
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--border);
  flex-shrink: 0;
}

@media (max-width: 700px) {
  .quick-chips {
    padding: 8px 10px;
    gap: 6px;
    overflow-x: auto;
    flex-wrap: nowrap;
    scrollbar-width: none;

    &::-webkit-scrollbar { display: none; }
  }

  .chips-group {
    flex-wrap: nowrap;
    flex-shrink: 0;
  }

  .chip {
    padding: 6px 12px;
    font-size: 12px;
    flex-shrink: 0;
  }

  .divider {
    display: none;
  }
}
</style>