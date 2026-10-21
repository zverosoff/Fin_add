<script setup>
import { ref, computed, watch, nextTick } from 'vue';
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
const bankType = ref('tbank');
const error = ref('');
const saving = ref(false);

const canvasRef = ref(null);
const userAccounts = computed(() =>
  accounts.accounts.filter(a => (a.owner || 'Сергей') === user.value)
);

watch(accountId, (newId) => {
  if (newId.startsWith('sber')) bankType.value = 'sber';
  else if (newId.startsWith('tbank')) bankType.value = 'tbank';
}, { immediate: true });

const hasUncertainDates = computed(() => items.value.some(it => it.dateUncertain));
const uncertainDateInput = ref('');
const defaultNextDay = computed(() => {
  const knownOp = items.value.find(it => !it.dateUncertain);
  if (knownOp) {
    const d = new Date(knownOp.date);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
});

watch(hasUncertainDates, (val) => {
  if (val) uncertainDateInput.value = defaultNextDay.value;
});

function applyDateToAll(dateStr) {
  if (!dateStr) return;
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return;
  
  items.value = items.value.map(it => {
    if (it.dateUncertain) {
      return { ...it, date: d.toISOString(), dateUncertain: false };
    }
    return it;
  });
  toast.success('Дата применена');
}

function switchToManual() { emit('update:modelValue', false); emit('switch-to-manual'); }
function switchToPdf() { emit('update:modelValue', false); emit('switch-to-pdf'); }

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
  error.value = '';
  saving.value = false;
  uncertainDateInput.value = '';
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

async function drawMaskedImage() {
  if (!canvasRef.value || !file.value) return;
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  const img = new Image();

  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'destination-out';
    for (const item of items.value) {
      if (!item.bbox) continue;
      const x = item.bbox.x0 / 2;
      const y = item.bbox.y0 / 2;
      const w = (item.bbox.x1 - item.bbox.x0) / 2;
      const h = (item.bbox.y1 - item.bbox.y0) / 2;

      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - 10, y - 10, w + 20, h + 20, 8);
      else ctx.rect(x - 10, y - 10, w + 20, h + 20);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 3;
    for (const item of items.value) {
      if (!item.bbox) continue;
      ctx.strokeStyle = item.isSuspicious ? '#f59e0b' : '#ef4444';
      const x = item.bbox.x0 / 2;
      const y = item.bbox.y0 / 2;
      const w = (item.bbox.x1 - item.bbox.x0) / 2;
      const h = (item.bbox.y1 - item.bbox.y0) / 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - 10, y - 10, w + 20, h + 20, 8);
      else ctx.rect(x - 10, y - 10, w + 20, h + 20);
      ctx.stroke();
    }
  };
  img.src = filePreview.value;
}

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
    
    const result = await recognizeText(processed, (pct) => {
      progress.value = pct;
      statusText.value = `Сканирование: ${pct}%`;
    });

    const parsed = parseBankScreenshot(result.lines, bankType.value);

    if (!parsed.length) {
      error.value = 'Не удалось найти операции.';
      step.value = 'upload';
      return;
    }

    items.value = parsed;
    
    // ✅ Автоматически ставим галочки только на НЕ сомнительные операции
    selectedIndices.value = new Set(
      parsed.map((it, i) => it.isSuspicious ? -1 : i).filter(i => i !== -1)
    );
    
    step.value = 'preview';
    await nextTick();
    drawMaskedImage();
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

const selectedCount = computed(() => selectedIndices.value.size);

async function save() {
  const toSave = items.value.filter((_, i) => selectedIndices.value.has(i));
  if (!toSave.length) { error.value = 'Выберите хотя бы одну операцию'; return; }

  if (toSave.some(it => it.dateUncertain)) {
    error.value = 'Укажите дату для операций без даты';
    return;
  }

  saving.value = true;
  error.value = '';
  let added = 0, failed = 0;

  for (const it of toSave) {
    try {
      await txStore.save({
        name: it.name,
        amount: it.amount,
        type: it.type,
        category: it.category || 'Прочее',
        date: it.date,
        user: user.value,
        accountId: accountId.value || null,
        fromScan: true,
      });
      added++;
    } catch (e) { failed++; }
  }

  saving.value = false;
  if (failed > 0) toast.error(`Добавлено ${added}, ошибок: ${failed}`);
  else {
    toast.success(`✅ Добавлено ${added} операций`);
    emit('update:modelValue', false);
  }
}

