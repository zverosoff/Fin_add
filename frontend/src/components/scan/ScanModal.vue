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
  parseBankScreenshot,
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

const user = ref(auth.user || 'Сергей');
const accountId = ref('');
const error = ref('');
const saving = ref(false);

// Для маски на фото
const imageMeta = ref({ width: 0, height: 0 });
const highlightBoxes = ref([]);

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
  highlightBoxes.value = [];
  imageMeta.value = { width: 0, height: 0 };
  user.value = auth.user || 'Сергей';
  accountId.value = userAccounts.value[0]?.id || '';
  error.value = '';
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

async function onFileSelected(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  await processFile(f);
}

async function processFile(f) {
  file.value = f;
  filePreview.value = URL.createObjectURL(f);
  error.value = '';
  step.value = 'recognizing';
  progress.value = 0;
  statusText.value = 'Подготовка изображения…';

  try {
    const processed = await preprocessImage(f);
    statusText.value = 'Загрузка модели OCR…';
    
    // Передаем размеры картинки для точного расчета
    const result = await recognizeText(processed, (pct) => {
      progress.value = pct;
      statusText.value = `Сканирование: ${pct}%`;
    });

    imageMeta.value = {
      width: result.width || 1000,
      height: result.height || 1000,
    };

    const parsed = parseBankScreenshot(result.lines);

    if (!parsed.length) {
      error.value = 'Не удалось найти операции.';
      step.value = 'upload';
      return;
    }

    items.value = parsed;
    selectedIndices.value = new Set(parsed.map((_, i) => i));
    
    // Собираем координаты операций (делим на 2, т.к. preprocessImage увеличивает в 2 раза)
    highlightBoxes.value = parsed
      .filter(it => it.bbox)
      .map(it => ({
        left: (it.bbox.x0 / 2 / imageMeta.value.width) * 100,
        top: (it.bbox.y0 / 2 / imageMeta.value.height) * 100,
        width: ((it.bbox.x1 - it.bbox.x0) / 2 / imageMeta.value.width) * 100,
        height: ((it.bbox.y1 - it.bbox.y0) / 2 / imageMeta.value.height) * 100,
      }));

    step.value = 'preview';
  } catch (e) {
    console.error('[scan] ошибка OCR:', e);
    error.value = e.message || 'Ошибка распознавания';
    step.value = 'upload';
  }
}

function triggerFileInput() {
  document.getElementById('scanFileInput')?.click();
}

function toggleItem(i) {
  const set = new Set(selectedIndices.value);
  if (set.has(i)) set.delete(i);
  else set.add(i);
  selectedIndices.value = set;
}

function formatDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

const selectedCount = computed(() => selectedIndices.value.size);

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
    title="📸 Сканирование"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="mode-switch">
      <button type="button" class="mode active" disabled>
        <span class="m-icon">📸</span> Скриншот
      </button>
      <button type="button" class="mode" @click="switchToManual">
        <span class="m-icon">✏️</span> Вручную
      </button>
      <button type="button" class="mode" @click="switchToPdf">
        <span class="m-icon">📄</span> PDF
      </button>
    </div>

    <!-- ШАГ 1. Загрузка -->
    <div v-if="step === 'upload'" class="step">
      <div class="fields-row">
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

      <div class="field">
        <input
          id="scanFileInput"
          type="file"
          accept="image/*"
          hidden
          @change="onFileSelected"
        />
        <button class="upload-btn" type="button" @click="triggerFileInput">
          <span class="upload-icon">🖼️</span>
          <span class="upload-text">
            <span class="upload-title">Выбрать скриншот</span>
            <span class="upload-sub">Скриншот списка операций Т-Банка или Сбера</span>
          </span>
        </button>
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
      </div>
    </div>

    <!-- ШАГ 3. Предпросмотр -->
    <div v-else-if="step === 'preview'" class="step">
      
      <!-- ✅ Визуальное превью с заштриховкой -->
      <div v-if="filePreview" class="preview-wrapper">
        <img :src="filePreview" class="preview-img" />
        
        <!-- Затеняем всё, кроме найденных операций -->
        <div class="preview-overlay">
          <!-- Затемненные зоны (между окнами) рисуются автоматически за счет разницы цвета фона -->
          <div 
            v-for="(box, i) in highlightBoxes" 
            :key="i"
            class="highlight-box"
            :style="{
              left: box.left + '%',
              top: box.top + '%',
              width: box.width + '%',
              height: box.height + '%',
            }"
          ></div>
        </div>
      </div>

      <div class="preview-header">
        <div class="ph-title">Найдено операций: {{ items.length }}</div>
        <div class="ph-hint">Снимите галочки с лишнего</div>
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
            class="item-check"
            :checked="selectedIndices.has(i)"
            @change="toggleItem(i)"
          />

          <span class="item-date">{{ formatDateShort(it.date) }}</span>

          <div class="item-desc">
            <div class="item-name">{{ it.name }}</div>
            <div class="item-cat">{{ it.category }}</div>
          </div>

          <span class="item-amount" :class="it.type">
            {{ it.type === 'income' ? '+' : '−' }} {{ fmt(it.amount) }} ₽
          </span>
        </div>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <template #footer>
      <template v-if="step === 'upload'">
        <button class="btn-cancel" @click="close">Отмена</button>
      </template>

      <template v-else-if="step === 'recognizing'">
        <button class="btn-cancel" @click="step = 'upload'">← Отмена</button>
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
.step { display: flex; flex-direction: column; gap: 16px; }

