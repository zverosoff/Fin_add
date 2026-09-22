<script setup>
import { computed } from 'vue';
import { useFiltersStore } from '@/stores/filters';

const filters = useFiltersStore();

const value = computed({
  get: () => filters.filters.search,
  set: (v) => filters.set('search', v),
});

function clear() {
  filters.set('search', '');
}
</script>

<template>
  <div class="search-bar" :class="{ 'has-value': value }">
    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="7"/>
      <path d="M20 20l-3.5-3.5" stroke-linecap="round"/>
    </svg>

    <input
      v-model="value"
      type="text"
      class="search-input"
      placeholder="Поиск по названию..."
      autocomplete="off"
      spellcheck="false"
    />

    <button
      v-if="value"
      type="button"
      class="search-clear"
      title="Очистить"
      @click="clear"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0 12px;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  flex: 1;
  min-width: 0;

  &:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
    background: #fff;
  }

  &.has-value .search-icon {
    color: var(--accent);
  }
}

.search-icon {
  width: 16px;
  height: 16px;
  color: var(--muted);
  flex-shrink: 0;
  transition: color 0.15s;
}

.search-input {
  flex: 1;
  padding: 10px 10px;
  border: none;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  min-width: 0;

  &::placeholder {
    color: var(--muted);
    font-weight: 500;
  }
}

.search-clear {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(148, 163, 184, 0.2);
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    background: var(--danger);
    color: #fff;
  }
}
</style>