<script setup>
import { ref, computed, watch } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useToast } from '@/composables/useToast';
import { notifySaved, notifyError } from '@/composables/useDataStatus';
// ✅ Импорт из composables с относительным путем
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, normalizeCategory } from '../../composables/useCategories';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  tx: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'saved']);

const accounts = useAccountsStore();
const txStore = useTransactionsStore();
const toast = useToast();

const ICON_EDIT      = '/img/icons/ui/edit.png';
const ICON_EXPENSE   = '/img/icons/categories/expense.png';
const ICON_INCOME    = '/img/icons/categories/income.png';
const ICON_NOTE      = '/img/icons/ui/note.png';
const ICON_MONEY_BAG = '/img/icons/nav/money-bag.png';
const ICON_FOLDER    = '/img/icons/ui/folder.png';
const ICON_CALENDAR  = '/img/icons/ui/calendar.png';
const ICON_USER      = '/img/icons/ui/user.png';
const ICON_CARD      = '/img/icons/banks/default.png';
const ICON_SAVE      = '/img/icons/ui/save.png';

const form = ref({
  type: 'expense',
  name: '',
  amount: '',
  category: 'Прочее',
  date: '',
  user: 'Сергей',
  accountId: '',
});

const error = ref('');
const saving = ref(false);

// ✅ Категории — из единого источника
const categories = computed(() =>
  form.value.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
);

const userAccounts = computed(() =>
  accounts.accounts.filter(a => (a.owner || 'Сергей') === form.value.user)
);

watch(() => [props.modelValue, props.tx], ([open, t]) => {
  if (!open || !t) return;

  const d = new Date(t.date);
  form.value = {
    type: t.type || 'expense',
    name: t.name || '',
    amount: String(t.amount || ''),
    // ✅ Нормализуем категорию из старой записи под актуальный список
    category: normalizeCategory(t.category, t.type || 'expense'),
    date: !isNaN(d.getTime())
      ? d.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    user: t.user || 'Сергей',
    accountId: t.accountId || '',
  };
  error.value = '';
}, { immediate: true });

watch(() => form.value.type, (newType, oldType) => {
  if (newType === oldType) return;
  const list = newType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (!list.includes(form.value.category)) {
    form.value.category = 'Прочее';
  }
});

watch(() => form.value.user, () => {
  const accs = userAccounts.value;
  if (!accs.find(a => a.id === form.value.accountId)) {
    form.value.accountId = accs.length ? accs[0].id : '';
  }
});

