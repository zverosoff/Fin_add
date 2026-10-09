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
const isDragging = ref(false);

const userAccounts = computed(() =>
  accounts.accounts.filter(a => (a.owner || 'Сергей') === user.value)
);

function switchToManual() {
  emit('update:modelValue', false);
  emit('switch-to-manual');
}

function switchToPdf() {
  emit('update:modelValue', false);
  emit('switch-to-pdf');
}

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
  isDragging.value = false;
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

async function onFileSelected(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  await processFile(f);
}

async function onDrop(e) {
  e.preventDefault();
  isDragging.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (!f) return;
  if (!f.type.startsWith('image/')) {
    error.value = 'Только изображения';
    return;
  }
  await processFile(f);
}

async function processFile(f) {
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

async function save() {
  const activeKeys = new Set(
    dateFilters.value.filter(f => f.active).map(f => f.key)
  );

  const toSave = items.value
    .map((it, i) => ({ ...it, _idx: i }))
    .filter((it) => {
      if (!selectedIndices.value.has(it._idx)) return false;
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

  // ✅ Сохраняем importOrder = порядок в чеке
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
      importOrder: it._idx,
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
    title=""
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="scan-header">
        <div class="sh-icon">
          <span>📸</span>
        </div>
        <div class="sh-text">
          <div class="sh-title">Сканирование чека</div>
          <div class="sh-sub">AI-распознавание операций</div>
        </div>
      </div>
    </template>

    <!-- Переключатель режима -->
    <div class="mode-switch">
      <button type="button" class="mode active" disabled>
        <span class="m-icon">📸</span>
        <span class="m-label">Чек</span>
      </button>
      <button type="button" class="mode" @click="switchToManual">
        <span class="m-icon">✏️</span>
        <span class="m-label">Вручную</span>
      </button>
      <button type="button" class="mode" @click="switchToPdf">
        <span class="m-icon">📄</span>
        <span class="m-label">PDF</span>
      </button>
    </div>

    <!-- ШАГ 1. Загрузка -->
    <div v-if="step === 'upload'" class="step">
      <div v-if="!file" class="fields-row">
        <div class="field">
          <label>👤 Кто вносит</label>
          <div class="select-wrap">
            <select v-model="user">
              <option value="Сергей">👨 Сергей</option>
              <option value="Саша">👩 Саша</option>
            </select>
            <span class="select-chevron">▼</span>
          </div>
        </div>
        <div class="field">
          <label>💳 Счёт</label>
          <div class="select-wrap">
            <select v-model="accountId">
              <option v-for="acc in userAccounts" :key="acc.id" :value="acc.id">
                {{ acc.name }}
              </option>
            </select>
            <span class="select-chevron">▼</span>
          </div>
        </div>
      </div>

      <div v-if="!file" class="field">
        <label>📷 Фото чека / скриншот</label>
        <input
          id="scanFileInput"
          type="file"
          accept="image/*"
          hidden
          @change="onFileSelected"
        />
        <div
          class="drop-zone"
          :class="{ 'is-dragging': isDragging }"
          @click="triggerFileInput"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop="onDrop"
        >
          <div class="dz-icon-wrap">
            <div class="dz-icon">📷</div>
            <div class="dz-icon-pulse"></div>
          </div>
          <div class="dz-text">
            <div class="dz-title">Выбрать файл</div>
            <div class="dz-sub">Скриншот Т-Банка, Сбера или фото чека</div>
          </div>
          <div class="dz-hint">или перетащи сюда</div>
        </div>
      </div>

      <div v-else class="replace-file-row">
        <div class="rfp-icon">🖼️</div>
        <div class="rfp-info">
          <div class="rfp-title">Файл выбран</div>
          <div class="rfp-name">{{ file.name }}</div>
        </div>
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
          <span v-else class="preview-status hint">ℹ️ Готово</span>
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
            <div class="preview-overlay-label">Шапка · не распознаётся</div>
          </div>

          <div
            v-if="cropYPercent !== null && !previewLoading"
            class="preview-crop-line"
            :style="{ top: cropYPercent + '%' }"
          ></div>
        </div>

        <div class="preview-footer">
          <span v-if="previewLoading">🔮 Сканирую изображение…</span>
          <span v-else-if="cropYPercent !== null">
            ✂️ Отсекается <strong>{{ Math.round(cropYPercent) }}%</strong> сверху
          </span>
          <span v-else>Все операции будут распознаны</span>
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
          <template v-if="previewLoading">⏳ Анализ…</template>
          <template v-else>👁 Показать операции</template>
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
/* ============================================================
   КАСТОМНЫЙ ЗАГОЛОВОК
   ============================================================ */
.scan-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sh-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;

  background: var(--grad-primary);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 -2px 0 rgba(0, 0, 0, 0.2) inset,
    0 4px 10px -2px rgba(139, 92, 246, 0.5),
    0 8px 20px -6px rgba(139, 92, 246, 0.35);
}

.sh-text { min-width: 0; }

.sh-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.sh-sub {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 2px;
}

/* ============================================================
   ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМА
   ============================================================ */
.mode-switch {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding: 4px;
  margin-bottom: 18px;

  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 14px;
}

.mode {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 800;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(.34,1.56,.64,1);
  white-space: nowrap;
  position: relative;

  &:not(:disabled):hover {
    color: var(--accent);
    background: rgba(139, 92, 246, 0.08);
  }

  &.active {
    background: var(--grad-primary);
    color: #ffffff;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 -2px 0 rgba(0, 0, 0, 0.15) inset,
      0 4px 10px -2px rgba(139, 92, 246, 0.6),
      0 8px 20px -6px rgba(139, 92, 246, 0.5);
    cursor: default;
  }

  &:disabled { cursor: default; }
}

.m-icon { font-size: 14px; line-height: 1; }
.m-label { line-height: 1; }

/* ============================================================
   ОБЩЕЕ
   ============================================================ */
.step { display: flex; flex-direction: column; gap: 16px; }

.fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 11px;
    font-weight: 800;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
}

.select-wrap { position: relative; }

.select-wrap select {
  width: 100%;
  padding: 12px 40px 12px 14px;
  border-radius: 12px;
  border: 1.5px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  outline: none;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.3s ease;

  &:hover { border-color: var(--border-strong); }

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
  }
}

.select-chevron {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  color: var(--muted);
  pointer-events: none;
  transition: color 0.15s;
}

.select-wrap select:focus ~ .select-chevron { color: var(--accent); }

/* ============================================================
   DROP-ZONE
   ============================================================ */
.drop-zone {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 18px 20px;
  border-radius: 16px;

  border: 2px dashed rgba(139, 92, 246, 0.4);
  background: rgba(139, 92, 246, 0.06);
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(.34,1.56,.64,1);

  &:hover {
    border-color: var(--accent);
    background: rgba(139, 92, 246, 0.1);
    transform: translateY(-1px);
    box-shadow: 0 8px 20px -6px rgba(139, 92, 246, 0.25);
  }

  &.is-dragging {
    border-color: var(--accent);
    background: rgba(139, 92, 246, 0.15);
    transform: scale(1.01);
    box-shadow: 0 12px 28px -8px rgba(139, 92, 246, 0.4);
  }
}

.dz-icon-wrap {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  background: var(--panel-solid);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.dz-icon { font-size: 26px; line-height: 1; }

.dz-icon-pulse {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  pointer-events: none;
  border: 2px solid rgba(139, 92, 246, 0.4);
  animation: dzPulse 2s ease-in-out infinite;
}

@keyframes dzPulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50%      { transform: scale(1.15); opacity: 0; }
}

.dz-text { flex: 1; min-width: 0; text-align: left; }

.dz-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text);
  margin-bottom: 3px;
}

