// frontend/src/composables/useReceiptOCR.js
//
// OCR и разбор скриншотов банковских операций (Т-Банк / Сбер).
//
// Пайплайн:
//   preprocessImage()  -> нормализация размера и контраста (без грубой бинаризации)
//   recognizeText()    -> Tesseract (кэшированный воркер), слова -> строки, уточнение чисел
//   parseBankScreenshot() -> строки -> ряды -> операции (суммы, даты, категории, проверки)
//   mergeOperations()  -> склейка операций с нескольких перекрывающихся скриншотов
//
// Формат операции:
//   { name, amount, type: 'income'|'expense', category, rawCategory,
//     date (ISO с локальным смещением, slice(0,10) = локальная дата), dateLocal ('YYYY-MM-DD'),
//     dateUncertain, timeUncertain, typeGuessed, confidence (0..100),
//     isSuspicious, suspicionReason, dayMismatch, bbox }

// ============================================================
// 1. ПРЕДОБРАБОТКА ИЗОБРАЖЕНИЯ
// ============================================================
const TARGET_WIDTH = 1800;      // оптимальная ширина для Tesseract на скриншотах телефона
const MAX_PIXELS = 12000000;    // потолок размера канваса (iOS Safari падает на больших)

export function preprocessImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        let scale = Math.min(3, Math.max(0.5, TARGET_WIDTH / img.width));
        while (img.width * scale * img.height * scale > MAX_PIXELS && scale > 0.3) scale *= 0.9;

        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        ctx.fillStyle = '#fff';               // прозрачные PNG -> белый фон
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        const n = d.length / 4;

        const gray = new Uint8ClampedArray(n);
        const hist = new Uint32Array(256);
        let sum = 0;
        for (let i = 0, p = 0; i < d.length; i += 4, p++) {
          const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
          gray[p] = g;
          hist[g]++;
          sum += g;
        }
        const isDark = sum / n < 128;

        const percentile = (q) => {
          const target = n * q;
          let acc = 0;
          for (let v = 0; v < 256; v++) {
            acc += hist[v];
            if (acc >= target) return v;
          }
          return 255;
        };
        let lo = percentile(0.01);
        let hi = percentile(0.99);
        if (hi - lo < 40) { lo = 0; hi = 255; }
        const k = 255 / (hi - lo);

        // Растяжка контраста; для тёмной темы инвертируем -> всегда тёмный текст на светлом фоне.
        for (let i = 0, p = 0; i < d.length; i += 4, p++) {
          let v = (gray[p] - lo) * k;
          v = v < 0 ? 0 : v > 255 ? 255 : v;
          if (isDark) v = 255 - v;
          d[i] = d[i + 1] = d[i + 2] = v;
          d[i + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob((blob) => resolve(blob || file), 'image/png');
      } catch (e) {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

// ============================================================
// 2. OCR (кэшированный воркер, слова -> строки, уточнение чисел)
// ============================================================
let workerPromise = null;
let progressCb = null;
let ocrQueue = Promise.resolve();

async function getWorker() {
  if (!window.Tesseract) throw new Error('Tesseract.js не загрузился');
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await window.Tesseract.createWorker('rus+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            progressCb?.(Math.round((m.progress || 0) * 100));
          }
        },
      });
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });
      return worker;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

export async function terminateOCR() {
  if (!workerPromise) return;
  const p = workerPromise;
  workerPromise = null;
  try { (await p).terminate(); } catch (e) { /* ignore */ }
}

function collectRawLines(data) {
  // Tesseract.js v5: data.lines; v6: только blocks -> paragraphs -> lines (и только если запрошено)
  if (Array.isArray(data.lines) && data.lines.length) return data.lines;
  const out = [];
  for (const b of data.blocks || []) {
    for (const p of b.paragraphs || []) {
      for (const l of p.lines || []) out.push(l);
    }
  }
  return out;
}

// Склеиваем слова строки; большой горизонтальный разрыв (колонка "сумма") помечаем табом.
function buildTabText(words) {
  if (!words.length) return '';
  const sorted = [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
  let out = sorted[0].text.trim();
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].bbox;
    const cur = sorted[i].bbox;
    const h = Math.max(1, Math.max(prev.y1 - prev.y0, cur.y1 - cur.y0));
    const gap = cur.x0 - prev.x1;
    out += (gap > 1.2 * h ? '\t' : ' ') + sorted[i].text.trim();
  }
  return out;
}