async function save() {
  error.value = '';

  const name = form.value.name.trim();
  const amount = parseFloat(form.value.amount);

  if (!name || name.length < 2) {
    error.value = 'Введите название (минимум 2 символа)';
    return;
  }
  if (!isFinite(amount) || amount <= 0) {
    error.value = 'Введите сумму больше 0';
    return;
  }

  const d = new Date(form.value.date + 'T12:00:00');
  if (isNaN(d.getTime())) {
    error.value = 'Некорректная дата';
    return;
  }

  const updated = {
    ...props.tx,
    name,
    amount,
    type: form.value.type,
    // ✅ Финальная страховка перед сохранением
    category: normalizeCategory(form.value.category, form.value.type),
    date: d.toISOString(),
    user: form.value.user,
    accountId: form.value.accountId || null,
    editedManually: true,
  };

  saving.value = true;
  try {
    await txStore.save(updated);
    notifySaved();
    toast.success('💾 Сохранено');
    emit('update:modelValue', false);
    emit('saved');
  } catch (e) {
    notifyError(e.message);
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
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="modal-head-custom">
        <img :src="ICON_EDIT" class="mhc-icon" alt="Редактировать" />
        <h3 class="mhc-title">Редактировать операцию</h3>
      </div>
    </template>

    <div class="form">
      <div class="field">
        <label>Тип</label>
        <div class="type-switch">
          <button
            type="button"
            :class="{ active: form.type === 'expense' }"
            @click="form.type = 'expense'"
          >
            <img :src="ICON_EXPENSE" class="switch-icon" alt="Расход" />
            <span>Расход</span>
          </button>
          <button
            type="button"
            :class="{ active: form.type === 'income' }"
            @click="form.type = 'income'"
          >
            <img :src="ICON_INCOME" class="switch-icon" alt="Доход" />
            <span>Доход</span>
          </button>
        </div>
      </div>

      <div class="field">
        <label>
          <img :src="ICON_NOTE" class="label-icon" alt="" />
          Название
        </label>
        <input v-model="form.name" type="text" autocomplete="off" />
      </div>

      <div class="field">
        <label>
          <img :src="ICON_MONEY_BAG" class="label-icon" alt="" />
          Сумма, ₽
        </label>
        <input
          v-model="form.amount"
          type="number"
          step="0.01"
          min="0"
          inputmode="decimal"
        />
      </div>

      <div class="field">
        <label>
          <img :src="ICON_FOLDER" class="label-icon" alt="" />
          Категория
        </label>
        <select v-model="form.category">
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <div class="row">
        <div class="field">
          <label>
            <img :src="ICON_CALENDAR" class="label-icon" alt="" />
            Дата
          </label>
          <input v-model="form.date" type="date" />
        </div>
        <div class="field">
          <label>
            <img :src="ICON_USER" class="label-icon" alt="" />
            Кто вносит
          </label>
          <select v-model="form.user">
            <option value="Сергей">👨 Сергей</option>
            <option value="Саша">👩 Саша</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label>
          <img :src="ICON_CARD" class="label-icon" alt="" />
          Счёт
        </label>
        <select v-model="form.accountId">
          <option v-for="acc in userAccounts" :key="acc.id" :value="acc.id">
            {{ acc.name }}
          </option>
        </select>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <template #footer>
      <button class="btn-cancel" type="button" @click="close">Отмена</button>
      <button class="btn-save" type="button" :disabled="saving" @click="save">
        <img v-if="!saving" :src="ICON_SAVE" class="btn-save-icon" alt="" />
        <span>{{ saving ? 'Сохранение…' : 'Сохранить' }}</span>
      </button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.modal-head-custom {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.mhc-icon {
  display: block;
  width: 26px;
  height: 26px;
  min-width: 26px;
  max-width: 26px;
  max-height: 26px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.mhc-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;

  label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  input,
  select {
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: 9px;
    font-family: inherit;
    font-size: 14px;
    outline: none;
    background: var(--panel-2);
    color: var(--text);
    width: 100%;
    transition: border-color 0.15s, box-shadow 0.15s;

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
    }
  }

  input::placeholder {
    color: var(--muted);
    opacity: 0.6;
  }
}

.label-icon {
  display: block;
  width: 13px;
  height: 13px;
  object-fit: contain;
  flex-shrink: 0;
  opacity: 0.8;
}

.type-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  padding: 3px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 8px;
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
      color: #fff;
      box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.25);
    }

    &:first-child.active {
      background: var(--grad-expense, linear-gradient(135deg, #f87171, #dc2626));
    }

    &:last-child.active {
      background: var(--grad-income, linear-gradient(135deg, #4ade80, #16a34a));
    }
  }
}

.switch-icon {
  display: block;
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));

  .active & {
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.5)) brightness(1.2);
  }
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.error-msg {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.3);
  color: var(--danger, #e11d48);
  font-size: 12.5px;
  font-weight: 600;
}

.btn-cancel,
.btn-save {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

  &:hover {
    border-color: var(--border-strong, #cbd5e1);
  }
}

.btn-save {
  background: var(--grad-primary, linear-gradient(135deg, #8b5cf6, #6366f1));
  color: #fff;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 -2px 0 rgba(0, 0, 0, 0.15) inset,
    0 6px 18px -6px rgba(139, 92, 246, 0.7);
  transition: all 0.15s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  &:not(:disabled):hover {
    transform: translateY(-1px);
  }
}

.btn-save-icon {
  display: block;
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
}
</style>