.dz-sub {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}

.dz-hint {
  font-size: 10.5px;
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--panel-solid);
  border: 1px dashed var(--border-strong);
  flex-shrink: 0;
}

.replace-file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 14px;

  background: var(--panel-2);
  border: 1px solid var(--border);
}

.rfp-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;

  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.rfp-info { flex: 1; min-width: 0; }
.rfp-title {
  font-size: 12.5px;
  font-weight: 800;
  color: var(--text);
}
.rfp-name {
  font-size: 11.5px;
  color: var(--muted);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.replace-file-btn {
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid rgba(139, 92, 246, 0.4);

  background: rgba(139, 92, 246, 0.1);
  color: var(--accent);
  font-family: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s cubic-bezier(.34,1.56,.64,1);

  &:hover {
    background: var(--grad-primary);
    color: #ffffff;
    border-color: transparent;
    transform: translateY(-1px);
    box-shadow: 0 4px 10px -2px rgba(139, 92, 246, 0.5);
  }
  &:active { transform: scale(0.96); }
}

/* ============================================================
   ПРЕВЬЮ
   ============================================================ */
.preview-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 16px;

  background: var(--panel-2);
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
  font-weight: 800;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.preview-status {
  font-size: 11px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;

  &.loading {
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.15);
    border: 1px solid rgba(251, 191, 36, 0.3);
  }
  &.ok {
    color: var(--accent-2, #16a34a);
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  &.hint {
    color: var(--muted);
    background: var(--panel-solid);
    border: 1px solid var(--border);
  }
}

.spinner-mini {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(251, 191, 36, 0.3);
  border-top-color: #fbbf24;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin { to { transform: rotate(360deg); } }

.preview-image-wrapper {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background: #0a0612;
  display: flex;
  justify-content: center;
  max-height: 42vh;
  box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.4);

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
  background: rgba(10, 6, 18, 0.75);
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
    font-weight: 800;
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
  border-top: 2px dashed var(--danger);
  pointer-events: none;
  z-index: 5;
  box-shadow: 0 0 8px rgba(244, 63, 94, 0.6);
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
    font-weight: 800;
  }
}

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
  border-radius: 14px;
}

