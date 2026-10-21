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
const error = ref('');
const saving = ref(false);
const canvasRef = ref(null);

const userAccounts = computed(() =>
  accounts.accounts.filter(a => (a.owner || 'Сергей') === user.value)
);

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
}

watch(() => props.modelValue, (open) => { if (open) reset(); });
watch(user, () => {
  const accs = userAccounts.value;
  if (!accs.find(a => a.id === accountId.value)) accountId.value = accs[0]?.id || '';
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
    const result = await recognizeText(processed, (pct) => {
      progress.value = pct;
      statusText.value = `Сканирование: ${pct}%`;
    });

    const parsed = parseBankScreenshot(result.lines, 'tbank');

    if (!parsed.operations.length) {
      throw new Error('Не удалось найти операции. Убедитесь, что это скриншот из банка.');
    }

    items.value = parsed.operations;
    selectedIndices.value = new Set(parsed.operations.map((_, i) => i));
    step.value = 'preview';
    await nextTick();
    drawMask();
  } catch (e) {
    console.error('[scan] ошибка OCR:', e);
    error.value = e.message || 'Ошибка распознавания';
    step.value = 'upload';
  }
}

// Маска для скриншота
function drawMask() {
  if (!canvasRef.value || !file.value) return;
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  const img = new Image();

  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'destination-out';
    for (const item of items.value) {
      if (!item.bbox) continue;
      const x = item.bbox.x0 / 2;
      const y = item.bbox.y0 / 2;
      const w = (item.bbox.x1 - item.bbox.x0) / 2;
      const h = (item.bbox.y1 - item.bbox.y0) / 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - 8, y - 8, w + 16, h + 16, 6);
      else ctx.rect(x - 8, y - 8, w + 16, h + 16);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#6366f1';
    for (const item of items.value) {
      if (!item.bbox) continue;
      const x = item.bbox.x0 / 2;
      const y = item.bbox.y0 / 2;
      const w = (item.bbox.x1 - item.bbox.x0) / 2;
      const h = (item.bbox.y1 - item.bbox.y0) / 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - 8, y - 8, w + 16, h + 16, 6);
      else ctx.rect(x - 8, y - 8, w + 16, h + 16);
      ctx.stroke();
    }
  };
  img.src = filePreview.value;
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
  if (!iso) return '??.??';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

const selectedCount = computed(() => selectedIndices.value.size);