/* ✅ Красивое превью с окнами */
.preview-wrapper {
  position: relative;
  width: 100%;
  max-height: 300px;
  overflow: hidden;
  border-radius: 12px;
  background: #0f172a;
  display: flex;
  justify-content: center;
  border: 1px solid #e2e8f0;
}

.preview-img {
  width: 100%;
  height: auto;
  object-fit: contain;
  display: block;
}

.preview-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.7); /* Затенение всего фона */
  backdrop-filter: blur(2px);
}

.highlight-box {
  position: absolute;
  background: transparent;
  box-shadow: 0 0 0 100vmax rgba(15, 23, 42, 0.7); /* Оставляем только "окно" прозрачным */
  border: 2px solid rgba(99, 102, 241, 0.8); /* Подсветка рамки */
  border-radius: 4px;
  transform: translateZ(0);
  pointer-events: none;
}

/* ... остальные стили ... */
.mode-switch {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding: 4px;
  margin-bottom: 18px;
  background: linear-gradient(180deg, #f1f5f9, #e2e8f0);
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
  color: #64748b;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 800;
  border-radius: 10px;
  cursor: pointer;
}
.mode.active {
  background: linear-gradient(180deg, #818cf8, #6366f1);
  color: #ffffff;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.3) inset, 0 -2px 0 rgba(49, 46, 129, 0.3) inset, 0 4px 10px -2px rgba(99, 102, 241, 0.5);
}
.fields-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
.field select { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #fff; font-weight: 700; }
.upload-btn { display: flex; align-items: center; gap: 16px; width: 100%; padding: 18px 20px; border-radius: 16px; border: 2px dashed rgba(99, 102, 241, 0.4); background: linear-gradient(180deg, #eef2ff, #e0e7ff); cursor: pointer; text-align: left; }
.upload-icon { font-size: 26px; }
.upload-title { font-size: 15px; font-weight: 800; display: block; }
.upload-sub { font-size: 12px; color: #64748b; }
.recognize { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 40px 20px; text-align: center; }
.spinner { width: 48px; height: 48px; border: 4px solid rgba(99, 102, 241, 0.2); border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.status { font-size: 14px; font-weight: 700; }
.progress { width: 100%; max-width: 320px; height: 10px; border-radius: 5px; background: #e2e8f0; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(180deg, #818cf8, #6366f1); }
.preview-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
.ph-title { font-size: 13px; font-weight: 800; }
.ph-hint { font-size: 11px; color: #94a3b8; }
.items-list { display: flex; flex-direction: column; gap: 6px; max-height: 45vh; overflow-y: auto; padding-right: 4px; }
.item-row { display: grid; grid-template-columns: auto 44px 1fr auto; gap: 10px; align-items: center; padding: 12px 14px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; }
.item-row.selected { border-color: rgba(99, 102, 241, 0.5); background: #f5f3ff; }
.item-check { width: 18px; height: 18px; accent-color: #6366f1; cursor: pointer; }
.item-date { font-size: 11px; font-weight: 800; color: #94a3b8; }
.item-desc { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.item-name { font-size: 13px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-cat { font-size: 11px; color: #64748b; }
.item-amount { font-family: var(--mono); font-size: 13.5px; font-weight: 800; white-space: nowrap; }
.item-amount.income { color: #16a34a; }
.item-amount.expense { color: #dc2626; }
.error-msg { padding: 10px 14px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-size: 12.5px; font-weight: 700; }
.btn-cancel, .btn-save { padding: 12px 22px; border-radius: 12px; font-family: inherit; font-size: 14px; font-weight: 800; cursor: pointer; }
.btn-cancel { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
.btn-save { background: linear-gradient(180deg, #818cf8, #6366f1); color: #fff; border: none; }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
@media (max-width: 700px) {
  .fields-row { grid-template-columns: 1fr; }
  .item-row { grid-template-columns: auto 40px 1fr auto; padding: 10px; }
}
</style>