.scan-beam-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(34, 211, 238, 0.4) 20%,
    rgba(168, 85, 247, 0.9) 50%,
    rgba(34, 211, 238, 0.4) 80%,
    transparent 100%);
  box-shadow:
    0 0 12px rgba(34, 211, 238, 0.9),
    0 0 30px rgba(168, 85, 247, 0.6);
  animation: scanBeamMove 1s cubic-bezier(.45,.05,.55,.95) infinite;
}

.scan-beam-glow {
  position: absolute;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(180deg,
    transparent 0%,
    rgba(34, 211, 238, 0.15) 40%,
    rgba(168, 85, 247, 0.25) 50%,
    rgba(34, 211, 238, 0.15) 60%,
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
  border: 2px solid rgba(34, 211, 238, 0.6);
  border-radius: 14px;
  pointer-events: none;
  animation: scanPulse 1.8s ease-in-out infinite;
  z-index: 4;
}

@keyframes scanPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.5),
                inset 0 0 20px rgba(34, 211, 238, 0.15);
  }
  50% {
    box-shadow: 0 0 20px 4px rgba(168, 85, 247, 0.4),
                inset 0 0 30px rgba(168, 85, 247, 0.25);
  }
}

/* ============================================================
   РАСПОЗНАВАНИЕ
   ============================================================ */
.recognize {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 40px 20px;
  text-align: center;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(139, 92, 246, 0.2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
}

.status {
  font-size: 14px;
  color: var(--text);
  font-weight: 700;
}

.progress {
  width: 100%;
  max-width: 320px;
  height: 10px;
  border-radius: 5px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 5px;
  background: var(--grad-primary);
  transition: width 0.3s;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 0 12px rgba(168, 85, 247, 0.6);
}

.progress-pct {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--muted);
  font-weight: 800;
}

/* ============================================================
   ДАТЫ
   ============================================================ */
.dates-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;

  background: rgba(139, 92, 246, 0.06);
  border: 1px solid rgba(139, 92, 246, 0.25);
}

.dates-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
  font-weight: 800;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.dates-toggle-mini {
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(139, 92, 246, 0.4);
  background: rgba(139, 92, 246, 0.1);
  color: var(--accent);
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--grad-primary);
    color: #ffffff;
    border-color: transparent;
    transform: translateY(-1px);
  }
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

  background: var(--panel-2);
  color: var(--muted);
  font-family: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(.34,1.56,.64,1);
  white-space: nowrap;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    transform: translateY(-1px);
  }

  &.active {
    background: var(--grad-primary);
    color: #ffffff;
    border-color: transparent;
    box-shadow: 0 4px 10px -2px rgba(139, 92, 246, 0.4);
  }

  &.manual {
    border-style: dashed;

    &.active {
      border-style: solid;
      background: linear-gradient(180deg, #fbbf24, #f59e0b);
      color: #ffffff;
      box-shadow: 0 4px 10px -2px rgba(245, 158, 11, 0.4);
    }
  }
}

.date-chip-count {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
  font-size: 10.5px;
  font-weight: 800;

  .date-chip:not(.active) & {
    background: rgba(148, 163, 184, 0.2);
  }
}

.manual-date-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-top: 4px;
}

.manual-date-input {
  flex: 1;
  padding: 10px 14px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  font-family: inherit;
  font-size: 13px;
  background: var(--panel-2);
  color: var(--text);
  outline: none;
  font-weight: 700;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.3s ease;

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
  }
}

.manual-date-apply {
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid rgba(245, 158, 11, 0.5);

  background: linear-gradient(180deg, #fbbf24, #f59e0b);
  color: #ffffff;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s cubic-bezier(.34,1.56,.64,1);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 -2px 0 rgba(180, 83, 9, 0.3) inset,
    0 4px 10px -2px rgba(245, 158, 11, 0.4);

  &:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.45) inset,
      0 -2px 0 rgba(180, 83, 9, 0.3) inset,
      0 8px 18px -4px rgba(245, 158, 11, 0.5);
  }
  &:active { transform: scale(0.97); }
}

