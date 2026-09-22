<script setup>
import { ref, computed, watch } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { fmt } from '@/composables/useFormat';
import { preprocessImage, recognizeText, parseReceipt } from '@/composables/useReceiptOCR';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const accounts = useAccountsStore();
const txStore = useTransactionsStore();
const auth = useAuthStore();
const toast = useToast();

// Шаги: 'upload' → 'recognizing' → 'preview'
const step = ref('upload');
const file = ref(null);
const filePreview = ref('');
const progress = ref(0);
const statusText = ref('');

// Предпросмотр операций
const items = ref([]);
const selectedIndices = ref(new Set());

const user = ref(auth.user || 'Сергей');
const accountId = ref('');
const manualDate = ref(new Date().toISOString().split('T')[0]);

const error = ref('');
const saving = ref(false);

// ============================================================
// Счета выбранного пользователя
// ============================================================
const userAccounts = computed(() =>
  accounts.accounts.filter(a => (a.owner || 'Сергей') === user.value)
);

// ============================================================
// Сброс формы при открытии
// ============================================================
function reset() {
  step.value = 'upload';
  file.value = null;
  filePreview.value = '';
  progress.value = 0;
  statusText.value = '';
  items.value = [];
  selectedIndices.value = new Set();
  user.value = auth.user || 'Сергей';
  accountId.value = userAccounts.value[0]?.id || '';
  manualDate.value = new Date().toISOString().split('T')[0];
  error.value = '';
  saving.value = false;
}

watch(() => props.modelValue, (open) => {
  if (open) reset();
});

// При смене пользователя — обновить список счетов
watch(user, () => {
  const accs = userAccounts.value;
  if (!accs.find(a => a.id === accountId.value)) {
    accountId.value = accs[0]?.id || '';
  }
});

// ============================================================
// Загрузка файла
// ============================================================
function onFileSelected(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  file.value = f;
  filePreview.value = URL.createObjectURL(f);
  error.value = '';
}

function triggerFileInput() {
  document.getElementById('scanFileInput')?.click();
}

// ============================================================
// Распознавание
// ============================================================
async function recognize() {
  if (!file.value) {
    error.value = 'Сначала выберите фото';
    return;
  }

  step.value = 'recognizing';
  progress.value = 0;
  statusText.value = 'Подготовка изображения…';
  error.value = '';

  try {
    // Предобработка
    const processed = await preprocessImage(file.value);
    statusText.value = 'Загрузка модели OCR…';
    progress.value = 5;

    // Распознавание
    const lines = await recognizeText(processed, (pct) => {
      progress.value = pct;
      statusText.value = `Распознавание: ${pct}%`;
    });

    if (!lines.length) {
      throw new Error('Не удалось распознать текст на фото');
    }

    console.log('[scan] распознанные строки:', lines);

    // Парсер
    const parsed = parseReceipt(lines);
    console.log('[scan] разобранные операции:', parsed);

    if (!parsed.length) {
      throw new Error('Не найдено операций в чеке');
    }

    // Применяем дату из формы ко всем
    const dateObj = new Date(manualDate.value + 'T12:00:00');
    for (const it of parsed) {
      it.date = dateObj.toISOString();
    }

    items.value = parsed;
    selectedIndices.value = new Set(parsed.map((_, i) => i));

    step.value = 'preview';
    toast.success(`📸 Найдено ${parsed.length} операций`);
  } catch (e) {
    console.error('[scan] ошибка:', e);
    error.value = e.message || 'Ошибка распознавания';
    step.value = 'upload';
  }
}

// ============================================================
// Работа с предпросмотром
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
  const cur = items.value[i].description;
  const next = prompt('Название:', cur);
  if (next === null) return;
  items.value[i].description = String(next).trim() || cur;
  items.value = [...items.value];
}

function toggleType(i) {
  items.value[i].type = items.value[i].type === 'income' ? 'expense' : 'income';
  items.value = [...items.value];
}

