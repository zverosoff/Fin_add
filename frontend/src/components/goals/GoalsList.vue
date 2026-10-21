<script setup>
import { useGoalsStore } from '@/stores/goals';
import GoalCard from './GoalCard.vue';

const emit = defineEmits([
  'add',
  'edit',
  'delete',
  'contribute',
  'edit-contrib',
  'set-primary',
]);

const goalsStore = useGoalsStore();

// ✅ PNG-иконка цели для пустого состояния
const ICON_GOAL = '/img/icons/nav/goal.png';
</script>

<template>
  <div>
    <div v-if="goalsStore.enrichedGoals.length > 0" class="goals-grid">
      <GoalCard
        v-for="goal in goalsStore.enrichedGoals"
        :key="goal.id"
        :goal="goal"
        @edit="(g) => emit('edit', g)"
        @delete="(g) => emit('delete', g)"
        @contribute="(g) => emit('contribute', g)"
        @edit-contrib="(payload) => emit('edit-contrib', payload)"
        @set-primary="(g) => emit('set-primary', g)"
      />
    </div>

    <div v-else class="goals-empty">
      <img :src="ICON_GOAL" class="goals-empty-icon" alt="Цели" />
      <span class="goals-empty-text">
        Пока нет целей. Нажмите «+ Добавить», чтобы создать первую.
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.goals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 10px;
}

.goals-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  padding: 24px 16px;
  color: var(--muted);
  font-size: 12px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  background: var(--panel-2);
  transition: background 0.3s ease, border-color 0.3s ease;
}

/* ✅ PNG-иконка цели в пустом состоянии — фикс 48×48 */
.goals-empty-icon {
  display: block;
  width: 48px;
  height: 48px;
  min-width: 48px;
  max-width: 48px;
  max-height: 48px;
  object-fit: contain;
  opacity: 0.75;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
}

.goals-empty-text {
  max-width: 260px;
  line-height: 1.4;
}

@media (max-width: 700px) {
  .goals-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .goals-empty {
    padding: 20px 12px;
    font-size: 11.5px;
    border-radius: 10px;
  }

  .goals-empty-icon {
    width: 40px;
    height: 40px;
    min-width: 40px;
    max-width: 40px;
    max-height: 40px;
  }
}
</style>