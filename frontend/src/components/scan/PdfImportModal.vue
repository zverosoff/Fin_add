<script setup>
import { ref, computed, watch } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { fmt } from '@/composables/useFormat';
import { parsePdfFile } from '@/composables/usePdfParser';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const accounts = useAccountsStore();
const txStore = useTransactionsStore();
const auth = useAuthStore();
const toast = useToast();

// Шаги: 'upload' → 'preview'
const step = ref('upload');
const file = ref(null);
const fileName = ref('');
const bankHint = ref('auto');
const detectedBank = ref('');
const loading = ref(false);
const error = ref('');

// Предпросмотр
const items = ref([]);
const selectedIndices = ref(new Set());
const availableMonths = ref([]);

const user = ref(auth.user || 'Сергей');
const accountId = ref('');
const saving = ref(false);

const userAccounts = computed(() =>
  accounts.accounts.filter(a => (a.owner || 'Сергей') === user.value)
);

// Сброс
function reset() {
  step.value = 'upload';
  file.value = null;
  fileName.value = '';
  bankHint.value = 'auto';
  detectedBank.value = '';
  loading.value = false;
  error.value = '';
  items.value = [];
  selectedIndices.value = new Set();
  availableMonths.value = [];
  user.value = auth.user || 'Сергей';
  accountId.value = userAccounts.value[0]?.id || '';
  saving.value = false;
}

watch(() => props.modelValue, (open) => {
  if (open) reset();
});

watch(user, () => {
  const accs = userAccounts.value;
  if (!accs.find(a => a.id === accountId.value)) {
    accountId.value = accs[0]?.id || '';
  }
});

// ============================================================
// Выбор файла
// ============================================================
function onFileSelected(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  if (!f.name.toLowerCase().endsWith('.pdf')) {
    error.value = 'Выберите PDF-файл';
    return;
  }
  file.value = f;
  fileName.value = f.name;
  error.value = '';
}

function triggerFileInput() {
  document.getElementById('pdfFileInput')?.click();
}

// ============================================================
// Разбор
// ============================================================
async function parse() {
  if (!file.value) {
    error.value = 'Сначала выберите PDF';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const { bank, operations } = await parsePdfFile(file.value, bankHint.value);

    console.log('[pdf] банк:', bank, 'операций:', operations.length);

    if (!operations.length) {
      throw new Error('Не удалось найти операции в выписке');
    }

    detectedBank.value = bank;
    items.value = operations;
    selectedIndices.value = new Set(operations.map((_, i) => i));

    // Собираем доступные месяцы
    const monthsMap = new Map();
    for (const op of operations) {
      const d = new Date(op.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthsMap.has(key)) {
        monthsMap.set(key, {
          key,
          year: d.getFullYear(),
          month: d.getMonth(),
          label: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][d.getMonth()] + ' ' + d.getFullYear(),
          count: 0,
          active: true,
        });
      }
      monthsMap.get(key).count++;
    }

    availableMonths.value = Array.from(monthsMap.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    step.value = 'preview';
    toast.success(`📄 Найдено ${operations.length} операций`);
  } catch (e) {
    console.error('[pdf] ошибка:', e);
    error.value = e.message || 'Ошибка разбора PDF';
  } finally {
    loading.value = false;
  }
}

// ============================================================
// Фильтр по месяцам
// ============================================================
function toggleMonth(key) {
  const m = availableMonths.value.find(x => x.key === key);
  if (!m) return;
  m.active = !m.active;
  availableMonths.value = [...availableMonths.value];
}

