<script setup>
import { ref, computed, watch } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useToast } from '@/composables/useToast';
import { notifySaved, notifyError } from '@/composables/useDataStatus';  
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  tx: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'saved']);

const accounts = useAccountsStore();
const txStore = useTransactionsStore();
const toast = useToast();

// ============================================================
// Форма
// ============================================================
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

// ============================================================
// Категории
// ============================================================
const INCOME_CATEGORIES = [
  'Зарплата', 'Аванс', 'Премия', 'Фриланс', 'Бизнес',
  'Инвестиции', 'Дивиденды', 'Проценты по вкладу', 'Кэшбэк',
  'Возврат', 'Подарки', 'Аренда', 'Перевод от', 'Прочее',
];

const EXPENSE_CATEGORIES = [
  'Продукты', 'Кафе и рестораны', 'Такси', 'Бензин',
  'Общественный транспорт', 'Аренда', 'Ипотека', 'Жильё',
  'Коммунальные', 'Интернет и связь', 'Развлечения', 'Подписки',
  'Покупки', 'Одежда и обувь', 'Техника', 'Аптека', 'Здоровье',
  'Спорт', 'Красота', 'Образование', 'Дети', 'Домашние животные',
  'Путешествия', 'Кредиты', 'Страхование', 'Налоги', 'Ремонт',
  'Автомобиль', 'Гараж', 'Сад и огород', 'Подарки',
  'Благотворительность', 'Прочее',
];

const categories = computed(() =>
  form.value.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
);

const userAccounts = computed(() =>
  accounts.accounts.filter(a => (a.owner || 'Сергей') === form.value.user)
);

// ============================================================
// Заполнение формы при открытии
// ============================================================
watch(() => [props.modelValue, props.tx], ([open, t]) => {
  if (!open || !t) return;

  const d = new Date(t.date);
  form.value = {
    type: t.type || 'expense',
    name: t.name || '',
    amount: String(t.amount || ''),
    category: t.category || 'Прочее',
    date: !isNaN(d.getTime())
      ? d.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    user: t.user || 'Сергей',
    accountId: t.accountId || '',
  };
  error.value = '';
}, { immediate: true });

// При смене типа — сбросить категорию если не подходит
watch(() => form.value.type, (newType, oldType) => {
  if (newType === oldType) return;
  const list = newType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (!list.includes(form.value.category)) {
    form.value.category = 'Прочее';
  }
});

// При смене пользователя — обновить счёт
watch(() => form.value.user, () => {
  const accs = userAccounts.value;
  if (!accs.find(a => a.id === form.value.accountId)) {
    form.value.accountId = accs.length ? accs[0].id : '';
  }
});

// ============================================================
// Сохранение
// ============================================================
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
    category: form.value.category,
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
    title="✏️ Редактировать операцию"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="form">
      <!-- Тип -->
      <div class="field">
        <label>Тип</label>
        <div class="type-switch">
          <button
            type="button"
            :class="{ active: form.type === 'expense' }"
            @click="form.type = 'expense'"
          >📉 Расход</button>
          <button
            type="button"
            :class="{ active: form.type === 'income' }"
            @click="form.type = 'income'"
          >📈 Доход</button>
        </div>
      </div>

      <!-- Название -->
      <div class="field">
        <label>📝 Название</label>
        <input v-model="form.name" type="text" autocomplete="off" />
      </div>

      <!-- Сумма -->
      <div class="field">
        <label>💰 Сумма, ₽</label>
        <input
          v-model="form.amount"
          type="number"
          step="0.01"
          min="0"
          inputmode="decimal"
        />
      </div>

      <!-- Категория -->
      <div class="field">
        <label>📁 Категория</label>
        <select v-model="form.category">
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <!-- Дата + Кто -->
      <div class="row">
        <div class="field">
          <label>📅 Дата</label>
          <input v-model="form.date" type="date" />
        </div>
        <div class="field">
          <label>👤 Кто вносит</label>
          <select v-model="form.user">
            <option value="Сергей">👨 Сергей</option>
            <option value="Саша">👩 Саша</option>
          </select>
        </div>
      </div>

      <!-- Счёт -->
      <div class="field">
        <label>💳 Счёт</label>
        <select v-model="form.accountId">
          <option v-for="acc in userAccounts" :key="acc.id" :value="acc.id">
            {{ acc.name }}
          </option>
        </select>
      </div>

      <!-- Ошибка -->
      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <!-- Футер с кнопками -->
    <template #footer>
      <button class="btn-cancel" type="button" @click="close">Отмена</button>
      <button class="btn-save" type="button" :disabled="saving" @click="save">
        {{ saving ? 'Сохранение…' : '💾 Сохранить' }}
      </button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
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

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.type-switch {
  display: inline-flex;
  gap: 0;
  padding: 3px;
  background: #f1f5f9;
  border-radius: 10px;

  button {
    flex: 1;
    padding: 8px 14px;
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
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #fff;
      box-shadow: 0 4px 12px -4px rgba(59, 130, 246, 0.6);
    }
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
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  box-shadow: 0 10px 24px -10px rgba(59, 130, 246, 0.7);

  &:disabled { opacity: 0.5; cursor: wait; }

  &:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 30px -10px rgba(59, 130, 246, 0.9);
  }
}

/* Мобильная версия */
@media (max-width: 700px) {
  .row {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}
</style>