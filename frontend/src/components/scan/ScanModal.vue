<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { fmt } from '@/composables/useFormat';
import { notifySaved, notifyError } from '@/composables/useDataStatus';
import {
  preprocessImage,
  recognizeText,
  parseBankScreenshot,
} from '@/composables/useReceiptOCR';
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

// ✅ Вкладки
const activeTab = ref('scan'); // 'scan' | 'manual' | 'pdf'

// ✅ Общие состояния
const user = ref(auth.user || 'Сергей');
const accountId = ref('');
const bankType = ref('tbank');
const saving = ref(false);
const error = ref('');

const userAccounts = computed(() =>
  accounts.accounts.filter(a => (a.owner || 'Сергей') === user.value)
);

watch(accountId, (newId) => {
  if (newId.startsWith('sber')) bankType.value = 'sber';
  else if (newId.startsWith('tbank')) bankType.value = 'tbank';
}, { immediate: true });

watch(user, () => {
  const accs = userAccounts.value;
  if (!accs.find(a => a.id === accountId.value)) {
    accountId.value = accs[0]?.id || '';
  }
});

// ============================================================
// ЛОГИКА ДЛЯ СКРИНШОТА
// ============================================================
const scanStep = ref('upload'); // upload | recognizing | preview
const scanFile = ref(null);
const scanPreview = ref('');
const progress = ref(0);
const statusText = ref('');
const scanLogs = ref([]);
const currentLogIndex = ref(0);
const scanItems = ref([]);
const scanSelected = ref(new Set());
const canvasRef = ref(null);
const suggestBank = ref(null);
const suggestBankModalOpen = ref(false);

let logInterval = null;
function addLog(text) { scanLogs.value.push(text); }

watch(scanLogs, () => {
  if (!logInterval) {
    logInterval = setInterval(() => {
      if (currentLogIndex.value < scanLogs.value.length - 1) currentLogIndex.value++;
    }, 1500);
  }
});

async function drawMaskedImage() {
  if (!canvasRef.value || !scanFile.value) return;
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
    for (const item of scanItems.value) {
      if (!item.bbox) continue;
      const x = item.bbox.x0 / 2, y = item.bbox.y0 / 2, w = (item.bbox.x1 - item.bbox.x0) / 2, h = (item.bbox.y1 - item.bbox.y0) / 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - 10, y - 10, w + 20, h + 20, 8);
      else ctx.rect(x - 10, y - 10, w + 20, h + 20);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 3;
    for (const item of scanItems.value) {
      if (!item.bbox) continue;
      ctx.strokeStyle = item.isSuspicious ? '#f59e0b' : '#ef4444';
      const x = item.bbox.x0 / 2, y = item.bbox.y0 / 2, w = (item.bbox.x1 - item.bbox.x0) / 2, h = (item.bbox.y1 - item.bbox.y0) / 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - 10, y - 10, w + 20, h + 20, 8);
      else ctx.rect(x - 10, y - 10, w + 20, h + 20);
      ctx.stroke();
    }
  };
  img.src = scanPreview.value;
}

