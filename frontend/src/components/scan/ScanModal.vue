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

const step = ref('upload');
const file = ref(null);
const filePreview = ref('');
const progress = ref(0);
const statusText = ref('');

const items = ref([]);
const selectedIndices = ref(new Set());
const dateFilters = ref([]);

const manualDate = ref(new Date().toISOString().split('T')[0]);
const showManualDate = ref(false);

const cropYPercent = ref(null);
const previewLoading = ref(false);

const prefetchedLines = ref(null);
const prefetchedCropY = ref(null);

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
  cropYPercent.value = null;
  previewLoading.value = false;
  prefetchedLines.value = null;
  prefetchedCropY.value = null;
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
// Загрузка файла + АВТО-OCR
// ============================================================
async function onFileSelected(e) {
  const f = e.target.files?.[0];
  if (!f) return;

  file.value = f;
  filePreview.value = URL.createObjectURL(f);
  error.value = '';
  cropYPercent.value = null;
  prefetchedLines.value = null;
  prefetchedCropY.value = null;

  previewLoading.value = true;

  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = filePreview.value;
    });
    const originalH = img.height;

    const processed = await preprocessImage(f);
    const result = await recognizeText(processed, () => {});

    prefetchedLines.value = result.lines;

    const firstY = findFirstDateY(result.lines);
    if (firstY !== null && originalH > 0) {
      const y = firstY / 2;
      prefetchedCropY.value = y;
      cropYPercent.value = Math.min(95, Math.max(5, (y / originalH) * 100));
      console.log('[scan] линия обрезки:', cropYPercent.value + '%');
    }
  } catch (e) {
    console.warn('[scan] автопоиск линии не удался:', e);
  } finally {
    previewLoading.value = false;
  }
}

function triggerFileInput() {
  document.getElementById('scanFileInput')?.click();
}

// ============================================================
// Даты
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
// Переход к следующему шагу
// ============================================================
async function recognize() {
  if (!file.value) {
    error.value = 'Сначала выберите фото';
    return;
  }

  error.value = '';

  let textLines = prefetchedLines.value;

  if (!textLines) {
    step.value = 'recognizing';
    progress.value = 0;
    statusText.value = 'Подготовка изображения…';

    try {
      const processed = await preprocessImage(file.value);
      statusText.value = 'Загрузка модели OCR…';
      progress.value = 5;

      const result = await recognizeText(processed, (pct) => {
        progress.value = pct;
        statusText.value = `Распознавание: ${pct}%`;
      });

      textLines = result.lines;
      prefetchedLines.value = textLines;
    } catch (e) {
      console.error('[scan] ошибка OCR:', e);
      error.value = e.message || 'Ошибка распознавания';
      step.value = 'upload';
      return;
    }
  }

  if (!textLines.length) {
    error.value = 'Не удалось распознать текст на фото';
    step.value = 'upload';
    return;
  }

  const parsed = parseReceipt(textLines);

  if (!parsed.length) {
    error.value = 'Не найдено операций в чеке';
    step.value = 'upload';
    return;
  }

  items.value = parsed;
  selectedIndices.value = new Set(parsed.map((_, i) => i));
  dateFilters.value = buildDateFilters(parsed);

  step.value = 'preview';
  toast.success(`📸 Найдено ${parsed.length} операций`);
}

