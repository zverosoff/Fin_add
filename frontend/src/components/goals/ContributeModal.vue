<script setup>
import { ref, watch, computed } from 'vue';
import { useGoalsStore } from '@/stores/goals';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { fmt } from '@/composables/useFormat';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  goal: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'saved']);

const goalsStore = useGoalsStore();
const auth = useAuthStore();
const toast = useToast();

const mode = ref('add');
const amount = ref('');
const user = ref('Сергей');
const error = ref('');
const saving = ref(false);

watch(() => props.modelValue, (open) => {
  if (!open) return;
  mode.value = 'add';
  amount.value = '';
  user.value = auth.user || 'Сергей';
  error.value = '';
}, { immediate: true });

const currentUserContrib = computed(() => {
  if (!props.goal) return 0;
  return Number((props.goal.contributions ?? {})[user.value]) || 0;
});

async function save() {
  error.value = '';

  const value = parseFloat(amount.value);
  if (!isFinite(value) || value <= 0) {
    error.value = 'Введите сумму больше 0';
    return;
  }

  if (mode.value === 'remove' && value > currentUserContrib.value) {
    error.value = `У ${user.value} только ${fmt(currentUserContrib.value)} ₽ — нельзя изъять ${fmt(value)} ₽`;
    return;
  }

  saving.value = true;
  try {
    await goalsStore.contribute(props.goal.id, user.value, value, mode.value);
    toast.success(
      mode.value === 'add'
        ? `💰 ${user.value} внёс ${fmt(value)} ₽ в «${props.goal.name}»`
        : `↩️ ${user.value} изъял ${fmt(value)} ₽ из «${props.goal.name}»`
    );
    emit('update:modelValue', false);
    emit('saved');
  } catch (e) {
    error.value = e.response?.data?.error || e.message || 'Ошибка';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="mode === 'add' ? '💰 Внести в цель' : '↩️ Изъять из цели'"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="goal" class="form">
      <div class="goal-info">
        <div class="icon">{{ goal.emoji || '🎯' }}</div>
        <div class="text">
          <div class="name">{{ goal.name }}</div>
          <div class="progress">
            Собрано <strong>{{ fmt(goal.totalSaved) }} ₽</strong>
            из {{ fmt(goal.target) }} ₽ · {{ goal.pct.toFixed(0) }}%
          </div>
        </div>
      </div>

      <div class="type-switch">
        <button
          type="button"
          :class="{ active: mode === 'add' }"
          @click="mode = 'add'"
        >💰 Внести</button>
        <button
          type="button"
          :class="{ active: mode === 'remove' }"
          @click="mode = 'remove'"
        >↩️ Изъять</button>
      </div>

      <div class="field">
        <label>💵 Сумма, ₽</label>
        <input
          v-model="amount"
          type="number"
          step="100"
          min="0"
          inputmode="decimal"
          placeholder="1000"
        />
      </div>

      <div class="field">
        <label>👤 Кто вносит</label>
        <select v-model="user">
          <option value="Сергей">👨 Сергей</option>
          <option value="Саша">👩 Саша</option>
        </select>
      </div>

      <div v-if="mode === 'remove'" class="hint">
        У {{ user }} сейчас: <strong>{{ fmt(currentUserContrib) }} ₽</strong>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <template #footer>
      <button class="btn-cancel" @click="emit('update:modelValue', false)">Отмена</button>
      <button class="btn-save" :disabled="saving" @click="save">
        {{ saving ? 'Сохранение…' : (mode === 'add' ? '💰 Внести' : '↩️ Изъять') }}
      </button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.form { display: flex; flex-direction: column; gap: 12px; }

.goal-info {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.25);

  .icon { font-size: 26px; flex-shrink: 0; }
  .text { flex: 1; min-width: 0; }
  .name {
    font-size: 14px;
    font-weight: 800;
    color: var(--text);
    margin-bottom: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .progress {
    font-size: 11.5px;
    color: var(--muted);
    line-height: 1.4;

    strong { color: var(--accent); }
  }
}

.type-switch {
  display: flex;
  gap: 0;
  padding: 3px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;

  button {
    flex: 1;
    padding: 9px 14px;
    border: none;
    background: transparent;
    color: var(--muted);
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    border-radius: 7px;
    cursor: pointer;
    transition: all 0.18s;

    &.active {
      background: var(--grad-income);
      color: #fff;
      box-shadow: 0 4px 12px -4px rgba(34, 197, 94, 0.6);
    }
    &:nth-child(2).active {
      background: var(--grad-expense);
      box-shadow: 0 4px 12px -4px rgba(244, 63, 94, 0.6);
    }
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;

  label {
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  input, select {
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel-2);
    color: var(--text);
    font-family: inherit;
    font-size: 14px;
    outline: none;
    width: 100%;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.3s ease;

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
    }
    &::placeholder { color: var(--muted); opacity: 0.6; }
  }
}

.hint {
  font-size: 12px;
  color: var(--muted);
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  text-align: center;
}

.error-msg {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.3);
  color: var(--danger);
  font-size: 12.5px;
  font-weight: 600;
}

.btn-cancel, .btn-save {
  padding: 10px 20px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-cancel {
  background: var(--panel-2);
  color: var(--text);
  border-color: var(--border);
  transition: all 0.15s;
  &:hover { border-color: var(--border-strong); }
}

.btn-save {
  background: var(--grad-primary);
  color: #fff;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 -2px 0 rgba(0, 0, 0, 0.15) inset,
    0 6px 18px -6px rgba(139, 92, 246, 0.7);
  transition: all 0.15s;

  &:disabled { opacity: 0.5; cursor: wait; }
  &:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 -2px 0 rgba(0, 0, 0, 0.15) inset,
      0 10px 24px -6px rgba(139, 92, 246, 0.9);
  }
}
</style>