function close() { emit('update:modelValue', false); }
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="📸 Сканирование"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="sticky-tabs">
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
    </div>

    <div v-if="step === 'upload'" class="step">
      <div class="bank-selector">
        <div class="bs-label">Выберите счёт</div>
        <div class="bs-options">
          <button 
            v-for="acc in userAccounts" 
            :key="acc.id"
            class="bs-btn"
            :class="{ active: accountId === acc.id, tbank: acc.id.startsWith('tbank'), sber: acc.id.startsWith('sber') }"
            @click="accountId = acc.id"
          >
            <img v-if="acc.id.startsWith('tbank')" src="/img/tbank.png" alt="Т-Банк" />
            <img v-else-if="acc.id.startsWith('sber')" src="/img/sber.png" alt="Сбер" />
            <span class="bs-name">{{ acc.name }}</span>
          </button>
        </div>
      </div>

      <div class="field">
        <label>👤 Кто вносит</label>
        <div class="user-picker">
          <button class="up-btn" :class="{ active: user === 'Сергей' }" @click="user = 'Сергей'">👨 Сергей</button>
          <button class="up-btn" :class="{ active: user === 'Саша' }" @click="user = 'Саша'">👩 Саша</button>
        </div>
      </div>

      <div class="field" style="margin-top: 16px;">
        <input id="scanFileInput" type="file" accept="image/*" hidden @change="onFileSelected" />
        <button class="upload-btn" type="button" @click="triggerFileInput">
          <span class="upload-icon">🖼️</span>
          <span class="upload-text">
            <span class="upload-title">Выбрать скриншот</span>
            <span class="upload-sub">Скриншот списка операций</span>
          </span>
        </button>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <div v-else-if="step === 'recognizing'" class="step">
      <div class="recognize">
        <div class="spinner"></div>
        <div class="status">{{ statusText }}</div>
        <div class="progress">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
      </div>
    </div>

    <div v-else-if="step === 'preview'" class="step">
      <div v-if="filePreview" class="preview-wrapper">
        <canvas ref="canvasRef" class="preview-canvas"></canvas>
      </div>

      <div v-if="hasUncertainDates" class="date-warning">
        <div class="dw-icon">⚠️</div>
        <div class="dw-content">
          <div class="dw-title">Дата не определена</div>
          <div class="dw-text">Для операций вверху скриншота. Укажите дату:</div>
          <div class="dw-controls">
            <button class="dw-btn" @click="applyDateToAll(defaultNextDay)">
              {{ new Date(defaultNextDay).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'}) }} (след. день)
            </button>
            <div class="dw-manual">
              <input type="date" v-model="uncertainDateInput" />
              <button class="dw-apply" @click="applyDateToAll(uncertainDateInput)">OK</button>
            </div>
          </div>
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
          :class="{ selected: selectedIndices.has(i), suspicious: it.isSuspicious }"
          @click="toggleItem(i)"
        >
          <div class="item-checkbox">
            <div class="checkbox-inner" :class="{ checked: selectedIndices.has(i) }">
              <svg v-if="selectedIndices.has(i)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>

          <div class="item-main">
            <div class="item-top">
              <span class="item-date" :class="{ warning: it.dateUncertain }">
                {{ it.dateUncertain ? '??.??' : new Date(it.date).toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'}) }}
              </span>
              <span class="item-cat">{{ it.category }}</span>
              <!-- ✅ Значок вопроса для сомнительных операций -->
              <span v-if="it.isSuspicious" class="suspicious-badge" :title="it.suspicionReason">?</span>
            </div>
            <div class="item-name">{{ it.name }}</div>
            <div v-if="it.isSuspicious" class="suspicious-hint">{{ it.suspicionReason }}</div>
          </div>

          <div class="item-amount" :class="it.type">
            {{ it.type === 'income' ? '+' : '−' }} {{ fmt(it.amount) }} ₽
          </div>
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
        <button class="btn-save" :disabled="saving || selectedCount === 0" @click="save">
          {{ saving ? 'Сохранение…' : `✅ Добавить (${selectedCount})` }}
        </button>
      </template>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
/* Все стили из предыдущего файла + новые для сомнительных операций */

.sticky-tabs { position: sticky; top: -16px; z-index: 10; background: #fff; padding: 16px 0 12px; margin: -16px 0 12px; border-bottom: 1px solid #e2e8f0; }
.mode-switch { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; padding: 4px; background: linear-gradient(180deg, #f1f5f9, #e2e8f0); border-radius: 14px; }
.mode { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 12px; border: none; background: transparent; color: #64748b; font-family: inherit; font-size: 12.5px; font-weight: 800; border-radius: 10px; cursor: pointer; }
.mode.active { background: linear-gradient(180deg, #818cf8, #6366f1); color: #fff; box-shadow: 0 1px 0 rgba(255,255,255,0.3) inset, 0 -2px 0 rgba(49,46,129,0.3) inset, 0 4px 10px -2px rgba(99,102,241,0.5); }

.date-warning { display: flex; gap: 12px; padding: 12px 14px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; margin-bottom: 12px; }
.dw-icon { font-size: 20px; }
.dw-content { flex: 1; }
.dw-title { font-size: 13px; font-weight: 800; color: #b45309; margin-bottom: 2px; }
.dw-text { font-size: 11.5px; color: #92400e; margin-bottom: 8px; }
.dw-controls { display: flex; gap: 8px; flex-wrap: wrap; }
.dw-btn { padding: 6px 12px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; font-size: 12px; font-weight: 700; color: #b45309; cursor: pointer; }
.dw-btn:hover { background: #fde68a; }
.dw-manual { display: flex; gap: 4px; align-items: center; }
.dw-manual input { padding: 5px 8px; border: 1px solid #fcd34d; border-radius: 8px; font-size: 12px; background: #fff; outline: none; }
.dw-apply { padding: 6px 10px; background: #f59e0b; border: none; border-radius: 8px; color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; }

.bank-selector { margin-bottom: 16px; }
.bs-label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
.bs-options { display: flex; gap: 10px; }
.bs-btn { flex: 1; display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #fff; cursor: pointer; transition: all 0.2s; }
.bs-btn img { width: 24px; height: 24px; object-fit: contain; }
.bs-btn .bs-name { font-size: 13px; font-weight: 700; color: #64748b; }
.bs-btn.active { border-color: #6366f1; background: #f5f3ff; }
.bs-btn.active .bs-name { color: #4f46e5; }
.bs-btn.tbank.active { border-color: #fbbf24; background: #fefce8; }
.bs-btn.tbank.active .bs-name { color: #b45309; }
.bs-btn.sber.active { border-color: #21a038; background: #f0fdf4; }
.bs-btn.sber.active .bs-name { color: #166534; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
.user-picker { display: flex; gap: 10px; }
.up-btn { flex: 1; padding: 10px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #fff; cursor: pointer; font-weight: 700; color: #64748b; }
.up-btn.active { border-color: #6366f1; background: #f5f3ff; color: #4f46e5; }

.upload-btn { display: flex; align-items: center; gap: 16px; width: 100%; padding: 18px 20px; border-radius: 16px; border: 2px dashed rgba(99, 102, 241, 0.4); background: linear-gradient(180deg, #eef2ff, #e0e7ff); cursor: pointer; text-align: left; }
.upload-btn:hover { border-color: #6366f1; }
.upload-icon { font-size: 26px; }
.upload-title { font-size: 15px; font-weight: 800; color: #0f172a; display: block; }
.upload-sub { font-size: 12px; color: #64748b; }

.recognize { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 40px 20px; text-align: center; }
.spinner { width: 48px; height: 48px; border: 4px solid rgba(99, 102, 241, 0.2); border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.status { font-size: 14px; font-weight: 700; }
.progress { width: 100%; max-width: 320px; height: 10px; border-radius: 5px; background: #e2e8f0; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(180deg, #818cf8, #6366f1); }

.preview-wrapper { width: 100%; max-height: 250px; overflow: hidden; border-radius: 12px; background: #0f172a; display: flex; justify-content: center; border: 1px solid #e2e8f0; }
.preview-canvas { max-width: 100%; max-height: 250px; object-fit: contain; display: block; }

.preview-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
.ph-title { font-size: 13px; font-weight: 800; }
.ph-hint { font-size: 11px; color: #94a3b8; }
.items-list { display: flex; flex-direction: column; gap: 8px; max-height: 40vh; overflow-y: auto; padding-right: 4px; }

/* ✅ Стили для сомнительных операций */
.item-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; border: 1.5px solid #e2e8f0; background: #fff; cursor: pointer; position: relative; }
.item-row.selected { border-color: #6366f1; background: #f5f3ff; }
.item-row.suspicious { border-color: #f59e0b; background: #fffbeb; }
.item-row.suspicious.selected { border-color: #f59e0b; background: #fef3c7; }

.suspicious-badge { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: #f59e0b; color: #fff; font-size: 11px; font-weight: 900; cursor: help; }
.suspicious-hint { font-size: 10.5px; color: #b45309; margin-top: 2px; font-style: italic; }

.item-checkbox { width: 22px; height: 22px; }
.checkbox-inner { width: 100%; height: 100%; border-radius: 6px; border: 2px solid #cbd5e1; display: flex; align-items: center; justify-content: center; }
.checkbox-inner.checked { background: #6366f1; border-color: #6366f1; }
.checkbox-inner svg { width: 14px; height: 14px; color: #fff; }
.item-main { flex: 1; min-width: 0; }
.item-top { display: flex; gap: 8px; margin-bottom: 4px; }
.item-date { font-size: 11px; font-weight: 800; color: #94a3b8; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
.item-date.warning { background: #fef3c7; color: #b45309; animation: pulseWarn 2s infinite; }
@keyframes pulseWarn { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
.item-cat { font-size: 11px; font-weight: 700; color: #6366f1; }
.item-name { font-size: 14px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-amount { font-family: var(--mono); font-size: 15px; font-weight: 800; }
.item-amount.income { color: #16a34a; }
.item-amount.expense { color: #dc2626; }

.error-msg { padding: 10px 14px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-size: 12.5px; font-weight: 700; }
.btn-cancel, .btn-save { padding: 12px 22px; border-radius: 12px; font-family: inherit; font-size: 14px; font-weight: 800; cursor: pointer; border: 1px solid transparent; }
.btn-cancel { background: #f1f5f9; color: #334155; border-color: #e2e8f0; }
.btn-save { background: linear-gradient(180deg, #818cf8, #6366f1); color: #fff; }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
</style>