// ============================================================
// Даты фильтры
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
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
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
      <!-- ✅ Поля видны ТОЛЬКО пока файл не выбран -->
      <div v-if="!file" class="fields-row">
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
      </div>

      <!-- ✅ Кнопка загрузки — тоже только пока файл не выбран -->
      <div v-if="!file" class="field">
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
            <span class="upload-sub">Скриншот Т-Банка, Сбера или фото чека</span>
          </span>
        </button>
      </div>

      <!-- ✅ Если файл уже выбран — показываем компактную кнопку «Заменить» -->
      <div v-else class="replace-file-row">
        <span class="replace-file-label">📷 Файл выбран</span>
        <button class="replace-file-btn" type="button" @click="triggerFileInput">
          Заменить
        </button>
        <input
          id="scanFileInput"
          type="file"
          accept="image/*"
          hidden
          @change="onFileSelected"
        />
      </div>

      <div v-if="filePreview" class="preview-block">
        <div class="preview-header">
          <span class="preview-title">📸 Превью распознавания</span>
          <span v-if="previewLoading" class="preview-status loading">
            <span class="spinner-mini"></span> Анализ…
          </span>
          <span v-else-if="prefetchedLines" class="preview-status ok">
            ✅ Готово к распознаванию
          </span>
          <span v-else class="preview-status hint">
            ℹ️ Готово
          </span>
        </div>

        <div class="preview-image-wrapper" :class="{ 'is-scanning': previewLoading }">
          <img :src="filePreview" alt="preview" class="preview-image" />

          <div v-if="previewLoading" class="scan-beam">
            <div class="scan-beam-glow"></div>
            <div class="scan-beam-line"></div>
          </div>

          <div
            v-if="cropYPercent !== null && !previewLoading"
            class="preview-overlay-top"
            :style="{ height: cropYPercent + '%' }"
          >
            <div class="preview-overlay-label">
              Шапка · не распознаётся
            </div>
          </div>

          <div
            v-if="cropYPercent !== null && !previewLoading"
            class="preview-crop-line"
            :style="{ top: cropYPercent + '%' }"
          ></div>
        </div>

        <div class="preview-footer">
          <span v-if="previewLoading">
            🔮 Сканирую изображение…
          </span>
          <span v-else-if="cropYPercent !== null">
            ✂️ Отсекается <strong>{{ Math.round(cropYPercent) }}%</strong> сверху
          </span>
          <span v-else>
            Все операции будут распознаны
          </span>
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

      <div class="items-list">
        <div
          v-for="it in visibleItems"
          :key="it.index"
          class="item-row"
          :class="{ selected: selectedIndices.has(it.index) }"
        >
          <input
            type="checkbox"
            class="item-check"
            :checked="selectedIndices.has(it.index)"
            @change="toggleItem(it.index)"
          />

          <span class="item-date">{{ formatDate(it.date) }}</span>

          <span
            class="item-name"
            @click="editDescription(it.index)"
            :title="it.description"
          >{{ it.description }}</span>

          <button
            class="item-type"
            :class="it.type"
            @click="toggleType(it.index)"
            :title="it.type === 'income' ? 'Доход' : 'Расход'"
          >
            {{ it.type === 'income' ? '📈' : '📉' }}
          </button>

          <span class="item-amount" :class="it.type" @click="editAmount(it.index)">
            {{ it.type === 'income' ? '+' : '−' }} {{ fmt(it.amount) }} ₽
          </span>
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
        <button
          class="btn-save"
          :disabled="!file || previewLoading"
          @click="recognize"
        >
          <template v-if="previewLoading">
            ⏳ Анализ…
          </template>
          <template v-else>
            👁 Показать операции
          </template>
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
/* Переключатель режима */
.mode-switch {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 16px;
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

.step { display: flex; flex-direction: column; gap: 14px; }

.fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
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

/* ✅ Компактная строка «Файл выбран» + Заменить */
.replace-file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.replace-file-label {
  flex: 1;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
}

.replace-file-btn {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.4);
  background: #ffffff;
  color: var(--accent);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    background: rgba(56, 189, 248, 0.12);
    border-color: var(--accent);
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
    transform: translateY(-1px);
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

/* Превью */
.preview-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(56, 189, 248, 0.04), transparent 60%), #ffffff;
  border: 1px solid var(--border);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.preview-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preview-status {
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &.loading { color: #d97706; }
  &.ok { color: #16a34a; }
  &.hint { color: var(--muted); }
}

.spinner-mini {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(217, 119, 6, 0.25);
  border-top-color: #d97706;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin { to { transform: rotate(360deg); } }

.preview-image-wrapper {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #0f172a;
  display: flex;
  justify-content: center;
  max-height: 42vh;

  .preview-image {
    max-width: 100%;
    max-height: 42vh;
    object-fit: contain;
    display: block;
  }
}

.preview-overlay-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: grayscale(1) blur(1px);
  -webkit-backdrop-filter: grayscale(1) blur(1px);
  pointer-events: none;
  transition: height 0.35s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;

  .preview-overlay-label {
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: rgba(0, 0, 0, 0.5);
    padding: 4px 10px;
    border-radius: 6px;
    white-space: nowrap;
  }
}

.preview-crop-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 2px dashed #ef4444;
  pointer-events: none;
  z-index: 5;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
  transition: top 0.35s ease;
}

.preview-footer {
  font-size: 11.5px;
  color: var(--muted);
  text-align: center;
  line-height: 1.4;

  strong {
    color: var(--accent);
    font-family: var(--mono);
  }
}

/* Сканирующий луч */
.preview-image-wrapper.is-scanning .preview-image {
  filter: brightness(0.7) contrast(1.1);
  transition: filter 0.3s ease;
}

.scan-beam {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 3;
  border-radius: 12px;
}

.scan-beam-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(56, 189, 248, 0.4) 20%,
    rgba(139, 92, 246, 0.9) 50%,
    rgba(56, 189, 248, 0.4) 80%,
    transparent 100%);
  box-shadow:
    0 0 12px rgba(56, 189, 248, 0.9),
    0 0 30px rgba(139, 92, 246, 0.6);
  animation: scanBeamMove 1s cubic-bezier(.45,.05,.55,.95) infinite;
}

