<script setup>
import { computed } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics';
import { fmt } from '@/composables/useFormat';

const props = defineProps({
  goal: { type: Object, required: true },
});

const emit = defineEmits(['edit', 'delete', 'contribute', 'edit-contrib']);

const analytics = useAnalyticsStore();

// ============================================================
// ETA — сколько месяцев осталось до цели
// ============================================================
const eta = computed(() => {
  if (props.goal.done) return null;
  const monthlySave = Math.max(0, analytics.currentMonthMetrics.monthSave);
  if (monthlySave <= 0) return null;
  const months = Math.ceil(props.goal.left / monthlySave);
  return months;
});

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

const etaText = computed(() => {
  if (!eta.value) return '';
  return `≈ ${eta.value} ${plural(eta.value, 'месяц', 'месяца', 'месяцев')}`;
});

// ============================================================
// Участники — те, кто уже вносил
// ============================================================
const contributors = computed(() =>
  Object.entries(props.goal.contributions ?? {})
    .filter(([_, v]) => Number(v) > 0)
    .map(([user, value]) => ({
      user,
      value: Number(value),
      emoji: user === 'Сергей' ? '👨' : '👩',
      cls: user === 'Сергей' ? 'sergey' : 'sasha',
    }))
);

// ============================================================
// Владелец
// ============================================================
const ownerEmoji = computed(() =>
  props.goal.owner === 'Сергей' ? '👨' : '👩'
);
const ownerCls = computed(() =>
  props.goal.owner === 'Сергей' ? 'sergey' : 'sasha'
);

function onEditContrib(user) {
  emit('edit-contrib', { goal: props.goal, user });
}
</script>

<template>
  <div class="goal-card" :class="{ done: goal.done }">
    <!-- Заголовок -->
    <div class="goal-head">
      <div class="goal-title-row">
        <span class="goal-emoji">{{ goal.emoji || '🎯' }}</span>
        <span class="goal-name">{{ goal.name }}</span>
        <span class="goal-owner" :class="ownerCls">
          {{ ownerEmoji }} {{ goal.owner }}
        </span>
      </div>
      <div class="goal-actions">
        <button
          class="act-contribute"
          type="button"
          @click="emit('contribute', goal)"
          title="Внести деньги"
        >+ Внести</button>
        <button type="button" @click="emit('edit', goal)" title="Редактировать">✏️</button>
        <button
          class="danger"
          type="button"
          @click="emit('delete', goal)"
          title="Удалить"
        >✕</button>
      </div>
    </div>

    <!-- Прогресс -->
    <div class="goal-progress">
      <span class="current">{{ fmt(goal.totalSaved) }} ₽</span>
      <span class="target">из {{ fmt(goal.target) }} ₽</span>
    </div>

    <!-- Полоса -->
    <div class="goal-track">
      <div
        class="goal-fill"
        :class="{ done: goal.done }"
        :style="{ width: goal.pct + '%' }"
      ></div>
    </div>

    <!-- Итог -->
    <div class="goal-foot">
      <span class="goal-pct" :class="{ done: goal.done }">
        {{ goal.pct.toFixed(1) }}%
      </span>
      <span>
        <template v-if="goal.done">🎉 Цель достигнута!</template>
        <template v-else>
          Осталось {{ fmt(goal.left) }} ₽
          <template v-if="etaText"> · {{ etaText }}</template>
        </template>
      </span>
    </div>

    <!-- Взносы -->
    <div v-if="contributors.length > 0" class="goal-contribs">
      <span
        v-for="c in contributors"
        :key="c.user"
        class="goal-contrib"
        :class="c.cls"
        @click="onEditContrib(c.user)"
        :title="`Изменить взнос ${c.user}`"
      >
        <span class="avatar">{{ c.emoji }}</span>
        <span class="name">{{ c.user }}</span>
        <span class="amount">{{ fmt(c.value) }} ₽</span>
      </span>
    </div>
    <div v-else class="goal-empty-contribs">
      <span class="emoji">😢</span>
      <span class="text">Ещё никто не поделился на мечту…</span>
      <span class="hint">Будь первым!</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.goal-card {
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.15s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  &.done {
    border-color: rgba(34, 197, 94, 0.4);
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.04), transparent 60%), #ffffff;
  }
}

.goal-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.goal-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.goal-emoji {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
}

.goal-name {
  flex: 1;
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.goal-owner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;

  &.sergey {
    color: #2563eb;
    background: rgba(59, 130, 246, 0.12);
  }
  &.sasha {
    color: #ec4899;
    background: rgba(236, 72, 153, 0.12);
  }
}

.goal-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;

  button {
    min-width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    transition: all 0.15s;

    &:hover {
      color: var(--accent);
      border-color: var(--accent);
      background: rgba(56, 189, 248, 0.08);
    }
    &.danger:hover {
      color: var(--danger);
      border-color: var(--danger);
      background: rgba(239, 68, 68, 0.08);
    }
    &.act-contribute {
      background: linear-gradient(135deg, #22c55e, #4ade80);
      border-color: transparent;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      width: auto;
      padding: 0 12px;

      &:hover {
        color: #fff;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px -4px rgba(34, 197, 94, 0.7);
      }
    }
  }
}

.goal-progress {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;

  .current {
    font-family: var(--mono);
    font-size: 16px;
    font-weight: 800;
    color: var(--accent);
  }
  .target {
    font-family: var(--mono);
    font-size: 11.5px;
    font-weight: 700;
    color: var(--muted);
  }
}

.goal-track {
  height: 8px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.15);
  overflow: hidden;
}

.goal-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #38bdf8, #8b5cf6);
  transition: width 0.6s cubic-bezier(.22,.61,.36,1);
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);

  &.done {
    background: linear-gradient(90deg, #22c55e, #4ade80);
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
  }
}

.goal-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
  gap: 8px;
  flex-wrap: wrap;

  .goal-pct {
    font-weight: 800;
    color: var(--accent);

    &.done { color: #22c55e; }
  }
}

.goal-contribs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
}

.goal-contrib {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid var(--border);
  background: rgba(148, 163, 184, 0.1);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.15);
  }

  .name { color: var(--muted); font-weight: 600; }
  .amount {
    font-family: var(--mono);
    font-weight: 800;
    color: var(--text);
  }

  &.sergey {
    background: rgba(59, 130, 246, 0.08);
    border-color: rgba(59, 130, 246, 0.25);
    .amount { color: #2563eb; }
  }
  &.sasha {
    background: rgba(236, 72, 153, 0.08);
    border-color: rgba(236, 72, 153, 0.25);
    .amount { color: #db2777; }
  }
}

.goal-empty-contribs {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.08);
  color: var(--muted);
  font-size: 11px;
  font-style: italic;
  text-align: center;

  .emoji { font-style: normal; }
  .hint {
    color: var(--accent);
    font-weight: 600;
    font-style: normal;
  }
}
</style>