<script setup>
import { ref, computed, watch } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { fmt } from '@/composables/useFormat';
import {
  preprocessImage,
  recognizeText,
  parseReceipt,
  findFirstDateY,
} from '@/composables/useReceiptOCR';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'switch-to-manual', 'switch-to-pdf']);

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

const items = ref([]);
const selectedIndices = ref(new Set());

// ✅ Фильтр по датам
const dateFilters = ref([]);

// ✅ Своя дата
const manualDate = ref(new Date().toISOString().split('T')[0]);
const showManualDate = ref(false);

// ✅ Y-координата обрезки (в исходном изображении)
const cropY = ref(null);           // null | number
const cropYPercent = ref(null);    // для CSS-разметки (0-100)
const originalImageSize = ref({ w: 0, h: 0 });

const user = ref(auth.user || 'Сергей');
const accountId = ref('');

const error = ref('');
const saving = ref(false);

// ============================================================
// Переключение режима
// ============================================================
function switchToManual() {
  emit('update:modelValue', false);
  emit('switch-to-manual');
}

function switchToPdf() {
  emit('update:modelValue', false);
  emit('switch-to-pdf');
}

// ============================================================
// Счета выбранного пользователя
// ============================================================
const userAccounts = computed(() =>
  accounts.accounts.filter(a => (a.owner || 'Сергей') === user.value)
);

// ============================================================
// Сброс
// ============================================================
function reset() {
  step.value = 'upload';
  file.value = null;
  filePreview.value = '';
  progress.value = 0;
  statusText.value = '';
  items.value = [];
  selectedIndices.value = new Set();
  dateFilters.value = [];
  user.value = auth.user || 'Сергей';
  accountId.value = userAccounts.value[0]?.id || '';
  manualDate.value = new Date().toISOString().split('T')[0];
  showManualDate.value = false;
  error.value = '';
  saving.value = false;
  cropY.value = null;
  cropYPercent.value = null;
  originalImageSize.value = { w: 0, h: 0 };
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
// Загрузка файла
// ============================================================
function onFileSelected(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  file.value = f;
  filePreview.value = URL.createObjectURL(f);
  error.value = '';

  // Запоминаем размеры исходного изображения
  const img = new Image();
  img.onload = () => {
    originalImageSize.value = { w: img.width, h: img.height };
  };
  img.src = filePreview.value;
}

function triggerFileInput() {
  document.getElementById('scanFileInput')?.click();
}

// ============================================================
// Группировка дат для фильтра
// ============================================================
function buildDateFilters(parsedItems) {
  const map = new Map();

  for (const it of parsedItems) {
    const d = new Date(it.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        date: d,
        label: formatDateLabel(d),
        count: 0,
        active: true,
      });
    }
    map.get(key).count++;
  }

  return Array.from(map.values()).sort((a, b) => b.date - a.date);
}

function formatDateLabel(d) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cmp = new Date(d);
  cmp.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today - cmp) / (24 * 60 * 60 * 1000));

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');

  if (diffDays === 0) return `Сегодня ${dd}.${mm}`;
  if (diffDays === 1) return `Вчера ${dd}.${mm}`;
  if (diffDays === 2) return `Позавчера ${dd}.${mm}`;
  return `${dd}.${mm}`;
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
    const processed = await preprocessImage(file.value);
    statusText.value = 'Загрузка модели OCR…';
    progress.value = 5;

    // ✅ recognizeText теперь возвращает { lines, imageWidth, imageHeight }
    const result = await recognizeText(processed, (pct) => {
      progress.value = pct;
      statusText.value = `Распознавание: ${pct}%`;
    });

    const textLines = result.lines;

    if (!textLines.length) {
      throw new Error('Не удалось распознать текст на фото');
    }

    // ✅ Ищем Y первой даты для визуальной разметки
    const firstDateY = findFirstDateY(textLines);
    if (firstDateY !== null && originalImageSize.value.h > 0) {
      // bbox в исходном изображении был в 2x масштабе (scale = 2 в preprocessImage)
      const y = firstDateY / 2;
      cropY.value = y;
      cropYPercent.value = (y / originalImageSize.value.h) * 100;
    } else {
      cropY.value = null;
      cropYPercent.value = null;
    }

    const parsed = parseReceipt(textLines);

    if (!parsed.length) {
      throw new Error('Не найдено операций в чеке');
    }

    items.value = parsed;
    selectedIndices.value = new Set(parsed.map((_, i) => i));
    dateFilters.value = buildDateFilters(parsed);

    step.value = 'preview';
    toast.success(`📸 Найдено ${parsed.length} операций`);
  } catch (e) {
    console.error('[scan] ошибка:', e);
    error.value = e.message || 'Ошибка распознавания';
    step.value = 'upload';
  }
}