.scan-beam-glow {
  position: absolute;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(180deg,
    transparent 0%,
    rgba(56, 189, 248, 0.15) 40%,
    rgba(139, 92, 246, 0.25) 50%,
    rgba(56, 189, 248, 0.15) 60%,
    transparent 100%);
  animation: scanBeamMove 1s cubic-bezier(.45,.05,.55,.95) infinite;
  margin-top: -40px;
}

@keyframes scanBeamMove {
  0%   { top: -15%;  opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { top: 115%;  opacity: 0; }
}

.preview-image-wrapper.is-scanning::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid rgba(56, 189, 248, 0.6);
  border-radius: 12px;
  pointer-events: none;
  animation: scanPulse 1.8s ease-in-out infinite;
  z-index: 4;
}

@keyframes scanPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.5),
                inset 0 0 20px rgba(56, 189, 248, 0.15);
  }
  50% {
    box-shadow: 0 0 20px 4px rgba(139, 92, 246, 0.4),
                inset 0 0 30px rgba(139, 92, 246, 0.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scan-beam-line,
  .scan-beam-glow,
  .preview-image-wrapper.is-scanning::after {
    animation: none;
  }
  .scan-beam-glow {
    background: rgba(56, 189, 248, 0.1);
  }
}

/* Распознавание */
.recognize {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 20px;
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

.status { font-size: 14px; color: var(--text); font-weight: 600; }

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

/* Даты */
.dates-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.dates-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dates-toggle-mini {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.4);
  background: transparent;
  color: var(--accent);
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { background: rgba(56, 189, 248, 0.15); }
}

.dates-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.date-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: #f8fafc;
  color: var(--muted);
  font-family: inherit;
  font-size: 12px;
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
    box-shadow: 0 4px 12px -4px rgba(59, 130, 246, 0.6);
  }

  &.manual {
    border-style: dashed;
    color: var(--muted);

    &.active {
      border-style: solid;
      background: linear-gradient(135deg, #f59e0b, #f97316);
      color: #fff;
    }
  }
}

.date-chip-count {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
  font-size: 10.5px;
  font-weight: 800;

  .date-chip:not(.active) & {
    background: rgba(148, 163, 184, 0.2);
  }
}

.manual-date-row {
  display: flex;
  gap: 6px;
  align-items: center;
  padding-top: 4px;
}

.manual-date-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  background: #fff;
  color: var(--text);
  outline: none;

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
  }
}

.manual-date-apply {
  padding: 8px 14px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: #fff;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 6px 16px -6px rgba(245, 158, 11, 0.6);
  transition: all 0.15s;

  &:hover { transform: translateY(-1px); }
  &:active { transform: scale(0.97); }
}

/* Список операций */
.items-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 45vh;
  overflow-y: auto;
  padding-right: 4px;
}

.item-row {
  display: grid;
  grid-template-columns: auto 52px 1fr auto auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: #ffffff;
  transition: all 0.15s;

  &.selected {
    border-color: var(--accent);
    background: rgba(56, 189, 248, 0.03);
  }

  &:hover {
    border-color: rgba(56, 189, 248, 0.4);
  }
}

.item-check {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent);
}

.item-date {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  transition: background 0.15s;

  &:hover {
    background: rgba(56, 189, 248, 0.08);
    color: var(--accent);
  }
}

.item-type {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  padding: 0;
  font-family: inherit;

  &.income {
    background: rgba(34, 197, 94, 0.12);
    border-color: rgba(34, 197, 94, 0.3);
  }
  &.expense {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
  }

  &:hover { transform: scale(1.08); }
}

.item-amount {
  font-family: var(--mono);
  font-size: 13.5px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  padding: 2px 6px;
  border-radius: 6px;
  transition: background 0.15s;

  &.income { color: #16a34a; }
  &.expense { color: #dc2626; }

  &:hover {
    background: rgba(56, 189, 248, 0.1);
  }
}

.empty-filter {
  padding: 24px 16px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  border: 1px dashed var(--border);
  border-radius: 10px;
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

/* Мобильный */
@media (max-width: 700px) {
  .fields-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .item-row {
    grid-template-columns: auto 46px 1fr auto auto;
    gap: 8px;
    padding: 10px;
  }

  .item-date {
    font-size: 10px;
  }

  .item-name {
    font-size: 12.5px;
  }

  .item-type {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }

  .item-amount {
    font-size: 12.5px;
    padding: 2px 4px;
  }

  .preview-image-wrapper {
    max-height: 36vh;
    .preview-image { max-height: 36vh; }
  }
}
</style>