const visibleItems = computed(() => {
  const activeKeys = new Set(
    availableMonths.value.filter(m => m.active).map(m => m.key)
  );
  return items.value
    .map((it, i) => ({ ...it, index: i }))
    .filter(it => {
      const d = new Date(it.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return activeKeys.has(key);
    });
});

// ============================================================
// Работа с операциями
// ============================================================
function toggleItem(i) {
  const set = new Set(selectedIndices.value);
  if (set.has(i)) set.delete(i);
  else set.add(i);
  selectedIndices.value = set;
}

function editAmount(i) {
  const cur = items.value[i].amount;
  const next = prompt('Сумма:', cur);
  if (next === null) return;
  const v = parseFloat(String(next).replace(/\s+/g, '').replace(',', '.'));
  if (isFinite(v) && v > 0) {
    items.value[i].amount = v;
    items.value = [...items.value];
  }
}

function editDescription(i) {
  const cur = items.value[i].name;
  const next = prompt('Название:', cur);
  if (next === null) return;
  items.value[i].name = String(next).trim() || cur;
  items.value = [...items.value];
}

function toggleType(i) {
  items.value[i].type = items.value[i].type === 'income' ? 'expense' : 'income';
  items.value = [...items.value];
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ============================================================
// Сохранение
// ============================================================
async function save() {
  const toSave = items.value.filter((_, i) => selectedIndices.value.has(i));
  if (!toSave.length) {
    error.value = 'Ничего не выбрано';
    return;
  }

  saving.value = true;
  error.value = '';

  let added = 0, failed = 0;

  for (const it of toSave) {
    const txData = {
      name: it.name,
      amount: it.amount,
      type: it.type,
      category: it.category || 'Прочее',
      date: it.date,
      user: user.value,
      accountId: accountId.value || null,
      fromPdf: true,
      internalTransfer: false,
    };

    try {
      await txStore.save(txData);
      added++;
    } catch (e) {
      failed++;
      console.warn('[pdf] ошибка сохранения', e);
    }
  }

  saving.value = false;

  if (failed > 0) {
    toast.error(`Добавлено ${added}, ошибок: ${failed}`);
  } else {
    toast.success(`✅ Добавлено ${added} операций`);
  }

  emit('update:modelValue', false);
}

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="📄 Импорт PDF-выписки"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- ШАГ 1. Загрузка -->
    <div v-if="step === 'upload'" class="step">
      <div class="field">
        <label>👤 Кто вносит</label>
        <select v-model="user">
          <option value="Сергей">👨 Сергей</option>
          <option value="Саша">👩 Саша</option>
        </select>
      </div>

      <div class="field">
        <label>💳 Счёт</label>
        <select v-model="accountId">
          <option v-for="acc in userAccounts" :key="acc.id" :value="acc.id">
            {{ acc.name }}
          </option>
        </select>
      </div>

      <div class="field">
        <label>🏦 Банк</label>
        <select v-model="bankHint">
          <option value="auto">🔍 Определить автоматически</option>
          <option value="tbank">🟡 Т-Банк</option>
          <option value="sber">🟢 СберБанк</option>
        </select>
      </div>

      <div class="field">
        <label>📄 PDF-файл выписки</label>
        <input
          id="pdfFileInput"
          type="file"
          accept="application/pdf,.pdf"
          hidden
          @change="onFileSelected"
        />
        <button class="upload-btn" type="button" @click="triggerFileInput">
          <span class="upload-icon">📄</span>
          <span class="upload-text">
            <span class="upload-title">Выбрать PDF</span>
            <span class="upload-sub">Выписка из СберБанк-Онлайн или Т-Банка</span>
          </span>
        </button>
        <div v-if="fileName" class="file-name">✅ {{ fileName }}</div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <div>Разбор PDF…</div>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <!-- ШАГ 2. Предпросмотр -->
    <div v-else-if="step === 'preview'" class="step">
      <!-- Банк -->
      <div class="bank-badge">
        <span>{{ detectedBank === 'sber' ? '🟢 СберБанк' : detectedBank === 'tbank' ? '🟡 Т-Банк' : '🏦' }}</span>
        <span class="count">Найдено: {{ items.length }} операций</span>
      </div>

      <!-- Фильтр по месяцам -->
      <div v-if="availableMonths.length > 1" class="months-bar">
        <span class="label">📅 Месяцы:</span>
        <button
          v-for="m in availableMonths"
          :key="m.key"
          class="month-chip"
          :class="{ active: m.active }"
          @click="toggleMonth(m.key)"
        >
          {{ m.label }}
          <span class="cnt">{{ m.count }}</span>
        </button>
      </div>

      <!-- Список операций -->
      <div class="items-list">
        <div
          v-for="it in visibleItems"
          :key="it.index"
          class="item-row"
          :class="{ selected: selectedIndices.has(it.index) }"
        >
          <input
            type="checkbox"
            :checked="selectedIndices.has(it.index)"
            @change="toggleItem(it.index)"
          />

          <div class="item-desc">
            <span class="date">{{ formatDate(it.date) }}</span>
            <span class="name" @click="editDescription(it.index)">{{ it.name }}</span>
          </div>

          <div
            class="type-badge"
            :class="it.type"
            @click="toggleType(it.index)"
          >
            {{ it.type === 'income' ? '📈' : '📉' }}
          </div>

          <div class="amount" :class="it.type" @click="editAmount(it.index)">
            {{ it.type === 'income' ? '+' : '−' }} {{ fmt(it.amount) }} ₽
          </div>
        </div>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <template #footer>
      <template v-if="step === 'upload'">
        <button class="btn-cancel" @click="close">Отмена</button>
        <button class="btn-save" :disabled="!file || loading" @click="parse">
          {{ loading ? 'Разбор…' : '🔍 Разобрать' }}
        </button>
      </template>

      <template v-else-if="step === 'preview'">
        <button class="btn-cancel" @click="step = 'upload'">← Назад</button>
        <button class="btn-save" :disabled="saving" @click="save">
          {{ saving ? 'Сохранение…' : '✅ Добавить выбранные' }}
        </button>
      </template>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.step { display: flex; flex-direction: column; gap: 12px; }

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

.upload-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px 18px;
  border-radius: 14px;
  border: 2px dashed rgba(56, 189, 248, 0.4);
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(139, 92, 246, 0.06));
  color: var(--text);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;

  &:hover {
    border-color: var(--accent);
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.14), rgba(139, 92, 246, 0.1));
  }
}