async function save() {
  const toSave = items.value.filter((_, i) => selectedIndices.value.has(i));
  if (!toSave.length) { error.value = 'Ничего не выбрано'; return; }

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
            <option v-for="acc in userAccounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
          </select>
        </div>
      </div>

      <div class="field">
        <input id="scanFileInput" type="file" accept="image/*" hidden @change="onFileSelected" />
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

    <div v-else-if="step === 'recognizing'" class="step">
      <div class="recognize">
        <div class="spinner"></div>
        <div class="status">{{ statusText }}</div>
        <div class="progress"><div class="progress-fill" :style="{ width: progress + '%' }"></div></div>
      </div>
    </div>

    <div v-else-if="step === 'preview'" class="step">
      <div class="preview-wrapper">
        <canvas ref="canvasRef" class="preview-canvas"></canvas>
      </div>

      <div class="preview-header">
        <div class="ph-title">Найдено операций: {{ items.length }}</div>
        <div class="ph-hint">Снимите галочки с лишнего</div>
      </div>

      <div class="items-list">
        <div v-for="(it, i) in items" :key="i" class="item-row" :class="{ selected: selectedIndices.has(i) }">
          <input type="checkbox" class="item-check" :checked="selectedIndices.has(i)" @change="toggleItem(i)" />
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
        <button class="btn-save" :disabled="saving || selectedCount === 0" @click="save">
          {{ saving ? 'Сохранение…' : `✅ Добавить (${selectedCount})` }}
        </button>
      </template>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.step { display: flex; flex-direction: column; gap: 16px; }
.mode-switch { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; padding: 4px; margin-bottom: 18px; background: linear-gradient(180deg, #f1f5f9, #e2e8f0); border-radius: 14px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08) inset, 0 1px 0 rgba(255, 255, 255, 0.9); }
.mode { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 12px; border: none; background: transparent; color: #64748b; font-family: inherit; font-size: 12.5px; font-weight: 800; border-radius: 10px; cursor: pointer; transition: all 0.25s cubic-bezier(.34,1.56,.64,1); }
.mode:not(:disabled):hover { color: #4f46e5; background: rgba(255, 255, 255, 0.5); }
.mode.active { background: linear-gradient(180deg, #818cf8, #6366f1); color: #ffffff; box-shadow: 0 1px 0 rgba(255, 255, 255, 0.3) inset, 0 -2px 0 rgba(49, 46, 129, 0.3) inset, 0 4px 10px -2px rgba(99, 102, 241, 0.5); cursor: default; }
.fields-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
.field select { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #fff; color: #0f172a; font-size: 14px; font-weight: 700; outline: none; }
.field select:focus { border-color: #6366f1; }
.upload-btn { display: flex; align-items: center; gap: 16px; width: 100%; padding: 18px 20px; border-radius: 16px; border: 2px dashed rgba(99, 102, 241, 0.4); background: linear-gradient(180deg, #eef2ff, #e0e7ff); cursor: pointer; transition: all 0.2s; text-align: left; }
.upload-btn:hover { border-color: #6366f1; background: linear-gradient(180deg, #e0e7ff, #c7d2fe); }
.upload-icon { font-size: 26px; }
.upload-title { font-size: 15px; font-weight: 800; color: #0f172a; display: block; }
.upload-sub { font-size: 12px; color: #64748b; margin-top: 2px; display: block; }
.recognize { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 40px 20px; text-align: center; }
.spinner { width: 48px; height: 48px; border: 4px solid rgba(99, 102, 241, 0.2); border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite; box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
@keyframes spin { to { transform: rotate(360deg); } }
.status { font-size: 14px; font-weight: 700; color: #0f172a; }
.progress { width: 100%; max-width: 320px; height: 10px; border-radius: 5px; background: #e2e8f0; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(180deg, #818cf8, #6366f1); transition: width 0.3s; }
.preview-wrapper { width: 100%; max-height: 220px; overflow: hidden; border-radius: 12px; background: #0f172a; display: flex; justify-content: center; border: 1px solid #e2e8f0; }
.preview-canvas { max-width: 100%; max-height: 220px; object-fit: contain; display: block; }
.preview-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
.ph-title { font-size: 13px; font-weight: 800; color: #0f172a; }
.ph-hint { font-size: 11px; color: #94a3b8; }
.items-list { display: flex; flex-direction: column; gap: 6px; max-height: 38vh; overflow-y: auto; padding-right: 4px; }
.item-row { display: grid; grid-template-columns: auto 44px 1fr auto; gap: 10px; align-items: center; padding: 12px 14px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; transition: all 0.15s; }
.item-row.selected { border-color: rgba(99, 102, 241, 0.5); background: #f5f3ff; }
.item-check { width: 18px; height: 18px; accent-color: #6366f1; cursor: pointer; }
.item-date { font-size: 11px; font-weight: 800; color: #94a3b8; }
.item-desc { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.item-name { font-size: 13px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-cat { font-size: 11px; color: #64748b; }
.item-amount { font-family: var(--mono); font-size: 13.5px; font-weight: 800; white-space: nowrap; }
.item-amount.income { color: #16a34a; }
.item-amount.expense { color: #dc2626; }
.error-msg { padding: 10px 14px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-size: 12.5px; font-weight: 700; }
.btn-cancel, .btn-save { padding: 12px 22px; border-radius: 12px; font-family: inherit; font-size: 14px; font-weight: 800; cursor: pointer; border: 1px solid transparent; transition: all 0.18s; }
.btn-cancel { background: #f1f5f9; color: #334155; border-color: #e2e8f0; }
.btn-cancel:hover { background: #e2e8f0; }
.btn-save { background: linear-gradient(180deg, #818cf8, #6366f1); color: #fff; box-shadow: 0 4px 10px -2px rgba(99, 102, 241, 0.5); }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-save:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 8px 20px -4px rgba(99, 102, 241, 0.6); }
@media (max-width: 700px) {
  .fields-row { grid-template-columns: 1fr; gap: 12px; }
  .item-row { grid-template-columns: auto 40px 1fr auto; gap: 8px; padding: 10px; }
  .item-date { font-size: 10px; }
  .item-name { font-size: 12.5px; }
  .item-amount { font-size: 12.5px; }
}
</style>