/* ============================================================
   СПИСОК ОПЕРАЦИЙ
   ============================================================ */
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
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);

  background: var(--panel-2);

  transition: all 0.15s ease;

  &.selected {
    border-color: rgba(139, 92, 246, 0.5);
    background: rgba(139, 92, 246, 0.1);
    box-shadow: 0 4px 10px -2px rgba(139, 92, 246, 0.15);
  }

  &:hover {
    border-color: var(--border-strong);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
}

.item-check {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent);
}

.item-date {
  font-size: 11px;
  font-weight: 800;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.item-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: all 0.15s;

  &:hover {
    background: rgba(139, 92, 246, 0.12);
    color: var(--accent);
  }
}

.item-type {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s cubic-bezier(.34,1.56,.64,1);
  padding: 0;
  font-family: inherit;

  &.income {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.3);
  }
  &.expense {
    background: rgba(244, 63, 94, 0.15);
    border-color: rgba(244, 63, 94, 0.3);
  }

  &:hover { transform: scale(1.1); }
  &:active { transform: scale(0.95); }
}

.item-amount {
  font-family: var(--mono);
  font-size: 13.5px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  padding: 4px 8px;
  border-radius: 8px;
  transition: all 0.15s;

  &.income { color: var(--accent-2, #16a34a); }
  &.expense { color: var(--danger); }

  &:hover { background: rgba(139, 92, 246, 0.12); }
}

.empty-filter {
  padding: 24px 16px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  border: 1px dashed var(--border-strong);
  border-radius: 12px;
  background: var(--panel-2);
}

/* ============================================================
   ОШИБКА
   ============================================================ */
.error-msg {
  padding: 10px 14px;
  border-radius: 10px;

  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.3);
  color: var(--danger);
  font-size: 12.5px;
  font-weight: 700;
}

/* ============================================================
   КНОПКИ ФУТЕРА
   ============================================================ */
.btn-cancel,
.btn-save {
  padding: 12px 22px;
  border-radius: 12px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.18s cubic-bezier(.34,1.56,.64,1);
}

.btn-cancel {
  background: var(--panel-2);
  color: var(--text);
  border-color: var(--border);

  &:hover {
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }
  &:active { transform: scale(0.97); }
}

.btn-save {
  background: var(--grad-primary);
  color: #ffffff;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 -2px 0 rgba(0, 0, 0, 0.2) inset,
    0 6px 18px -6px rgba(139, 92, 246, 0.7);

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  &:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.4) inset,
      0 -2px 0 rgba(0, 0, 0, 0.2) inset,
      0 10px 24px -6px rgba(139, 92, 246, 0.9);
  }

  &:not(:disabled):active {
    transform: translateY(0) scale(0.97);
  }
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .scan-header { gap: 10px; }
  .sh-icon { width: 36px; height: 36px; font-size: 18px; border-radius: 10px; }
  .sh-title { font-size: 15px; }
  .sh-sub { font-size: 11px; }

  .mode { padding: 9px 8px; font-size: 11.5px; gap: 5px; border-radius: 9px; }
  .m-icon { font-size: 13px; }

  .fields-row { grid-template-columns: 1fr; gap: 12px; }

  .drop-zone { padding: 16px; gap: 12px; }
  .dz-icon-wrap { width: 48px; height: 48px; border-radius: 14px; }
  .dz-icon { font-size: 22px; }
  .dz-title { font-size: 14px; }
  .dz-sub { font-size: 11.5px; }
  .dz-hint { display: none; }

  .item-row {
    grid-template-columns: auto 46px 1fr auto auto;
    gap: 8px;
    padding: 10px;
  }
  .item-date { font-size: 10px; }
  .item-name { font-size: 12.5px; }
  .item-type { width: 26px; height: 26px; font-size: 12px; }
  .item-amount { font-size: 12.5px; padding: 4px 6px; }

  .preview-image-wrapper {
    max-height: 36vh;
    .preview-image { max-height: 36vh; }
  }

  .btn-cancel,
  .btn-save { padding: 12px 18px; font-size: 13px; }
}

@media (prefers-reduced-motion: reduce) {
  .scan-header,
  .mode,
  .drop-zone,
  .replace-file-row,
  .replace-file-btn,
  .date-chip,
  .item-row,
  .btn-cancel,
  .btn-save,
  .dz-icon-pulse { transition: none !important; transform: none !important; }
  .dz-icon-pulse { animation: none !important; }
  .scan-beam-line,
  .scan-beam-glow,
  .preview-image-wrapper.is-scanning::after { animation: none !important; }
}
</style>