async function onScanFile(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  scanFile.value = f;
  scanPreview.value = URL.createObjectURL(f);
  error.value = '';
  scanStep.value = 'recognizing';
  progress.value = 0;
  statusText.value = 'Подготовка…';
  scanLogs.value = [];
  currentLogIndex.value = 0;
  addLog('Открываю изображение…');

  try {
    const processed = await preprocessImage(f);
    addLog('Обрабатываю картинку…');
    statusText.value = 'Загрузка OCR…';
    
    const result = await recognizeText(processed, (pct) => {
      progress.value = pct;
      statusText.value = `Сканирование: ${pct}%`;
      if (pct === 15) addLog('Распознаю текст…');
      if (pct === 60) addLog('Собираю строки…');
    });
    addLog('Ищу операции…');

    const { operations, suggestedBank: suggested } = parseBankScreenshot(result.lines, bankType.value);

    if (suggested) {
      suggestBank.value = suggested;
      suggestBankModalOpen.value = true;
      if (!operations.length) { scanStep.value = 'upload'; return; }
    }

    if (!operations.length) throw new Error('Не удалось найти операции.');

    addLog(`Нашел: ${operations.length} операций`);
    const suspicious = operations.filter(p => p.isSuspicious).length;
    if (suspicious > 0) addLog(`Сомнительных: ${suspicious}`);

    scanItems.value = operations;
    scanSelected.value = new Set(operations.map((it, i) => it.isSuspicious ? -1 : i).filter(i => i !== -1));
    scanStep.value = 'preview';
    await nextTick();
    drawMaskedImage();
  } catch (e) {
    error.value = e.message || 'Ошибка распознавания';
    scanStep.value = 'upload';
  }
}

function toggleScanItem(i) {
  const set = new Set(scanSelected.value);
  if (set.has(i)) set.delete(i); else set.add(i);
  scanSelected.value = set;
}

async function saveScan() {
  const toSave = scanItems.value.filter((_, i) => scanSelected.value.has(i));
  if (!toSave.length) return;
  if (toSave.some(it => it.dateUncertain)) {
    error.value = 'Укажите дату для операций без даты (желтая плашка)';
    return;
  }

  saving.value = true;
  let added = 0;
  for (const it of toSave) {
    try {
      await txStore.save({
        name: it.name, amount: it.amount, type: it.type, category: it.category || 'Прочее',
        date: it.date, user: user.value, accountId: accountId.value || null, fromScan: true,
      });
      added++;
    } catch (e) {}
  }
  saving.value = false;
  if (added > 0) toast.success(`✅ Добавлено ${added}`);
  emit('update:modelValue', false);
}

async function switchBankAndRescan() {
  if (!suggestBank.value || !scanFile.value) return;
  suggestBankModalOpen.value = false;
  bankType.value = suggestBank.value;
  const targetAcc = userAccounts.value.find(a => a.id.startsWith(suggestBank.value));
  if (targetAcc) accountId.value = targetAcc.id;
  await onScanFile({ target: { files: [scanFile.value] } });
}

// ============================================================
// ЛОГИКА ДЛЯ РУЧНОГО ВВОДА
// ============================================================
const manualForm = ref({
  type: 'expense', name: '', amount: '', category: 'Прочее',
  date: new Date().toISOString().split('T')[0], accountId: ''
});

const INCOME_CATEGORIES = ['Зарплата', 'Аванс', 'Премия', 'Фриланс', 'Бизнес', 'Инвестиции', 'Дивиденды', 'Проценты по вкладу', 'Кэшбэк', 'Возврат', 'Подарки', 'Аренда', 'Перевод от', 'Прочее'];
const EXPENSE_CATEGORIES = ['Продукты', 'Кафе и рестораны', 'Такси', 'Бензин', 'Общественный транспорт', 'Аренда', 'Ипотека', 'Жильё', 'Коммунальные', 'Интернет и связь', 'Развлечения', 'Подписки', 'Покупки', 'Одежда и обувь', 'Техника', 'Аптека', 'Здоровье', 'Спорт', 'Красота', 'Образование', 'Дети', 'Домашние животные', 'Путешествия', 'Кредиты', 'Страхование', 'Налоги', 'Ремонт', 'Автомобиль', 'Гараж', 'Сад и огород', 'Подарки', 'Благотворительность', 'Прочее'];

const manualCategories = computed(() => manualForm.value.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);

watch(() => manualForm.value.user, () => {
  const accs = userAccounts.value;
  manualForm.value.accountId = accs.length ? accs[0].id : '';
}, { immediate: true });

watch(() => manualForm.value.type, () => { manualForm.value.category = 'Прочее'; });