function replaceLast(str, old, next) {
  const idx = str.lastIndexOf(old);
  if (idx === -1) return str;
  return str.slice(0, idx) + next + str.slice(idx + old.length);
}

// Второй проход: для малоуверенных чисел перераспознаём узкий прямоугольник с whitelist цифр.
async function refineNumbers(worker, image, lines) {
  const cands = [];
  for (const line of lines) {
    const words = line.words || [];
    for (let k = words.length - 1; k >= 0; k--) {
      if (/\d/.test(words[k].text || '')) {
        if (words[k].bbox && (words[k].confidence ?? 100) < 75) cands.push({ line, word: words[k] });
        break;
      }
    }
  }
  if (!cands.length) return;

  await worker.setParameters({
    tessedit_pageseg_mode: '7',
    tessedit_char_whitelist: '0123456789+-.,',
  });
  try {
    for (const { line, word } of cands.slice(0, 30)) {
      const b = word.bbox;
      const rectangle = {
        left: Math.max(0, b.x0 - 6),
        top: Math.max(0, b.y0 - 4),
        width: b.x1 - b.x0 + 12,
        height: b.y1 - b.y0 + 8,
      };
      const { data } = await worker.recognize(image, { rectangle });
      const t = (data.text || '').replace(/\s+/g, '').replace(/[−–—]/g, '-');
      if (!/^[+\-]?\d[\d.,]*$/.test(t)) continue;
      if ((data.confidence ?? 0) <= (word.confidence ?? 0)) continue;

      let next = t;
      const oldSign = (word.text.match(/^[+\-−–—]/) || [''])[0];
      if (oldSign && !/^[+\-]/.test(next)) next = oldSign + next;

      line.text = replaceLast(line.text, word.text, next);
      line.tabText = replaceLast(line.tabText, word.text, next);
    }
  } finally {
    await worker.setParameters({ tessedit_pageseg_mode: '6', tessedit_char_whitelist: '' });
  }
}

async function runRecognize(file, onProgress, options) {
  const worker = await getWorker();
  progressCb = onProgress || null;

  try {
    const { data } = await worker.recognize(file, {}, { blocks: true });
    const rawLines = collectRawLines(data);

    const lines = [];
    if (rawLines.length) {
      for (const l of rawLines) {
        const text = (l.text || '').trim();
        if (!text) continue;
        const words = (l.words || []).filter((w) => w && w.text && w.text.trim() && w.bbox);
        lines.push({
          text,
          tabText: buildTabText(words) || text,
          bbox: l.bbox ? { x0: l.bbox.x0, y0: l.bbox.y0, x1: l.bbox.x1, y1: l.bbox.y1 } : null,
          confidence: Number.isFinite(l.confidence) ? l.confidence : null,
          words,
        });
      }
    } else {
      for (const raw of (data.text || '').split('\n')) {
        const t = raw.trim();
        if (t) lines.push({ text: t, tabText: t, bbox: null, confidence: null, words: [] });
      }
    }

    if (options.refine !== false) {
      try { await refineNumbers(worker, file, lines); } catch (e) { /* уточнение необязательно */ }
    }

    for (const l of lines) delete l.words;
    return { lines, width: data.imageWidth || 0, height: data.imageHeight || 0 };
  } catch (e) {
    await terminateOCR();   // сломанный воркер не переиспользуем
    throw e;
  } finally {
    progressCb = null;
  }
}

export function recognizeText(file, onProgress, options = {}) {
  const job = ocrQueue.then(() => runRecognize(file, onProgress, options));
  ocrQueue = job.catch(() => {});
  return job;
}

// ============================================================
// 3. ОБЩИЕ УТИЛИТЫ
// ============================================================
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const REL_WORDS = ['сегодня', 'вчера', 'позавчера'];

const CATEGORY_WORDS = [
  'Супермаркеты', 'Фастфуд', 'Переводы', 'Заправки', 'Сервис',
  'Кафе и рестораны', 'Транспорт', 'Развлечения', 'Здоровье',
  'Аптеки', 'Одежда и обувь', 'Разное', 'Коммунальные',
  'Связь', 'Подписки', 'Выдача наличных', 'Пополнение',
];