.upload-icon {
  font-size: 32px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(139, 92, 246, 0.12));
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.upload-text { display: flex; flex-direction: column; gap: 2px; }

.upload-title {
  font-size: 15px;
  font-weight: 700;
}

.upload-sub {
  font-size: 11.5px;
  color: var(--muted);
}

.file-name {
  margin-top: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #22c55e;
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  color: var(--muted);
  font-size: 13px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(56, 189, 248, 0.2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.bank-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(56, 189, 248, 0.25);
  font-size: 13px;
  font-weight: 700;

  .count {
    color: var(--muted);
    font-weight: 600;
    font-size: 12px;
  }
}

.months-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.06);

  .label {
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    margin-right: 4px;
  }
}

.month-chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: #f8fafc;
  color: var(--muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  &.active {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: #fff;
    border-color: transparent;
  }

  .cnt {
    margin-left: 4px;
    opacity: 0.8;
    font-size: 10px;
  }
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 45vh;
  overflow-y: auto;
  padding-right: 4px;
}

.item-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: #ffffff;
  transition: border-color 0.15s;

  &.selected { border-color: var(--accent); }
}

.item-desc {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  .date {
    font-size: 10.5px;
    color: var(--accent);
    font-weight: 700;
    text-transform: uppercase;
  }

  .name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;

    &:hover { color: var(--accent); }
  }
}

.type-badge {
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;

  &.income { background: rgba(34, 197, 94, 0.15); }
  &.expense { background: rgba(239, 68, 68, 0.15); }
}

.amount {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;

  &.income { color: #16a34a; }
  &.expense { color: #dc2626; }
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

  &:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
}
</style>