watch(activeTab, (tab) => {
  if (tab === 'manual') {
    manualForm.value = {
      type: 'expense', name: '', amount: '', category: 'Прочее',
      date: new Date().toISOString().split('T')[0], accountId: ''
    };
    const accs = userAccounts.value;
    manualForm.value.accountId = accs.length ? accs[0].id : '';
    error.value = '';
  }
});

const CATEGORY_HINTS = [
  { re: /магнит|пятёрочк|пятерочк|перекресток|лента|ашан|дикси|продукт/i, cat: 'Продукты' },
  { re: /кафе|ресторан|кофе|starbucks|mcdonald|kfc|пицц|суши/i, cat: 'Кафе и рестораны' },
  { re: /такси|taxi|яндекс\s*go|uber|ситимобил/i, cat: 'Такси' },
  { re: /бензин|азс|заправк|газпромнефт|лукойл|роснефт/i, cat: 'Бензин' },
  { re: /аптек|aptek|горздрав/i, cat: 'Аптека' },
  { re: /мтс|билайн|мегафон|теле2|интернет|ростелеком/i, cat: 'Интернет и связь' },
];
watch(() => manualForm.value.name, (name) => {
  if (!name || name.length < 3) return;
  for (const hint of CATEGORY_HINTS) { if (hint.re.test(name)) { manualForm.value.category = hint.cat; return; } }
});

async function saveManual() {
  error.value = '';
  const name = manualForm.value.name.trim();
  const amount = parseFloat(manualForm.value.amount);

  if (!name || name.length < 2) { error.value = 'Введите название'; return; }
  if (!isFinite(amount) || amount <= 0) { error.value = 'Введите сумму больше 0'; return; }
  const d = new Date(manualForm.value.date + 'T12:00:00');
  if (isNaN(d.getTime())) { error.value = 'Некорректная дата'; return; }

  saving.value = true;
  try {
    await txStore.save({
      name, amount, type: manualForm.value.type, category: manualForm.value.category,
      date: d.toISOString(), user: user.value, accountId: manualForm.value.accountId || null, fromManual: true,
    });
    toast.success(`✅ Добавлено: ${name}`);
    emit('update:modelValue', false);
  } catch (e) {
    error.value = e.message || 'Ошибка';
  } finally { saving.value = false; }
}

// ============================================================
// ЛОГИКА ДЛЯ PDF
// ============================================================
const pdfStep = ref('upload'); // upload | preview
const pdfFile = ref(null);
const pdfName = ref('');
const pdfBankHint = ref('auto');
const pdfLoading = ref(false);
const pdfItems = ref([]);
const pdfSelected = ref(new Set());
const pdfMonths = ref([]);

function onPdfFile(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  if (!f.name.toLowerCase().endsWith('.pdf')) { error.value = 'Выберите PDF'; return; }
  pdfFile.value = f;
  pdfName.value = f.name;
  error.value = '';
}

async function parsePdf() {
  if (!pdfFile.value) return;
  pdfLoading.value = true;
  error.value = '';
  try {
    const { bank, operations } = await parsePdfFile(pdfFile.value, pdfBankHint.value);
    if (!operations.length) throw new Error('Не удалось найти операции');

    pdfItems.value = operations;
    pdfSelected.value = new Set(operations.map((_, i) => i));

    const monthsMap = new Map();
    for (const op of operations) {
      const d = new Date(op.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthsMap.has(key)) {
        monthsMap.set(key, { key, year: d.getFullYear(), month: d.getMonth(),
          label: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][d.getMonth()] + ' ' + d.getFullYear(),
          count: 0, active: true });
      }
      monthsMap.get(key).count++;
    }
    pdfMonths.value = Array.from(monthsMap.values()).sort((a, b) => b.year - a.year || b.month - a.month);
    pdfStep.value = 'preview';
  } catch (e) {
    error.value = e.message || 'Ошибка разбора PDF';
  } finally { pdfLoading.value = false; }
}