function applyDateToAll() {
  const dateObj = new Date(manualDate.value + 'T12:00:00');
  for (const it of items.value) {
    it.date = dateObj.toISOString();
  }
  items.value = [...items.value];
  toast.info('📅 Дата применена ко всем');
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
      name: it.description,
      amount: it.amount,
      type: it.type,
      category: it.category || 'Прочее',
      date: it.date,
      user: user.value,
      accountId: accountId.value || null,
      fromScan: true,
      internalTransfer: false,
    };

    try {
      await txStore.save(txData);
      added++;
    } catch (e) {
      failed++;
      console.warn('[scan] ошибка сохранения', e);
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
    title="📸 Сканирование чека"
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
        <label>📅 Дата (по умолчанию)</label>
        <input v-model="manualDate" type="date" />
      </div>

      <div class="field">
        <label>📷 Фото чека</label>
        <input
          id="scanFileInput"
          type="file"
          accept="image/*"
          hidden
          @change="onFileSelected"
        />
        <button class="upload-btn" type="button" @click="triggerFileInput">
          <span class="upload-icon">📷</span>
          <span class="upload-text">
            <span class="upload-title">Выбрать фото</span>
            <span class="upload-sub">JPG, PNG · или сделать снимок</span>
          </span>
        </button>
      </div>

      <div v-if="filePreview" class="preview">
        <img :src="filePreview" alt="preview" />
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <!-- ШАГ 2. Распознавание -->
    <div v-else-if="step === 'recognizing'" class="step">
      <div class="recognize">
        <div class="spinner"></div>
        <div class="status">{{ statusText }}</div>
        <div class="progress">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
        <div class="progress-pct">{{ progress }}%</div>
      </div>
    </div>

    <!-- ШАГ 3. Предпросмотр -->
    <div v-else-if="step === 'preview'" class="step">
      <div class="bulk-bar">
        <label>📅 Применить дату:</label>
        <input v-model="manualDate" type="date" class="bulk-input" />
        <button class="bulk-btn" @click="applyDateToAll">Применить</button>
      </div>

      <div class="items-list">
        <div
          v-for="(it, i) in items"
          :key="i"
          class="item-row"
          :class="{ selected: selectedIndices.has(i) }"
        >
          <input
            type="checkbox"
            :checked="selectedIndices.has(i)"
            @change="toggleItem(i)"
          />

          <div class="item-desc">
            <span class="date" @click="applyDateToAll">{{ formatDate(it.date) }}</span>
            <span
              class="name"
              @click="editDescription(i)"
              :title="it.description"
            >{{ it.description }}</span>
          </div>

          <div
            class="type-badge"
            :class="it.type"
            @click="toggleType(i)"
          >
            {{ it.type === 'income' ? '📈' : '📉' }}
          </div>

          <div class="amount" :class="it.type" @click="editAmount(i)">
            {{ it.type === 'income' ? '+' : '−' }} {{ fmt(it.amount) }} ₽
          </div>
        </div>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <template #footer>
      <template v-if="step === 'upload'">
        <button class="btn-cancel" @click="close">Отмена</button>
        <button class="btn-save" :disabled="!file" @click="recognize">
          🔍 Распознать
        </button>
      </template>

      <template v-else-if="step === 'recognizing'">
        <button class="btn-cancel" @click="step = 'upload'">← Назад</button>
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

.preview {
  margin-top: 8px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  max-height: 30vh;
  display: flex;
  justify-content: center;
  background: #f8fafc;

  img {
    max-width: 100%;
    max-height: 30vh;
    object-fit: contain;
  }
}

/* Распознавание */
.recognize {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 30px 20px;
  text-align: center;
}

.spinner {
  width: 44px;
  height: 44px;
  border: 4px solid rgba(56, 189, 248, 0.2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status {
  font-size: 14px;
  color: var(--text);
  font-weight: 600;
}

.progress {
  width: 100%;
  max-width: 300px;
  height: 8px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.15);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #8b5cf6);
  border-radius: 4px;
  transition: width 0.3s;
}

.progress-pct {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--muted);
}

/* Предпросмотр */
.bulk-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(56, 189, 248, 0.25);
  flex-wrap: wrap;

  label {
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
  }
}

.bulk-input {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: inherit;
  font-size: 13px;
  flex: 1;
  min-width: 100px;
}

.bulk-btn {
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
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
    cursor: pointer;
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