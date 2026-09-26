<!-- src/components/transactions/CashModal.vue -->
<script setup>
import { ref, computed, watch } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { fmt } from '@/composables/useFormat';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  owner: { type: String, default: '' },      // если задан — только для него
});

const emit = defineEmits(['update:modelValue', 'saved']);

const accounts = useAccountsStore();
const auth = useAuthStore();
const toast = useToast();

const OWNERS = ['Сергей', 'Саша'];

// mode: 'add' | 'withdraw' | 'set'
const mode = ref('add');
const user = ref('Сергей');
const amount = ref('');
const comment = ref('');
const error = ref('');
const saving = ref(false);

const isOwnerLocked = computed(() => !!props.owner);

const currentBalance = computed(() => {
  const acc = accounts.getCashAccount(user.value);
  return acc ? Number(acc.value) || 0 : 0;
});

const totalCash = computed(() => accounts.totalCash);

const preview = computed(() => {
  const v = parseFloat(amount.value);
  if (!isFinite(v)) return null;

  if (mode.value === 'add') return currentBalance.value + v;
  if (mode.value === 'withdraw') return currentBalance.value - v;
  if (mode.value === 'set') return v;
  return null;
});

const canSave = computed(() => {
  const v = parseFloat(amount.value);
  if (!isFinite(v) || v < 0) return false;
  if (mode.value !== 'set' && v <= 0) return false;
  return true;
});

watch(() => props.modelValue, (open) => {
  if (!open) return;
  mode.value = 'add';
  user.value = props.owner || auth.user || 'Сергей';
  amount.value = '';
  comment.value = '';
  error.value = '';
  saving.value = false;
}, { immediate: true });

async function save() {
  error.value = '';

  const v = parseFloat(amount.value);
  if (!isFinite(v)) {
    error.value = 'Введите сумму';
    return;
  }

  if (mode.value !== 'set' && v <= 0) {
    error.value = 'Сумма должна быть больше 0';
    return;
  }

  if (mode.value === 'set' && v < 0) {
    error.value = 'Баланс не может быть отрицательным';
    return;
  }

  saving.value = true;
  try {
    if (mode.value === 'add') {
      await accounts.addCash(user.value, v, comment.value);
      toast.success(`💵 +${fmt(v)} ₽ наличных (${user.value})`);
    } else if (mode.value === 'withdraw') {
      await accounts.withdrawCash(user.value, v, comment.value);
      toast.success(`💵 −${fmt(v)} ₽ наличных (${user.value})`);
    } else {
      const res = await accounts.setCashBalance(user.value, v, comment.value);
      if (res?.unchanged) {
        toast.info('Баланс не изменился');
      } else {
        toast.success(`💵 Новый баланс: ${fmt(v)} ₽`);
      }
    }

    emit('update:modelValue', false);
    emit('saved');
  } catch (e) {
    error.value = e.response?.data?.error || e.message || 'Ошибка';
  } finally {
    saving.value = false;
  }
}

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="💵 Наличные"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="form">
      <!-- Текущий баланс -->
      <div class="cash-info">
        <div class="ci-row">
          <span class="ci-label">Сейчас у {{ user }}:</span>
          <span class="ci-value">{{ fmt(currentBalance) }} ₽</span>
        </div>
        <div class="ci-row subtle">
          <span class="ci-label">Всего наличных:</span>
          <span class="ci-value subtle">{{ fmt(totalCash) }} ₽</span>
        </div>
      </div>

      <!-- Пользователь (если не заблокирован) -->
      <div v-if="!isOwnerLocked" class="field">
        <label>👤 Пользователь</label>
        <div class="chips-row">
          <button
            v-for="o in OWNERS"
            :key="o"
            type="button"
            class="chip"
            :class="{ active: user === o }"
            @click="user = o"
          >
            {{ o === 'Сергей' ? '👨' : '👩' }} {{ o }}
          </button>
        </div>
      </div>

      <!-- Режим -->
      <div class="field">
        <label>Действие</label>
        <div class="mode-switch">
          <button
            type="button"
            :class="{ active: mode === 'add' }"
            @click="mode = 'add'"
          >➕ Добавить</button>
          <button
            type="button"
            :class="{ active: mode === 'withdraw' }"
            @click="mode = 'withdraw'"
          >➖ Изъять</button>
          <button
            type="button"
            :class="{ active: mode === 'set' }"
            @click="mode = 'set'"
          >🎯 Точный баланс</button>
        </div>
      </div>

      <!-- Сумма -->
      <div class="field">
        <label>
          {{ mode === 'set' ? '💵 Новый баланс, ₽' : '💵 Сумма, ₽' }}
        </label>
        <input
          v-model="amount"
          type="number"
          step="0.01"
          min="0"
          inputmode="decimal"
          placeholder="1000"
        />
      </div>

      <!-- Комментарий -->
      <div class="field">
        <label>📝 Комментарий (необязательно)</label>
        <input
          v-model="comment"
          type="text"
          placeholder="Например, снял с карты"
          autocomplete="off"
        />
      </div>

      <!-- Превью нового баланса -->
      <div v-if="preview !== null" class="preview">
        <span class="pv-label">Станет:</span>
        <span class="pv-value" :class="preview < 0 ? 'negative' : 'positive'">
          {{ fmt(preview) }} ₽
        </span>
        <span v-if="preview < 0" class="pv-warn">⚠️ Отрицательный баланс</span>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <template #footer>
      <button class="btn-cancel" @click="close">Отмена</button>
      <button class="btn-save" :disabled="saving || !canSave" @click="save">
        {{ saving ? 'Сохранение…' : '💾 Сохранить' }}
      </button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.form { display: flex; flex-direction: column; gap: 14px; }