function togglePdfItem(i) {
  const set = new Set(pdfSelected.value);
  if (set.has(i)) set.delete(i); else set.add(i);
  pdfSelected.value = set;
}

async function savePdf() {
  const toSave = pdfItems.value.filter((_, i) => pdfSelected.value.has(i));
  if (!toSave.length) return;

  saving.value = true;
  let added = 0;
  for (const it of toSave) {
    try {
      await txStore.save({
        name: it.name, amount: it.amount, type: it.type, category: it.category || 'Прочее',
        date: it.date, user: user.value, accountId: accountId.value || null, fromPdf: true,
      });
      added++;
    } catch (e) {}
  }
  saving.value = false;
  if (added > 0) toast.success(`✅ Добавлено ${added}`);
  emit('update:modelValue', false);
}

// ============================================================
// ✅ ГЛАВНЫЙ СБРОС ПРИ ОТКРЫТИИ
// ============================================================
function resetAll() {
  activeTab.value = 'scan';
  error.value = '';
  saving.value = false;

  // Scan
  scanStep.value = 'upload'; scanFile.value = null; scanPreview.value = '';
  scanItems.value = []; scanSelected.value = new Set(); scanLogs.value = []; currentLogIndex.value = 0;
  suggestBank.value = null; suggestBankModalOpen.value = false;
  if (logInterval) { clearInterval(logInterval); logInterval = null; }

  // Manual
  manualForm.value = { type: 'expense', name: '', amount: '', category: 'Прочее', date: new Date().toISOString().split('T')[0], accountId: '' };

  // PDF
  pdfStep.value = 'upload'; pdfFile.value = null; pdfName.value = ''; pdfItems.value = []; pdfSelected.value = new Set(); pdfMonths.value = [];

  user.value = auth.user || 'Сергей';
  accountId.value = userAccounts.value[0]?.id || '';
}

// ✅ ВОТ ОНО! Сбрасываем всё при каждом открытии модалки
watch(() => props.modelValue, (open) => {
  if (open) resetAll();
});

