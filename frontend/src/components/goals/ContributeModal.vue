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

const mode = ref('add');   // add | remove
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

// Текущий взнос выбранного пользователя
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
      <!-- Инфо о цели -->
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

      <!-- Тип: внести/изъять -->
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

      <!-- Сумма -->
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

      <!-- Кто вносит -->
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
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(56, 189, 248, 0.25);

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
  background: #f1f5f9;
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
      background: linear-gradient(135deg, #22c55e, #4ade80);
      color: #fff;
    }
    &:nth-child(2).active {
      background: linear-gradient(135deg, #ef4444, #f87171);
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
    background: #ffffff;
    color: var(--text);
    font-family: inherit;
    font-size: 14px;
    outline: none;
    width: 100%;

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
    }
  }
}

.hint {
  font-size: 12px;
  color: var(--muted);
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.08);
  text-align: center;
}

.error-msg {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
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
  background: #f1f5f9;
  color: var(--text);
  border-color: var(--border);
}

.btn-save {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  box-shadow: 0 10px 24px -10px rgba(59, 130, 246, 0.7);

  &:disabled { opacity: 0.5; cursor: wait; }
}
</style>