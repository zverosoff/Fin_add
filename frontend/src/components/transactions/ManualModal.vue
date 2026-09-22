<script setup>
import { ref, computed, watch } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { fmt } from '@/composables/useFormat';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const accounts = useAccountsStore();
const tx = useTransactionsStore();
const auth = useAuthStore();
const toast = useToast();

// ============================================================
// Состояние формы
// ============================================================

const form = ref({
  type: 'expense',
  name: '',
  amount: '',
  category: 'Прочее',
  date: new Date().toISOString().split('T')[0],
  user: auth.user || 'Сергей',
  accountId: '',
});

const error = ref('');
const saving = ref(false);

// Категории
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

// Счета, доступные выбранному пользователю
const userAccounts = computed(() =>
  accounts.accounts.filter(a => (a.owner || 'Сергей') === form.value.user)
);

// ============================================================
// Реактивные эффекты
// ============================================================

// При смене типа — сбросить категорию
watch(() => form.value.type, () => {
  form.value.category = 'Прочее';
});

// При смене пользователя — обновить список счетов и выбрать первый
watch(() => form.value.user, () => {
  const accs = userAccounts.value;
  form.value.accountId = accs.length ? accs[0].id : '';
}, { immediate: true });

// При открытии модалки — сбросить форму
watch(() => props.modelValue, (val) => {
  if (val) {
    form.value = {
      type: 'expense',
      name: '',
      amount: '',
      category: 'Прочее',
      date: new Date().toISOString().split('T')[0],
      user: auth.user || 'Сергей',
      accountId: '',
    };
    error.value = '';
    // Триггерим watch для правильного выбора счёта
    const accs = accounts.accounts.filter(a => (a.owner || 'Сергей') === form.value.user);
    form.value.accountId = accs.length ? accs[0].id : '';
  }
});

// ============================================================
// Автокатегоризация (простая)
// ============================================================

const CATEGORY_HINTS = [
  { re: /магнит|пятёрочк|пятерочк|перекресток|лента|ашан|дикси|продукт/i, cat: 'Продукты' },
  { re: /кафе|ресторан|кофе|starbucks|mcdonald|kfc|пицц|суши/i, cat: 'Кафе и рестораны' },
  { re: /такси|taxi|яндекс\s*go|uber|ситимобил/i, cat: 'Такси' },
  { re: /бензин|азс|заправк|газпромнефт|лукойл|роснефт/i, cat: 'Бензин' },
  { re: /аптек|aptek|горздрав/i, cat: 'Аптека' },
  { re: /мтс|билайн|мегафон|теле2|интернет|ростелеком/i, cat: 'Интернет и связь' },
  { re: /кэшбэк|cashback|спасибо/i, cat: 'Кэшбэк' },
  { re: /возврат|refund/i, cat: 'Возврат' },
  { re: /зарплат|salary|аванс/i, cat: 'Зарплата' },
  { re: /подписк|netflix|spotify|яндекс\s*плюс|ivi|okko/i, cat: 'Подписки' },
];

watch(() => form.value.name, (name) => {
  if (!name || name.length < 3) return;
  for (const hint of CATEGORY_HINTS) {
    if (hint.re.test(name)) {
      form.value.category = hint.cat;
      return;
    }
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

  const txData = {
    name,
    amount,
    type: form.value.type,
    category: form.value.category,
    date: d.toISOString(),
    user: form.value.user,
    accountId: form.value.accountId || null,
    fromManual: true,
    internalTransfer: false,
  };

  saving.value = true;
  try {
    await tx.save(txData);
    toast.success(`✅ Добавлено: ${name} — ${fmt(amount)} ₽`);
    emit('update:modelValue', false);
  } catch (e) {
    error.value = e.response?.data?.error || e.message || 'Ошибка сохранения';
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
    title="➕ Новая операция"
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
        <input
          v-model="form.name"
          type="text"
          placeholder="Например, Магнит"
          autocomplete="off"
        />
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
          placeholder="0"
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

    <template #footer>
      <button class="btn-cancel" @click="close">Отмена</button>
      <button class="btn-save" :disabled="saving" @click="save">
        {{ saving ? 'Сохранение…' : '💾 Добавить' }}
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
    transition: all 0.15s;
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
  transition: all 0.15s;
  border: 1px solid transparent;
}

.btn-cancel {
  background: #f1f5f9;
  color: var(--text);
  border-color: var(--border);

  &:hover {
    background: #e2e8f0;
  }
}

.btn-save {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  box-shadow: 0 10px 24px -10px rgba(59, 130, 246, 0.7);

  &:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  &:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 30px -10px rgba(59, 130, 246, 0.9);
  }
}

/* Мобильная версия */
@media (max-width: 500px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>