function close() { emit('update:modelValue', false); }
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="📸 Сканирование"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- ✅ ПАНЕЛЬ ВКЛАДОК -->
    <div class="sticky-tabs">
      <div class="mode-switch">
        <button type="button" class="mode" :class="{ active: activeTab === 'scan' }" @click="activeTab = 'scan'">
          <span class="m-icon">📸</span> Скриншот
        </button>
        <button type="button" class="mode" :class="{ active: activeTab === 'manual' }" @click="activeTab = 'manual'">
          <span class="m-icon">✏️</span> Вручную
        </button>
        <button type="button" class="mode" :class="{ active: activeTab === 'pdf' }" @click="activeTab = 'pdf'">
          <span class="m-icon">📄</span> PDF
        </button>
      </div>
    </div>

    <!-- ================= ВКЛАДКА 1: СКРИНШОТ ================= -->
    <div v-if="activeTab === 'scan'" class="step">
      <div v-if="scanStep === 'upload'" class="step">
        <div class="bank-selector">
          <div class="bs-label">Выберите счёт</div>
          <div class="bs-options">
            <button v-for="acc in userAccounts" :key="acc.id" class="bs-btn"
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
          <input id="scanFileInput" type="file" accept="image/*" hidden @change="onScanFile" />
          <button class="upload-btn" type="button" @click="document.getElementById('scanFileInput').click()">
            <span class="upload-icon">🖼️</span>
            <span class="upload-text">
              <span class="upload-title">Выбрать скриншот</span>
              <span class="upload-sub">Скриншот списка операций</span>
            </span>
          </button>
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>

      <!-- Распознавание -->
      <div v-else-if="scanStep === 'recognizing'" class="step">
        <div class="recognize">
          <div class="spinner"></div>
          <div class="status">{{ statusText }}</div>
          <div class="progress"><div class="progress-fill" :style="{ width: progress + '%' }"></div></div>
          <div class="ai-thoughts">
            <div class="ai-thoughts-label">AI Парсер:</div>
            <Transition name="thought-fade" mode="out-in">
              <div class="ai-thoughts-text" :key="currentLogIndex">{{ scanLogs[currentLogIndex] }}</div>
            </Transition>
          </div>
        </div>
      </div>

      <!-- Предпросмотр -->
      <div v-else-if="scanStep === 'preview'" class="step">
        <div v-if="scanPreview" class="preview-wrapper">
          <canvas ref="canvasRef" class="preview-canvas"></canvas>
        </div>
        <div class="preview-header">
          <div class="ph-title">Найдено: {{ scanItems.length }}</div>
          <div class="ph-hint">Снимите галочки с лишнего</div>
        </div>
        <div class="items-list">
          <div v-for="(it, i) in scanItems" :key="i" class="item-row" :class="{ selected: scanSelected.has(i), suspicious: it.isSuspicious }" @click="toggleScanItem(i)">
            <div class="item-checkbox"><div class="checkbox-inner" :class="{ checked: scanSelected.has(i) }"><svg v-if="scanSelected.has(i)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div></div>
            <div class="item-main">
              <div class="item-top">
                <span class="item-date" :class="{ warning: it.dateUncertain }">{{ it.dateUncertain ? '??.??' : new Date(it.date).toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'}) }}</span>
                <span class="item-cat">{{ it.category }}</span>
                <span v-if="it.isSuspicious" class="suspicious-badge">?</span>
              </div>
              <div class="item-name">{{ it.name }}</div>
            </div>
            <div class="item-amount" :class="it.type">{{ it.type === 'income' ? '+' : '−' }} {{ fmt(it.amount) }} ₽</div>
          </div>
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>
    </div>

    <!-- ================= ВКЛАДКА 2: ВРУЧНУЮ ================= -->
    <div v-else-if="activeTab === 'manual'" class="step">
      <div class="form">
        <div class="field">
          <label>Тип</label>
          <div class="type-switch">
            <button type="button" :class="{ active: manualForm.type === 'expense' }" @click="manualForm.type = 'expense'">📉 Расход</button>
            <button type="button" :class="{ active: manualForm.type === 'income' }" @click="manualForm.type = 'income'">📈 Доход</button>
          </div>
        </div>
        <div class="field"><label>📝 Название</label><input v-model="manualForm.name" type="text" placeholder="Например, Магнит" /></div>
        <div class="field"><label>💰 Сумма</label><input v-model="manualForm.amount" type="number" step="0.01" placeholder="0" /></div>
        <div class="field"><label>📁 Категория</label><select v-model="manualForm.category"><option v-for="c in manualCategories" :key="c" :value="c">{{ c }}</option></select></div>
        <div class="row">
          <div class="field"><label>📅 Дата</label><input v-model="manualForm.date" type="date" /></div>
          <div class="field"><label>👤 Кто</label><select v-model="user"><option value="Сергей">👨 Сергей</option><option value="Саша">👩 Саша</option></select></div>
        </div>
        <div class="field"><label>💳 Счёт</label><select v-model="manualForm.accountId"><option v-for="acc in userAccounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option></select></div>
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>
    </div>

    <!-- ================= ВКЛАДКА 3: PDF ================= -->
    <div v-else-if="activeTab === 'pdf'" class="step">
      <div v-if="pdfStep === 'upload'" class="step">
        <div class="field"><label>👤 Кто вносит</label><select v-model="user"><option value="Сергей">👨 Сергей</option><option value="Саша">👩 Саша</option></select></div>
        <div class="field"><label>💳 Счёт</label><select v-model="accountId"><option v-for="acc in userAccounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option></select></div>
        <div class="field"><label>🏦 Банк</label><select v-model="pdfBankHint"><option value="auto">🔍 Авто</option><option value="tbank">🟡 Т-Банк</option><option value="sber">🟢 Сбер</option></select></div>
        <div class="field">
          <label>📄 PDF-файл</label>
          <input id="pdfFileInput" type="file" accept=".pdf" hidden @change="onPdfFile" />
          <button class="upload-btn" type="button" @click="document.getElementById('pdfFileInput').click()">
            <span class="upload-icon">📄</span>
            <span class="upload-text"><span class="upload-title">Выбрать PDF</span><span class="upload-sub">Выписка из банка</span></span>
          </button>
          <div v-if="pdfName" class="file-name">✅ {{ pdfName }}</div>
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>

      <div v-else-if="pdfStep === 'preview'" class="step">
        <div class="preview-header"><div class="ph-title">Найдено: {{ pdfItems.length }}</div></div>
        <div class="items-list">
          <div v-for="(it, i) in pdfItems" :key="i" class="item-row" :class="{ selected: pdfSelected.has(i) }">
            <input type="checkbox" :checked="pdfSelected.has(i)" @change="togglePdfItem(i)" />
            <div class="item-main">
              <div class="item-top"><span class="item-date">{{ new Date(it.date).toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'}) }}</span></div>
              <div class="item-name">{{ it.name }}</div>
            </div>
            <div class="item-amount" :class="it.type">{{ it.type === 'income' ? '+' : '−' }} {{ fmt(it.amount) }} ₽</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Футер -->
    <template #footer>
      <template v-if="activeTab === 'scan'">
        <button v-if="scanStep === 'upload'" class="btn-cancel" @click="close">Отмена</button>
        <button v-else-if="scanStep === 'recognizing'" class="btn-cancel" @click="scanStep = 'upload'">← Отмена</button>
        <template v-else-if="scanStep === 'preview'">
          <button class="btn-cancel" @click="scanStep = 'upload'">← Назад</button>
          <button class="btn-save" :disabled="saving || scanSelected.size === 0" @click="saveScan">{{ saving ? 'Сохранение…' : `✅ Добавить (${scanSelected.size})` }}</button>
        </template>
      </template>

      <template v-else-if="activeTab === 'manual'">
        <button class="btn-cancel" @click="close">Отмена</button>
        <button class="btn-save" :disabled="saving" @click="saveManual">{{ saving ? 'Сохранение…' : '💾 Добавить' }}</button>
      </template>

      <template v-else-if="activeTab === 'pdf'">
        <button v-if="pdfStep === 'upload'" class="btn-cancel" @click="close">Отмена</button>
        <button v-if="pdfStep === 'upload'" class="btn-save" :disabled="!pdfFile || pdfLoading" @click="parsePdf">{{ pdfLoading ? 'Разбор…' : '🔍 Разобрать' }}</button>
        <template v-else-if="pdfStep === 'preview'">
          <button class="btn-cancel" @click="pdfStep = 'upload'">← Назад</button>
          <button class="btn-save" :disabled="saving" @click="savePdf">{{ saving ? 'Сохранение…' : '✅ Добавить' }}</button>
        </template>
      </template>
    </template>

    <!-- Модалка подсказки банка -->
    <Modal :model-value="suggestBankModalOpen" title="🤔 Ошибка выбора" @update:model-value="suggestBankModalOpen = false">
      <div style="padding: 4px 0; font-size: 14px; line-height: 1.5;">
        Похоже, это <strong>{{ suggestBank === 'sber' ? 'СберБанк' : 'Т-Банк' }}</strong>. Переключить?
      </div>
      <template #footer>
        <button class="btn-cancel" @click="suggestBankModalOpen = false">Нет</button>
        <button class="btn-save" @click="switchBankAndRescan">Да</button>
      </template>
    </Modal>
  </Modal>
</template>

<style scoped lang="scss">
/* Вкладки */
.sticky-tabs { position: sticky; top: -16px; z-index: 100; background: #fff; padding: 16px 0 12px; margin: -16px 0 12px; border-bottom: 1px solid #e2e8f0; }
.mode-switch { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; padding: 4px; background: linear-gradient(180deg, #f1f5f9, #e2e8f0); border-radius: 14px; }
.mode { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 12px; border: none; background: transparent; color: #64748b; font-family: inherit; font-size: 12.5px; font-weight: 800; border-radius: 10px; cursor: pointer; }
.mode.active { background: linear-gradient(180deg, #818cf8, #6366f1); color: #fff; box-shadow: 0 1px 0 rgba(255,255,255,0.3) inset, 0 -2px 0 rgba(49,46,129,0.3) inset, 0 4px 10px -2px rgba(99,102,241,0.5); }

/* Остальные стили (немного дублируются из старых файлов) */
.step { display: flex; flex-direction: column; gap: 16px; }
.bank-selector { margin-bottom: 16px; }
.bs-label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
.bs-options { display: flex; gap: 10px; }
.bs-btn { flex: 1; display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #fff; cursor: pointer; }
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

.ai-thoughts { width: 100%; max-width: 320px; margin-top: 16px; padding: 10px 14px; background: rgba(99, 102, 241, 0.05); border: 1px dashed rgba(99, 102, 241, 0.3); border-radius: 10px; text-align: left; min-height: 52px; display: flex; flex-direction: column; justify-content: center; }
.ai-thoughts-label { font-size: 10px; font-weight: 800; color: #818cf8; text-transform: uppercase; margin-bottom: 2px; }
.ai-thoughts-text { font-size: 12px; font-weight: 600; color: #4f46e5; line-height: 1.3; }
.thought-fade-enter-active, .thought-fade-leave-active { transition: all 0.3s ease; }
.thought-fade-enter-from { opacity: 0; transform: translateY(4px); }
.thought-fade-leave-to { opacity: 0; transform: translateY(-4px); }

.preview-wrapper { width: 100%; max-height: 250px; overflow: hidden; border-radius: 12px; background: #0f172a; display: flex; justify-content: center; border: 1px solid #e2e8f0; }
.preview-canvas { max-width: 100%; max-height: 250px; object-fit: contain; display: block; }

.preview-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
.ph-title { font-size: 13px; font-weight: 800; }
.ph-hint { font-size: 11px; color: #94a3b8; }
.items-list { display: flex; flex-direction: column; gap: 8px; max-height: 40vh; overflow-y: auto; padding-right: 4px; }

.item-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; border: 1.5px solid #e2e8f0; background: #fff; cursor: pointer; position: relative; }
.item-row.selected { border-color: #6366f1; background: #f5f3ff; }
.item-row.suspicious { border-color: #f59e0b; background: #fffbeb; }
.item-row.suspicious.selected { border-color: #f59e0b; background: #fef3c7; }

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

.suspicious-badge { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: #f59e0b; color: #fff; font-size: 11px; font-weight: 900; cursor: help; }

.form { display: flex; flex-direction: column; gap: 12px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.type-switch { display: inline-flex; gap: 0; padding: 3px; background: #f1f5f9; border-radius: 10px; }
.type-switch button { flex: 1; padding: 8px 14px; border: none; background: transparent; color: var(--muted); font-family: inherit; font-size: 13px; font-weight: 700; border-radius: 7px; cursor: pointer; transition: all 0.18s; }
.type-switch button.active { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; box-shadow: 0 4px 12px -4px rgba(59, 130, 246, 0.6); }

.error-msg { padding: 10px 14px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-size: 12.5px; font-weight: 700; }
.btn-cancel, .btn-save { padding: 12px 22px; border-radius: 12px; font-family: inherit; font-size: 14px; font-weight: 800; cursor: pointer; border: 1px solid transparent; }
.btn-cancel { background: #f1f5f9; color: #334155; border-color: #e2e8f0; }
.btn-save { background: linear-gradient(180deg, #818cf8, #6366f1); color: #fff; }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
</style>