// Синонимы и названия категорий Сбера -> ваши категории. null = "ярлык типа операции", не категория.
const CATEGORY_ALIASES = [
  [/оплата товаров/, null],
  [/фастфуд|фаст фуд|fast ?food|бистро|быстрое питание/, 'Фастфуд'],
  [/рестор|кафе|кофейн|общепит/, 'Кафе и рестораны'],
  [/продукт|супермаркет/, 'Супермаркеты'],
  [/такси|транспорт|метро|каршеринг/, 'Транспорт'],
  [/аптек/, 'Аптеки'],
  [/медиц|здоров|клиник|стоматолог/, 'Здоровье'],
  [/одежд|обув/, 'Одежда и обувь'],
  [/коммунал|жкх|жку/, 'Коммунальные'],
  [/мобильн|связь|интернет/, 'Связь'],
  [/подписк/, 'Подписки'],
  [/налич|банкомат/, 'Выдача наличных'],
  [/пополнен|зачислен/, 'Пополнение'],
  [/перевод/, 'Переводы'],
  [/заправк|азс|топлив/, 'Заправки'],
  [/развлеч|кино|театр/, 'Развлечения'],
];

const JUNK_PREFIXES = [
  'траты', 'доходы', 'расходы', 'поступления', 'итого', 'всего', 'баланс', 'операции',
  'история операций', 'без переводов', 'счета и карты', 'все счета', 'фильтры',
  'категории', 'показать', 'все операции', 'статистика',
];
const JUNK_EXACT = new Set(['все', 'еще', 'назад', 'готово', 'отмена', 'поиск', 'фильтр', 'бюджет', 'аналитика']);
const NAV_WORDS = new Set(['главная', 'платежи', 'чат', 'витрина', 'меню', 'еще', 'история', 'профиль', 'покупки', 'сервисы']);

const BONUS_RE = /(бонус|спасибо|балл)/;
const CASHBACK_RE = /(кэшбэк|кешбэк|кэшбек|кешбек|cashback)/;
const INCOME_HINT_RE = /(пополнени|зачислени|поступлени|возврат|перевод от|зарплат|входящ)/;
const SYSTEM_NAME_RE = /(^|\s)(траты|доходы|баланс|итого|всего|расходы)(\s|$)/;
const STOP_SECONDARY_RE = /(^|\s)(black|блэк|platinum|платинум|карта|счет|счёт)(?=\s|$)/gi;

const PROFILES = {
  tbank: { junkPrefixes: ['кэшбэк за месяц'] },
  sber: { junkPrefixes: ['сбербанк онлайн', 'мои финансы', 'спасибо от сбера'] },
};

const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');

function lev(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = new Array(n + 1);
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[n];
}

