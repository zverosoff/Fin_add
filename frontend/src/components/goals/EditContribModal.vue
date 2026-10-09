<script setup>
import { ref, watch, computed } from 'vue';
import { useGoalsStore } from '@/stores/goals';
import { useToast } from '@/composables/useToast';
import { fmt } from '@/composables/useFormat';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  goal: { type: Object, default: null },
  user: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'saved']);

const goalsStore = useGoalsStore();
const toast = useToast();

const amount = ref('');
const error = ref('');
const saving = ref(false);

const currentAmount = computed(() => {
  if (!props.goal || !props.user) return 0;
  return Number((props.goal.contributions ?? {})[props.user]) || 0;
});

watch(() => props.modelValue, (open) => {
  if (!open) return;
  amount.value = String(currentAmount.value);
  error.value = '';
}, { immediate: true });

async function save() {
  error.value = '';

  const value = parseFloat(amount.value);
  if (!isFinite(value) || value < 0) {
    error.value = 'Введите 0 или больше';
    return;
  }

  saving.value = true;
  try {
    await goalsStore.setContribution(props.goal.id, props.user, value);
    toast.success(
      value === 0
        ? `🗑 Взнос ${props.user} удалён`
        : `✏️ Взнос ${props.user}: ${fmt(value)} ₽`
    );
    emit('update:modelValue', false);
    emit('saved');
  } catch (e) {
    error.value = e.response?.data?.error || e.message || 'Ошибка';
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!confirm(`Удалить взнос ${props.user} (${fmt(currentAmount.value)} ₽) из «${props.goal.name}»?`)) return;
  try {
    await goalsStore.setContribution(props.goal.id, props.user, 0);
    toast.info('🗑 Взнос удалён');
    emit('update:modelValue', false);
    emit('saved');
  } catch (e) {
    error.value = e.message;
  }
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="`✏️ Взнос ${user}`"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="goal" class="form">
      <div class="goal-info">
        <div class="icon">{{ goal.emoji || '🎯' }}</div>
        <div class="text">
          <div class="name">{{ goal.name }}</div>
          <div class="progress">
            {{ user }} внёс <strong>{{ fmt(currentAmount) }} ₽</strong>
            из общей суммы {{ fmt(goal.totalSaved) }} ₽
          </div>
        </div>
      </div>

      <div class="field">
        <label>💵 Сумма, ₽</label>
        <input
          v-model="amount"
          type="number"
          step="100"
          min="0"
          inputmode="decimal"
        />
      </div>

      <div class="hint">Введите 0, чтобы удалить взнос</div>

      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <template #footer>
      <button class="btn-delete" @click="remove">🗑 Удалить</button>
      <button class="btn-cancel" @click="emit('update:modelValue', false)">Отмена</button>
      <button class="btn-save" :disabled="saving" @click="save">
        {{ saving ? '…' : '💾 Сохранить' }}
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text);
  }
  .progress {
    font-size: 11.5px;
    color: var(--muted);

    strong { color: var(--accent); }
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
  }

  input {
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    width: 100%;
    background: var(--panel-2);
    color: var(--text);
    transition: border-color 0.15s, box-shadow 0.15s, background 0.3s ease;

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
    }
  }
}

.hint {
  font-size: 11.5px;
  color: var(--muted);
  text-align: center;
  font-style: italic;
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

.btn-delete, .btn-cancel, .btn-save {
  padding: 10px 20px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-delete {
  margin-right: auto;
  background: rgba(244, 63, 94, 0.1);
  color: var(--danger);
  border-color: rgba(244, 63, 94, 0.3);
  transition: all 0.15s;
  &:hover { background: rgba(244, 63, 94, 0.2); }
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