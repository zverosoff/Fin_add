<script setup>
import { ref, computed, watch } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { fmt, fmtDateShort } from '@/composables/useFormat';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  owner: { type: String, default: '' },
  initialMode: { type: String, default: 'add' },
});

const emit = defineEmits(['update:modelValue', 'saved']);

const accounts = useAccountsStore();
const auth = useAuthStore();
const toast = useToast();

const OWNERS = ['Сергей', 'Саша'];

const mode = ref('add');
const user = ref('Сергей');
const amount = ref('');
const comment = ref('');
const error = ref('');
const saving = ref(false);

const isOwnerLocked = computed(() => !!props.owner);

const currentBalance = computed(() => accounts.getCash(user.value));
const totalCash = computed(() => accounts.totalCash);

const modeTitle = computed(() => {
  switch (mode.value) {
    case 'add':      return '➕ Добавить наличные';
    case 'withdraw': return '➖ Изъять наличные';
    case 'set':      return '🎯 Точный баланс';
    default:         return 'Наличные';
  }
});

const amountLabel = computed(() => {
  switch (mode.value) {
    case 'set': return '💵 Новый баланс кошелька, ₽';
    default:    return '💵 Сумма, ₽';
  }
});

const recentOps = computed(() => {
  return (accounts.transactions || [])
    .filter(t => t.accountId === 'cash' && t.user === user.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
});

const preview = computed(() => {
  const v = parseFloat(amount.value);
  if (!isFinite(v)) return null;

  switch (mode.value) {
    case 'add':      return { balance: currentBalance.value + v };
    case 'withdraw': return { balance: currentBalance.value - v };
    case 'set':      return { balance: v };
    default:         return null;
  }
});

const canSave = computed(() => {
  const v = parseFloat(amount.value);
  if (!isFinite(v) || v < 0) return false;
  if (mode.value !== 'set' && v <= 0) return false;
  return true;
});

watch(() => props.modelValue, (open) => {
  if (!open) return;
  mode.value = props.initialMode || 'add';
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
    error.value = 'Сумма не может быть отрицательной';
    return;
  }

  saving.value = true;
  try {
    switch (mode.value) {
      case 'add': {
        await accounts.addCash(user.value, v, comment.value);
        toast.success(`💵 +${fmt(v)} ₽ (${user.value})`);
        break;
      }
      case 'withdraw': {
        await accounts.withdrawCash(user.value, v, comment.value);
        toast.success(`💵 −${fmt(v)} ₽ (${user.value})`);
        break;
      }
      case 'set': {
        const res = await accounts.setCashBalance(user.value, v, comment.value);
        toast[res?.unchanged ? 'info' : 'success'](
          res?.unchanged ? 'Баланс не изменился' : `💵 Новый баланс: ${fmt(v)} ₽`
        );
        break;
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
      <div class="cash-info">
        <div class="ci-row">
          <span class="ci-label">👛 Кошелёк {{ user }}:</span>
          <span class="ci-value">{{ fmt(currentBalance) }} ₽</span>
        </div>
        <div class="ci-row subtle">
          <span class="ci-label">Всего в системе:</span>
          <span class="ci-value subtle">{{ fmt(totalCash) }} ₽</span>
        </div>
      </div>

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
          >🎯 Баланс</button>
        </div>
      </div>

      <div class="field">
        <label>{{ amountLabel }}</label>
        <input
          v-model="amount"
          type="number"
          step="0.01"
          min="0"
          inputmode="decimal"
          placeholder="1000"
        />
      </div>

      <div class="field">
        <label>📝 Комментарий (необязательно)</label>
        <input
          v-model="comment"
          type="text"
          placeholder="Например, снял с карты"
          autocomplete="off"
        />
      </div>

      <div v-if="preview !== null" class="preview">
        <div class="pv-row">
          <span class="pv-label">Кошелёк:</span>
          <span
            class="pv-value"
            :class="preview.balance < 0 ? 'negative' : 'positive'"
          >{{ fmt(preview.balance) }} ₽</span>
        </div>
        <div
          v-if="preview.balance < 0"
          class="pv-warn"
        >⚠️ Отрицательное значение</div>
      </div>

      <div v-if="recentOps.length > 0" class="recent">
        <div class="recent-title">Последние операции {{ user }}</div>
        <div class="recent-list">
          <div
            v-for="op in recentOps"
            :key="op.id"
            class="recent-row"
          >
            <span class="rr-date">{{ fmtDateShort(op.date) }}</span>
            <span class="rr-name">{{ op.name }}</span>
            <span
              class="rr-amount"
              :class="op.type === 'income' ? 'income' : 'expense'"
            >
              {{ op.type === 'income' ? '+' : '−' }}{{ fmt(op.amount) }} ₽
            </span>
          </div>
        </div>
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
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);

  .ci-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;

    &.subtle { opacity: 0.75; }
  }

  .ci-label {
    font-size: 12px;
    color: var(--muted);
    font-weight: 600;
  }

  .ci-value {
    font-family: var(--mono);
    font-size: 15px;
    font-weight: 800;
    color: var(--accent-2, #16a34a);

    &.subtle {
      font-size: 12px;
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
    background: var(--panel-2);
    color: var(--text);
    width: 100%;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.3s ease;

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
    }
    &::placeholder { color: var(--muted); opacity: 0.6; }
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
  background: var(--panel-2);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover { border-color: var(--accent); color: var(--accent); }

  &.active {
    background: var(--grad-primary);
    color: #fff;
    border-color: transparent;
    box-shadow: 0 6px 16px -8px rgba(139, 92, 246, 0.7);
  }
}

.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0;
  padding: 3px;
  background: var(--panel-2);
  border: 1px solid var(--border);
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
      background: var(--grad-primary);
      color: #fff;
      box-shadow: 0 4px 12px -4px rgba(139, 92, 246, 0.6);
    }
  }
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--panel-2);
  border: 1px dashed var(--border);

  .pv-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .pv-label {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pv-value {
    font-family: var(--mono);
    font-size: 15px;
    font-weight: 800;

    &.positive { color: var(--accent-2, #16a34a); }
    &.negative { color: var(--danger); }
  }

  .pv-warn {
    font-size: 11.5px;
    color: var(--warning, #d97706);
    font-weight: 700;
    text-align: center;
    margin-top: 2px;
  }
}

.recent {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--panel-2);
  border: 1px solid var(--border);
}

.recent-title {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.recent-row {
  display: grid;
  grid-template-columns: 46px 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  padding: 4px 0;

  .rr-date {
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--muted);
    font-weight: 700;
  }

  .rr-name {
    color: var(--text);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .rr-amount {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;

    &.income { color: var(--accent-2, #16a34a); }
    &.expense { color: var(--danger); }
  }
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
  background: var(--grad-income);
  color: #fff;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 -2px 0 rgba(0, 0, 0, 0.15) inset,
    0 6px 18px -6px rgba(34, 197, 94, 0.7);
  transition: all 0.15s;

  &:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

  &:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 -2px 0 rgba(0, 0, 0, 0.15) inset,
      0 10px 24px -6px rgba(34, 197, 94, 0.9);
  }
}

/* Тёмная тема — доп. свечение */
:global(:root[data-app-theme="dark"]) {
  .cash-info {
    background: rgba(34, 197, 94, 0.12);
    border-color: rgba(74, 222, 128, 0.35);
    box-shadow: 0 0 20px -6px rgba(74, 222, 128, 0.25);
  }

  .ci-value {
    color: #4ade80;
    text-shadow: 0 0 10px rgba(74, 222, 128, 0.4);
  }
}
</style>