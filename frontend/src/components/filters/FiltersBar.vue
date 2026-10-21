<script setup>
import { useFiltersStore } from '@/stores/filters';

const filters = useFiltersStore();

function removeChip(key) {
  if (key === 'search') {
    filters.set('search', '');
  } else {
    filters.set(key, 'all');
  }
}
</script>

<template>
  <Transition name="filters-bar">
    <div v-if="filters.hasActive" class="filters-bar">
      <span class="fb-label">🎯 Фильтр:</span>

      <span
        v-for="f in filters.activeList"
        :key="f.key"
        class="fb-chip"
        @click="removeChip(f.key)"
      >
        {{ f.label }}
        <span class="fb-close">✕</span>
      </span>

      <button class="fb-reset" type="button" @click="filters.reset()">
        Сбросить всё
      </button>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.filters-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 12px;
  font-size: 12px;
}

.fb-label {
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 11px;
  margin-right: 2px;
}

.fb-chip {
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

  .fb-close {
    font-size: 12px;
    line-height: 1;
    opacity: 0.8;
  }
}

.fb-reset {
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

.filters-bar-enter-active,
.filters-bar-leave-active {
  transition: all 0.25s cubic-bezier(.34,1.56,.64,1);
}
.filters-bar-enter-from,
.filters-bar-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
  padding: 0 12px;
  margin: 0;
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .filters-bar {
    padding: 8px 10px;
    gap: 4px;
    font-size: 11px;
  }

  .fb-label {
    font-size: 10px;
    width: 100%;
    margin-bottom: 2px;
  }

  .fb-chip {
    padding: 4px 9px;
    font-size: 11px;
  }

  .fb-reset {
    font-size: 10px;
    padding: 3px 9px;
  }
}
</style>