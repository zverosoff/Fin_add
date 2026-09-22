<script setup>
import { useGoalsStore } from '@/stores/goals';
import GoalCard from './GoalCard.vue';

const emit = defineEmits(['add', 'edit', 'delete', 'contribute', 'edit-contrib']);

const goalsStore = useGoalsStore();
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
      />
    </div>

    <div v-else class="goals-empty">
      Пока нет целей. Нажмите «+ Добавить», чтобы создать первую.
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
  text-align: center;
  padding: 24px 16px;
  color: var(--muted);
  font-size: 12px;
  border: 1px dashed var(--border);
  border-radius: 12px;
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
}
</style>