// ============================================================
// Фильтр по датам
// ============================================================
function toggleDateFilter(key) {
  const f = dateFilters.value.find(x => x.key === key);
  if (!f) return;
  f.active = !f.active;
  dateFilters.value = [...dateFilters.value];
}

function enableAllDates() {
  dateFilters.value.forEach(f => { f.active = true; });
  dateFilters.value = [...dateFilters.value];
}

function disableAllDates() {
  dateFilters.value.forEach(f => { f.active = false; });
  dateFilters.value = [...dateFilters.value];
}

function applyManualDate() {
  const d = new Date(manualDate.value + 'T12:00:00');
  if (isNaN(d.getTime())) {
    error.value = 'Некорректная дата';
    return;
  }

  for (const it of items.value) {
    it.date = d.toISOString();
  }
  items.value = [...items.value];

  dateFilters.value = buildDateFilters(items.value);

  showManualDate.value = false;
  toast.info('📅 Дата применена ко всем операциям');
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

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const visibleItems = computed(() => {
  const activeKeys = new Set(
    dateFilters.value.filter(f => f.active).map(f => f.key)
  );

  return items.value
    .map((it, i) => ({ ...it, index: i }))
    .filter(it => {
      const d = new Date(it.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return activeKeys.has(key);
    });
});

const selectedCount = computed(() =>
  visibleItems.value.filter(it => selectedIndices.value.has(it.index)).length
);

function selectAllVisible() {
  const set = new Set(selectedIndices.value);
  for (const it of visibleItems.value) set.add(it.index);
  selectedIndices.value = set;
}

function deselectAllVisible() {
  const set = new Set(selectedIndices.value);
  for (const it of visibleItems.value) set.delete(it.index);
  selectedIndices.value = set;
}

// ============================================================
// Сохранение
// ============================================================
async function save() {
  const activeKeys = new Set(
    dateFilters.value.filter(f => f.active).map(f => f.key)
  );

  const toSave = items.value.filter((it, i) => {
    if (!selectedIndices.value.has(i)) return false;
    const d = new Date(it.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return activeKeys.has(key);
  });

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
    <!-- Переключатель режима -->
    <div class="mode-switch">
      <button type="button" class="mode active" disabled>📸 Чек</button>
      <button type="button" class="mode" @click="switchToManual">✏️ Вручную</button>
      <button type="button" class="mode" @click="switchToPdf">📄 PDF</button>
    </div>

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
        <label>📷 Фото чека / скриншот</label>
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
            <span class="upload-title">Выбрать файл</span>
            <span class="upload-sub">JPG, PNG · скриншот или фото</span>
          </span>
        </button>
        <div class="hint">
          💡 Совет: обрежьте скриншот так, чтобы в кадр попал только список операций
        </div>
      </div>

      <div v-if="filePreview" class="preview-wrapper">
        <div class="preview">
          <img :src="filePreview" alt="preview" />

          <!-- ✅ Красная линия — граница обрезки (если определена) -->
          <div
            v-if="cropYPercent !== null"
            class="crop-line"
            :style="{ top: cropYPercent + '%' }"
          >
            <span class="crop-line-label">До этой линии — распознаётся</span>
          </div>
        </div>
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
      <!-- ✅ Мини-превью с линией обрезки -->
      <div v-if="filePreview && cropYPercent !== null" class="mini-preview">
        <img :src="filePreview" alt="cropped" />
        <div class="mini-crop-line" :style="{ top: cropYPercent + '%' }"></div>
        <div class="mini-crop-label">↑ Шапка отсечена, ниже — операции</div>
      </div>

      <!-- Фильтр по датам -->
      <div v-if="dateFilters.length > 0" class="dates-bar">
        <div class="dates-label">
          <span>📅 Даты:</span>
          <button
            type="button"
            class="dates-toggle-mini"
            @click="dateFilters.every(f => f.active) ? disableAllDates() : enableAllDates()"
          >
            {{ dateFilters.every(f => f.active) ? 'Снять все' : 'Выбрать все' }}
          </button>
        </div>

        <div class="dates-chips">
          <button
            v-for="f in dateFilters"
            :key="f.key"
            type="button"
            class="date-chip"
            :class="{ active: f.active }"
            @click="toggleDateFilter(f.key)"
          >
            <span class="date-chip-label">{{ f.label }}</span>
            <span class="date-chip-count">{{ f.count }}</span>
          </button>

          <button
            type="button"
            class="date-chip manual"
            :class="{ active: showManualDate }"
            @click="showManualDate = !showManualDate"
          >
            📅 Своя дата
          </button>
        </div>

        <div v-if="showManualDate" class="manual-date-row">
          <input v-model="manualDate" type="date" class="manual-date-input" />
          <button type="button" class="manual-date-apply" @click="applyManualDate">
            Применить ко всем
          </button>
        </div>
      </div>

      <div class="bulk-actions">
        <button type="button" class="bulk-mini" @click="selectAllVisible">
          ✅ Выбрать видимые
        </button>
        <button type="button" class="bulk-mini" @click="deselectAllVisible">
          ⬜ Снять видимые
        </button>
        <span class="bulk-counter">
          Выбрано: {{ selectedCount }} из {{ visibleItems.length }}
        </span>
      </div>

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
            <span
              class="name"
              @click="editDescription(it.index)"
              :title="it.description"
            >{{ it.description }}</span>
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

        <div v-if="visibleItems.length === 0" class="empty-filter">
          Нет операций с выбранными датами
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
        <button
          class="btn-save"
          :disabled="saving || selectedCount === 0"
          @click="save"
        >
          {{ saving ? 'Сохранение…' : `✅ Добавить (${selectedCount})` }}
        </button>
      </template>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
/* ... оставляем всё как было, добавляем только новые стили ... */
.mode-switch {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 14px;
  background: #f1f5f9;
  border-radius: 12px;

  .mode {
    flex: 1;
    padding: 8px 10px;
    border: none;
    background: transparent;
    color: var(--muted);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 700;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.18s;
    white-space: nowrap;

    &:hover:not(:disabled) {
      color: var(--accent);
      background: rgba(56, 189, 248, 0.08);
    }

    &.active {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #fff;
      box-shadow: 0 4px 12px -4px rgba(59, 130, 246, 0.6);
      cursor: default;
    }

    &:disabled { cursor: default; }
  }
}

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

.hint {
  font-size: 11.5px;
  color: var(--muted);
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.08);
  text-align: center;
  line-height: 1.4;
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
.upload-title { font-size: 15px; font-weight: 700; }
.upload-sub { font-size: 11.5px; color: var(--muted); }

/* ✅ Обёртка для превью с линией обрезки */
.preview-wrapper {
  margin-top: 8px;
}

.preview {
  position: relative;
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

/* ✅ Красная линия обрезки */
.crop-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 2px dashed #dc2626;
  pointer-events: none;
  z-index: 10;

  .crop-line-label {
    position: absolute;
    top: -18px;
    left: 8px;
    padding: 2px 8px;
    border-radius: 4px;
    background: #dc2626;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    white-space: nowrap;
  }
}

/* ✅ Мини-превью с линией */
.mini-preview {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  max-height: 120px;
  background: #f8fafc;

  img {
    max-width: 100%;
    max-height: 120px;
    object-fit: contain;
    display: block;
    opacity: 0.5;
  }

  .mini-crop-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    border-top: 2px dashed #dc2626;
    pointer-events: none;
    z-index: 10;
  }

  .mini-crop-label {
    position: absolute;
    bottom: 4px;
    right: 6px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font-size: 9px;
    font-weight: 600;
  }
}

/* ... остальные стили (recognize, progress, dates-bar, items-list и т.д.) — без изменений ... */
</style>