function fuzzyFind(word, list, tolFn) {
  const w = norm(word).replace(/[^а-яa-z]/g, '');
  if (w.length < 3) return -1;
  let best = -1;
  let bestD = 99;
  list.forEach((item, i) => {
    const tol = tolFn(item);
    const d = lev(w, item, tol);
    if (d <= tol && d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function cleanRaw(s) {
  return String(s || '')
    .replace(/[\u00A0\u2007\u2009\u202F\u2002\u2003]/g, ' ')
    .replace(/[−–—‒﹣－]/g, '-')
    .replace(/ {2,}/g, ' ')
    .replace(/ ?\t ?/g, '\t')
    .trim();
}

const hasLetters = (s, n = 1) => ((s || '').match(/\p{L}/gu) || []).length >= n;

function median(arr, fallback) {
  if (!arr.length) return fallback;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const pad = (n) => String(n).padStart(2, '0');

function toLocalDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ISO со смещением (2026-11-07T00:30:00+03:00): slice(0,10) даёт локальную дату, а не UTC.
function toLocalISO(d) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${toLocalDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

const sameDay = (a, b) => toLocalDate(a) === toLocalDate(b);

// ---------- время ----------
const TIME_RE = /(^|[^\d:])([01]?\d|2[0-3])[:;]([0-5]\d)(?![\d:])/;
const TIME_G = /(^|[^\d:])([01]?\d|2[0-3])[:;]([0-5]\d)(?![\d:])/g;

function matchTime(s) {
  const m = String(s || '').match(TIME_RE);
  return m ? [parseInt(m[2], 10), parseInt(m[3], 10)] : null;
}

// ---------- суммы ----------
const NUM_SRC = '(\\d{1,3}(?: \\d{3})+|\\d+)(?:[.,](\\d{1,2}))?';
const CUR_SRC = '(₽|руб(?:\\.|лей|ля)?|RUB|[PpРрRВB]\\.?|[?!])?';
const FULL_RE = new RegExp('^([+\\-])?\\s*' + NUM_SRC + '\\s*' + CUR_SRC + '\\s*$', 'i');
const TAIL_RE = new RegExp('(?:^|[\\s(])([+\\-])?\\s*' + NUM_SRC + '\\s*' + CUR_SRC + '\\s*$', 'i');
// "−250 2": Tesseract прочитал ₽ как цифру 2
const MISREAD_RE = new RegExp('(?:^|[\\s(])([+\\-])\\s*' + NUM_SRC + '\\s+\\d\\s*$');

function stripNoise(t) {
  return t
    .replace(TIME_G, '$1 ')                              // время (14:35)
    .replace(/(?:\*+|•+|…|\.{2,})\s*\d{3,4}\b/g, ' ')    // маски карт (*1234)
    .replace(/\d+(?:[.,]\d+)?\s*%/g, ' ')                // проценты, заряд батареи
    .replace(/\b\d{9,}\b/g, ' ');                        // телефоны, длинные номера
}

function toAmount(m) {
  const amount = Math.round(parseFloat(m[2].replace(/ /g, '') + (m[3] ? '.' + m[3] : '')) * 100) / 100;
  if (!(amount > 0) || amount > 50000000) return null;
  return { amount, sign: m[1] || '' };
}

// Ищет сумму в конце строки (правая колонка). Возвращает { amount, sign, signal, left, misread? } или null.
export function findAmount(rawText) {
  const cleaned = cleanRaw(stripNoise(cleanRaw(rawText)));
  const segs = cleaned.split('\t').map((s) => s.trim()).filter(Boolean);
  if (!segs.length) return null;

  // 1) последний сегмент (правая колонка) целиком является суммой
  const last = segs[segs.length - 1];
  let m = last.match(FULL_RE);
  if (m) {
    const a = toAmount(m);
    const signal = !!(m[1] || m[4] || m[3]);
    if (a && (signal || segs.length >= 2)) {
      return { ...a, signal, left: segs.slice(0, -1).join(' ') };
    }
  }

  // 2) сумма в хвосте строки (когда колонки не разделены)
  const flat = segs.join(' ');
  m = flat.match(TAIL_RE);
  if (m) {
    const a = toAmount(m);
    const strongCur = !!m[4] && /^(₽|руб|RUB)/i.test(m[4]);
    if (a && (m[1] || m[3] || strongCur)) {
      return { ...a, signal: true, left: flat.slice(0, m.index) };
    }
  }

  // 3) знак + сумма + лишняя цифра на месте ₽
  m = flat.match(MISREAD_RE);
  if (m) {
    const a = toAmount(m);
    if (a) return { ...a, signal: true, misread: true, left: flat.slice(0, m.index) };
  }
  return null;
}

// ---------- даты ----------
function fuzzyDateWord(word, list, tolFn) {
  return fuzzyFind(word, list, tolFn);
}

function parseDateHeader(rawText, now) {
  const t = cleanRaw(rawText).replace(/\t/g, ' ');
  const WEEKDAY_RE = /(^|[\s,])(пн|вт|ср|чт|пт|сб|вс)(?=[\s,.]|$)\.?/gi;

  const finish = (date, rest) => {
    const restClean = rest.replace(WEEKDAY_RE, ' ').replace(/\d{1,2}\s+[А-Яа-яЁё]{3,9}\.?/, ' ');
    if (/[А-Яа-яЁёA-Za-z]{4,}/.test(restClean)) return null;   // это не заголовок, а операция
    const total = findAmount(restClean);
    return { date, total: total ? total.amount : null };
  };

  // "Сегодня", "Вчера", "Позавчера"
  let m = t.match(/^([А-Яа-яЁё]{4,10})(?=[\s,.:]|$)(.*)$/);
  if (m) {
    const idx = fuzzyDateWord(m[1], REL_WORDS, (r) => (r.length >= 7 ? 2 : 1));
    if (idx >= 0) {
      const days = [0, 1, 2][idx];
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12, 0, 0, 0);
      return finish(d, m[2]);
    }
  }

  // "7 ноября", "7 ноября 2026", "6 ноября, пт"
  m = t.match(/^(\d{1,2})\s+([А-Яа-яЁё]{3,9})\.?(.*)$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = fuzzyDateWord(m[2], MONTHS_GEN, (x) => (x.length >= 6 ? 2 : 1));
    if (day >= 1 && day <= 31 && month >= 0) {
      let rest = m[3];
      let year = null;
      const ym = rest.match(/^[,\s]+(20\d{2})(?!\d)(?!\s*[₽PРр])/);
      if (ym) {
        const y = parseInt(ym[1], 10);
        if (y >= now.getFullYear() - 8 && y <= now.getFullYear()) { year = y; rest = rest.slice(ym[0].length); }
      }
      let d = new Date(year ?? now.getFullYear(), month, day, 12, 0, 0, 0);
      if (d.getMonth() !== month) return null;   // 31 февраля и т.п.
      if (year === null && d.getTime() > now.getTime() + 36 * 3600 * 1000) {
        d = new Date(now.getFullYear() - 1, month, day, 12, 0, 0, 0);
      }
      return finish(d, rest);
    }
  }
  return null;
}

// ---------- мусорные строки ----------
function isJunkText(flat, profile) {
  const low = norm(flat).replace(/\t/g, ' ');
  const letters = low.replace(/[^а-яa-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!letters) return false;
  const words = letters.split(' ');

  if (words.every((w) => NAV_WORDS.has(w))) return true;
  if (JUNK_EXACT.has(letters)) return true;

  for (const p of [...JUNK_PREFIXES, ...(profile.junkPrefixes || [])]) {
    if (letters.startsWith(p)) return true;
    if (p.length >= 5 && lev(letters.slice(0, p.length), p, 1) <= 1) return true;
  }

  // заголовок месяца: "Ноябрь", "Ноябрь 2026"
  const mi = fuzzyFind(words[0], MONTHS_NOM, (x) => (x.length >= 6 ? 2 : 1));
  if (mi >= 0 && words.slice(1).every((w) => w.length < 3)) return true;
  return false;
}

// ---------- имена и категории ----------
function cleanName(s) {
  let t = String(s || '').replace(/\t/g, ' ');
  t = t.replace(TIME_G, '$1 ')
    .replace(/[*•]+\s*\d{3,4}/g, ' ')
    .replace(/[|•·©®@]+/g, ' ')
    .replace(/^[^\p{L}\d]+/u, '')            // иконка слева, распознанная как мусор
    .replace(/^[OoОо0]\s+(?=\S)/u, '')       // иконка, распознанная как одиночная буква
    .replace(/\s+(black|блэк)$/i, '')
    .replace(/[^\p{L}\d)»"'.!]+$/u, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t;
}

function cleanSecondary(s) {
  return String(s || '')
    .replace(/\t/g, ' ')
    .replace(TIME_G, '$1 ')
    .replace(/[·•|]/g, ' ')
    .replace(STOP_SECONDARY_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectCategory(text) {
  const t = norm(text).replace(/[^а-яa-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length < 3) return null;

  const padded = ` ${t} `;
  for (const cat of CATEGORY_WORDS) {
    if (padded.includes(` ${norm(cat)} `)) return cat;
  }
  for (const [re, cat] of CATEGORY_ALIASES) {
    if (re.test(t)) return cat;   // null = ярлык типа операции, не категория
  }
  for (const cat of CATEGORY_WORDS) {
    const nc = norm(cat);
    const tol = nc.length >= 5 ? Math.floor(nc.length * 0.2) : 0;
    if (!tol) continue;
    if (lev(t, nc, tol) <= tol) return cat;
    if (!nc.includes(' ')) {
      for (const w of t.split(' ')) {
        if (w.length >= 5 && lev(w, nc, tol) <= tol) return cat;
      }
    }
  }
  return null;
}

// ============================================================
// 4. РЯДЫ (склейка строк OCR по вертикали)
// ============================================================
function buildRows(textLines) {
  const items = [];
  textLines.forEach((l, idx) => {
    const text = cleanRaw(l.tabText ?? l.text);
    if (!text) return;
    items.push({ text, bbox: l.bbox || null, conf: Number.isFinite(l.confidence) ? l.confidence : null, idx });
  });

  const allBox = items.length > 0 && items.every((i) => i.bbox);
  let groups = [];
  if (allBox) {
    items.sort((a, b) => (a.bbox.y0 + a.bbox.y1) - (b.bbox.y0 + b.bbox.y1) || a.bbox.x0 - b.bbox.x0);
    for (const it of items) {
      const g = groups[groups.length - 1];
      if (g) {
        const a = g[0].bbox;
        const b = it.bbox;
        const overlap = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        const minH = Math.max(1, Math.min(a.y1 - a.y0, b.y1 - b.y0));
        if (overlap > 0.55 * minH) { g.push(it); continue; }
      }
      groups.push([it]);
    }
  } else {
    groups = items.map((i) => [i]);   // нет координат — доверяем порядку Tesseract
  }

  return groups.map((g) => {
    if (g.length > 1) g.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const bbox = g.every((p) => p.bbox)
      ? {
          x0: Math.min(...g.map((p) => p.bbox.x0)),
          y0: Math.min(...g.map((p) => p.bbox.y0)),
          x1: Math.max(...g.map((p) => p.bbox.x1)),
          y1: Math.max(...g.map((p) => p.bbox.y1)),
        }
      : null;
    const confs = g.map((p) => p.conf).filter((c) => c !== null);
    return {
      text: g.map((p) => p.text).join('\t'),
      bbox,
      conf: confs.length ? confs.reduce((s, c) => s + c, 0) / confs.length : null,
      kind: 'text',
      used: false,
    };
  });
}

function unionBbox(rows) {
  const bs = rows.filter((r) => r && r.bbox).map((r) => r.bbox);
  if (!bs.length) return null;
  return {
    x0: Math.min(...bs.map((b) => b.x0)),
    y0: Math.min(...bs.map((b) => b.y0)),
    x1: Math.max(...bs.map((b) => b.x1)),
    y1: Math.max(...bs.map((b) => b.y1)),
  };
}

// ============================================================
// 5. ИЗВЛЕЧЕНИЕ ОПЕРАЦИЙ
// ============================================================
function classifyRows(rows, profile, now) {
  for (const r of rows) {
    const flat = r.text.replace(/\t/g, ' ');

    const hdr = parseDateHeader(r.text, now);
    if (hdr) {
      r.kind = 'date';
      r.date = hdr.date;
      r.total = hdr.total;
      continue;
    }

    const low = norm(flat);
    if (isJunkText(flat, profile) || BONUS_RE.test(low)) { r.kind = 'junk'; continue; }

    const amt = findAmount(r.text);
    if (amt) {
      r.kind = 'op';
      r.amt = amt;
      r.cashbackish = CASHBACK_RE.test(low);
    } else if (!hasLetters(flat, 2)) {
      r.kind = 'junk';    // статус-бар, иконки, одиночные символы
    } else {
      r.kind = 'text';
    }
  }
}

function extractOperations(rows, profile, now) {
  classifyRows(rows, profile, now);

  const heights = rows.filter((r) => r.bbox).map((r) => r.bbox.y1 - r.bbox.y0);
  const medH = median(heights, 30);
  const adjacent = (a, b) => {
    if (!a.bbox || !b.bbox) return true;
    const gap = b.bbox.y0 - a.bbox.y1;
    return gap <= 1.2 * medH && gap > -medH;
  };

  const firstHeader = rows.find((r) => r.kind === 'date');
  const ops = [];
  let curHeader = -1;
  let lastOpIdx = -10;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.kind === 'date') { curHeader = i; continue; }
    if (r.kind !== 'op' || r.used) continue;

    // кэшбэк, прилепленный под операцией, — не отдельная операция
    if (r.cashbackish && r.amt.amount < 300 && i - lastOpIdx <= 2) { r.used = true; continue; }

    // --- название ---
    let name = cleanName(r.amt.left);
    let nameRow = null;
    if (!hasLetters(name, 2)) {
      const prev = rows[i - 1];
      if (prev && prev.kind === 'text' && !prev.used && adjacent(prev, r)) {
        const pn = cleanName(prev.text);
        if (hasLetters(pn, 2)) { name = pn; nameRow = prev; prev.used = true; }
      }
    }
    const nameFound = hasLetters(name, 2);
    if (!nameFound) name = 'Операция';

    // --- вторая строка (категория / время) ---
    let secRow = null;
    const next = rows[i + 1];
    if (next && next.kind === 'text' && !next.used && adjacent(r, next)) {
      const after = rows[i + 2];
      const nextIsNameOfAmountOnly = after && after.kind === 'op'
        && !hasLetters(cleanName(after.amt.left), 2) && adjacent(next, after);
      if (!nextIsNameOfAmountOnly) { secRow = next; next.used = true; }
    }
    const secText = secRow ? cleanSecondary(secRow.text) : '';

    // --- время ---
    let time = null;
    for (const src of [r.text, nameRow && nameRow.text, secRow && secRow.text]) {
      if (src && (time = matchTime(src))) break;
    }

    // --- тип ---
    let type;
    let typeGuessed = false;
    if (r.amt.sign === '+') type = 'income';
    else if (r.amt.sign === '-') type = 'expense';
    else {
      typeGuessed = true;
      type = INCOME_HINT_RE.test(norm(`${name} ${secText}`)) ? 'income' : 'expense';
    }

    // --- категория ---
    const category = detectCategory(secText) || detectCategory(name) || 'Прочее';

    // --- дата ---
    let base;
    let dateUncertain = false;
    if (curHeader >= 0) {
      base = new Date(rows[curHeader].date);
    } else {
      // Заголовок группы прокручен за верхний край: операция новее первой видимой даты.
      dateUncertain = true;
      if (firstHeader) {
        base = new Date(firstHeader.date);
        base.setDate(base.getDate() + 1);
        if (base.getTime() > now.getTime()) base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
      } else {
        base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
      }
    }
    const timeUncertain = !time;
    if (time) base.setHours(time[0], time[1], 0, 0);
    else base.setHours(12, 0, 0, 0);
    if (!time && sameDay(base, now) && base.getTime() > now.getTime()) base = new Date(now);   // сегодня, но "12:00" ещё не наступило

    // --- уверенность ---
    const confs = [r.conf, nameRow && nameRow.conf].filter((c) => c !== null && c !== undefined);
    let confidence = confs.length ? Math.min(...confs) : 80;
    if (!r.amt.signal) confidence -= 12;
    if (r.amt.misread) confidence -= 10;
    if (!nameFound) confidence -= 25;
    if (dateUncertain) confidence -= 10;
    confidence = Math.max(0, Math.min(100, Math.round(confidence)));

    r.used = true;
    lastOpIdx = i;
    ops.push({
      name: name.slice(0, 80),
      amount: r.amt.amount,
      type,
      category,
      rawCategory: secText || null,
      date: toLocalISO(base),
      dateLocal: toLocalDate(base),
      dateUncertain,
      timeUncertain,
      typeGuessed,
      confidence,
      bbox: unionBbox([nameRow, r, secRow]),
      _h: curHeader,
    });
  }

  // --- проверки каждой операции ---
  for (const op of ops) {
    const reasons = [];
    if (op.name === 'Операция') reasons.push('Не удалось определить название');
    else if (op.name.length < 3 || !/\p{L}{2}/u.test(op.name)) reasons.push('Непонятное название');
    if (SYSTEM_NAME_RE.test(norm(op.name))) reasons.push('Похоже на системную информацию');
    if (op.confidence < 55) reasons.push('Низкая уверенность распознавания');
    if (new Date(op.date).getTime() > now.getTime() + 5 * 60000) reasons.push('Дата в будущем');
    if (op.amount >= 10000000) reasons.push('Слишком большая сумма');
    op.isSuspicious = reasons.length > 0;
    op.suspicionReason = reasons.join('; ');
    op.dayMismatch = false;
  }

  // --- сверка с итогами дня из заголовков ---
  const warnings = [];
  const headerIdx = rows.map((r, i) => (r.kind === 'date' ? i : -1)).filter((i) => i >= 0);
  const fmt = (n) => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  headerIdx.forEach((hi, k) => {
    const hr = rows[hi];
    if (!hr.total || headerIdx[k + 1] === undefined) return;   // последняя группа может быть обрезана краем экрана
    const group = ops.filter((o) => o._h === hi);
    if (!group.length) return;
    const exp = group.filter((o) => o.type === 'expense').reduce((s, o) => s + o.amount, 0);
    const inc = group.filter((o) => o.type === 'income').reduce((s, o) => s + o.amount, 0);
    const ok = [exp, inc, Math.abs(inc - exp)].some((v) => Math.abs(v - hr.total) <= 0.51);
    if (!ok) {
      group.forEach((o) => { o.dayMismatch = true; });
      warnings.push(
        `${hr.date.getDate()} ${MONTHS_GEN[hr.date.getMonth()]}: итог дня ${fmt(hr.total)} ₽ не сходится с распознанным ` +
        `(расходы ${fmt(exp)} ₽, доходы ${fmt(inc)} ₽). Проверьте операции за этот день.`
      );
    }
  });

  ops.forEach((o) => { delete o._h; });
  return { ops, warnings };
}

// ============================================================
// 6. ОПРЕДЕЛЕНИЕ БАНКА И ВАЛИДАЦИЯ СКРИНШОТА
// ============================================================
function detectBankType(lines) {
  const full = norm(lines.map((l) => l.text).join(' '));
  let tbank = 0;
  let sber = 0;

  if (/(т-банк|tbank|тинькофф|tinkoff)/.test(full)) tbank += 2;
  if (/(black|блек|блэк)/.test(full)) tbank += 1;
  if (full.includes('кэшбэк') && full.includes('руб')) tbank += 1;

  if (/(сбер|sber)/.test(full)) sber += 2;
  if (full.includes('спасибо') || full.includes('бонусов')) sber += 1;
  if (full.includes('оплата товаров и услуг')) sber += 1;
  if (full.includes('переводы людям')) sber += 1;

  if (tbank > sber) return 'tbank';
  if (sber > tbank) return 'sber';
  return null;
}

function isValidBankScreenshot(lines) {
  const full = norm(lines.map((l) => l.text).join(' '));
  const markers = [
    '₽', 'руб', 'оплата', 'перевод', 'баланс', 'карта', 'счет', 'сбер', 'т-банк', 'tbank',
    'тинькофф', 'история', 'операции', 'траты', 'доходы', 'кэшбэк', 'пополнение', 'списание',
    'сегодня', 'вчера',
  ];
  let found = 0;
  for (const m of markers) if (full.includes(m)) found++;
  if (found < 2) return false;
  if (!/\d{2,}/.test(full)) return false;

  // доля кириллицы считается среди БУКВ (а не среди всех символов)
  let letters = 0;
  let cyr = 0;
  for (const ch of full) {
    if (/\p{L}/u.test(ch)) {
      letters++;
      if (/[а-яё]/.test(ch)) cyr++;
    }
  }
  return letters > 0 && cyr / letters >= 0.3;
}

// ============================================================
// 7. ГЛАВНАЯ ФУНКЦИЯ
// ============================================================
// Один движок для обоих банков: раскладки списка операций почти одинаковые,
// а ошибка в выборе банка больше не ломает разбор. Банк влияет лишь на список "мусорных" строк.
export function parseBankScreenshot(textLines, currentBankType = 'tbank', now = new Date()) {
  if (!textLines || !textLines.length) {
    return { operations: [], suggestedBank: null, bank: currentBankType, warnings: [] };
  }

  const detected = detectBankType(textLines);
  const suggestedBank = detected && detected !== currentBankType ? detected : null;

  if (!isValidBankScreenshot(textLines)) {
    throw new Error('Этот скриншот не похож на выписку из банка. Попробуйте загрузить скриншот операций.');
  }

  const profile = PROFILES[detected || currentBankType] || PROFILES.tbank;
  const rows = buildRows(textLines);
  const { ops, warnings } = extractOperations(rows, profile, now);

  if (!ops.length) {
    if (suggestedBank) return { operations: [], suggestedBank, bank: currentBankType, warnings };
    throw new Error('Не удалось распознать операции. Убедитесь, что на скриншоте есть список операций с суммами.');
  }

  return { operations: ops, suggestedBank, bank: detected || currentBankType, warnings };
}

// ============================================================
// 8. СКЛЕЙКА НЕСКОЛЬКИХ СКРИНШОТОВ
// ============================================================
// Одинаковые операции внутри ОДНОГО скриншота не удаляются (два кофе по 250 ₽ — это два кофе).
// Дубликаты убираются только как перекрывающийся участок двух списков (≥ minOverlap подряд идущих операций).
const opKey = (o) => `${norm(o.name)}|${o.amount}|${o.type}|${o.dateLocal}`;

export function mergeOperations(existing, incoming, minOverlap = 2) {
  const a = existing.map(opKey);
  const b = incoming.map(opKey);
  for (let k = Math.min(a.length, b.length); k >= minOverlap; k--) {
    // конец existing == начало incoming (новый скриншот ниже по ленте)
    if (a.slice(-k).every((x, i) => x === b[i])) return [...existing, ...incoming.slice(k)];
    // начало existing == конец incoming (новый скриншот выше по ленте)
    if (a.slice(0, k).every((x, i) => x === b[b.length - k + i])) return [...incoming.slice(0, b.length - k), ...existing];
  }
  return [...existing, ...incoming];
}