.cash-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(56, 189, 248, 0.06));
  border: 1px solid rgba(34, 197, 94, 0.3);

  .ci-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;

    &.subtle { opacity: 0.8; }
  }

  .ci-label {
    font-size: 12px;
    color: var(--muted);
    font-weight: 600;
  }

  .ci-value {
    font-family: var(--mono);
    font-size: 17px;
    font-weight: 800;
    color: #16a34a;

    &.subtle {
      font-size: 13px;
      color: var(--muted);
    }
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  input {
    padding: 11px 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    font-family: inherit;
    font-size: 15px;
    outline: none;
    background: #fff;
    color: var(--text);
    width: 100%;

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
    }
  }
}

.chips-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: #f8fafc;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover { border-color: var(--accent); color: var(--accent); }

  &.active {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: #fff;
    border-color: transparent;
    box-shadow: 0 6px 16px -8px rgba(59, 130, 246, 0.7);
  }
}

.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0;
  padding: 3px;
  background: #f1f5f9;
  border-radius: 10px;

  button {
    padding: 9px 8px;
    border: none;
    background: transparent;
    color: var(--muted);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 700;
    border-radius: 7px;
    cursor: pointer;
    transition: all 0.18s;
    white-space: nowrap;

    &.active {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #fff;
      box-shadow: 0 4px 12px -4px rgba(59, 130, 246, 0.6);
    }
  }
}

.preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.08);
  border: 1px dashed var(--border);
  flex-wrap: wrap;

  .pv-label {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pv-value {
    font-family: var(--mono);
    font-size: 16px;
    font-weight: 800;

    &.positive { color: #16a34a; }
    &.negative { color: #dc2626; }
  }

  .pv-warn {
    font-size: 11.5px;
    color: #d97706;
    font-weight: 700;
  }
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

  &:hover { background: #e2e8f0; }
}

.btn-save {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff;
  box-shadow: 0 10px 24px -10px rgba(34, 197, 94, 0.7);

  &:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

  &:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 30px -10px rgba(34, 197, 94, 0.9);
  }
}
</style>