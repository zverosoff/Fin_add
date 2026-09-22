<script setup>
import { ref, watch, computed } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { fmt } from '@/composables/useFormat';
import { computeExpectedBalance } from '@/composables/useBalance';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  account: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'saved']);

const accounts = useAccountsStore();
const txStore = useTransactionsStore();
const auth = useAuthStore();
const toast = useToast();

const actualBalance = ref('');
const error = ref('');
const saving = ref(false);

// Ожидаемый баланс
const expected = computed(() => {
  if (!props.account) return 0;
  return computeExpectedBalance(props.account, accounts.transactions);
});

// Разница
const diff = computed(() => {
  const val = parseFloat(actualBalance.value);
  if (!isFinite(val)) return null;
  return val - expected.value;
});

const hasDiff = computed(() =>
  diff.value !== null && Math.abs(diff.value) > 0.01
);

// При открытии — подставляем текущий value
watch(() => props.modelValue, (open) => {
  if (!open || !props.account) return;
  actualBalance.value = String(Number(props.account.value) || 0);
  error.value = '';
}, { immediate: true });

async function save() {
  error.value = '';

  const val = parseFloat(actualBalance.value);
  if (!isFinite(val) || val < 0) {
    error.value = 'Введите корректный баланс (≥ 0)';
    return;
  }

  if (!hasDiff.value) {
    toast.info('Расхождения нет — корректировка не нужна');
    emit('update:modelValue', false);
    return;
  }

  const difference = val - expected.value;
  const type = difference > 0 ? 'income' : 'expense';
  const amount = Math.abs(difference);

  const txData = {
    name: 'Корректировка счёта',
    amount,
    type,
    category: 'Прочее',
    date: new Date().toISOString(),
    user: props.account.owner || auth.user || 'Сергей',
    accountId: props.account.id,
    fromReconcile: true,
    internalTransfer: false,
  };

  saving.value = true;
  try {
    // Создаём корректировочную операцию
    await txStore.save(txData);

    // Обновляем openingBalance, чтобы value совпал с фактическим
    // (это важно, потому что fromReconcile не учитывается в expected)
    const acc = accounts.accounts.find(a => a.id === props.account.id);
    if (acc) {
      acc.openingBalance = (Number(acc.openingBalance) || 0) + difference;
      acc.value = val;
    }

    // Сохраняем только accounts — goals и т.п. остаются
    const { api } = await import('@/api/client');
    await api.post('/state', { accounts: accounts.accounts });

    toast.success(`⚖️ Создана корректировка на ${fmt(amount)} ₽`);
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
    :title="`⚖️ Сверка: ${account?.name || 'счёт'}`"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="account" class="form">
      <!-- Инфо -->
      <div class="reconcile-info">
        <div class="row">
          <span class="k">Начальный остаток</span>
          <span class="v">{{ fmt(account.openingBalance) }} ₽</span>
        </div>
        <div class="row">
          <span class="k">По операциям сейчас</span>
          <span class="v accent">{{ fmt(expected) }} ₽</span>
        </div>
      </div>

      <!-- Фактический баланс -->
      <div class="field">
        <label>💰 Фактический баланс (из банка), ₽</label>
        <input
          v-model="actualBalance"
          type="number"
          step="0.01"
          min="0"
          inputmode="decimal"
          placeholder="0"
          autofocus
        />
      </div>

      <!-- Превью корректировки -->
      <div v-if="diff !== null" class="preview">
        <template v-if="!hasDiff">
          <div class="preview-ok">
            ✅ Расхождения нет — баланс совпадает
          </div>
        </template>
        <template v-else>
          <div class="preview-diff">
            Будет создана операция «Корректировка счёта»:
            <strong>
              {{ diff > 0 ? '+' : '−' }}{{ fmt(Math.abs(diff)) }} ₽
            </strong>
            — {{ diff > 0 ? '📈 доход (пополнение счёта)' : '📉 расход (списание со счёта)' }}
          </div>
        </template>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <template #footer>
      <button class="btn-cancel" @click="close">Отмена</button>
      <button class="btn-save" :disabled="saving || !hasDiff" @click="save">
        {{ saving ? 'Сохранение…' : '💾 Создать корректировку' }}
      </button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.form { display: flex; flex-direction: column; gap: 12px; }

.reconcile-info {
  padding: 12px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(56, 189, 248, 0.25);
  display: flex;
  flex-direction: column;
  gap: 6px;

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }
  .k { color: var(--muted); font-weight: 600; }
  .v {
    font-family: var(--mono);
    font-weight: 800;
    color: var(--text);

    &.accent { color: var(--accent); }
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

  input {
    padding: 11px 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    font-family: var(--mono);
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
    outline: none;
    width: 100%;
    background: #ffffff;

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
    }
  }
}

.preview {
  min-height: 0;
}

.preview-ok {
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #16a34a;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}

.preview-diff {
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: var(--text);
  font-size: 13px;
  line-height: 1.5;

  strong {
    font-family: var(--mono);
    color: #b45309;
    font-weight: 800;
    font-size: 15px;
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
}

.btn-save {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: #fff;
  box-shadow: 0 10px 24px -10px rgba(245, 158, 11, 0.7);

  &:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
}
</style>