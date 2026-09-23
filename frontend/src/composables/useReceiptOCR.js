/**
 * OCR-обработка чеков и скриншотов банковских приложений через Tesseract.js
 * Портировано из рабочего scan.js (чистый JS).
 * ✅ Округление сумм до целого.
 * ✅ Поддержка всех видов минусов (−, –, —, -).
 * ✅ Отладка extractAmount.
 */

export function preprocessImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avg = sum / (data.length / 4);
      const invert = avg < 128;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], b = data[i + 2];
        if (invert) { r = 255 - r; g = 255 - g; b = 255 - b; }

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max - min;

        let v;
        if (saturation > 60) v = 0;
        else {
          const gray = (r + g + b) / 3;
          v = gray > 130 ? 255 : 0;
        }
        data[i] = data[i + 1] = data[i + 2] = v;
      }

      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(blob => resolve(blob), 'image/png');
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

export async function recognizeText(file, onProgress) {
  if (!window.Tesseract) {
    throw new Error('Tesseract.js не загрузился');
  }

  const worker = await Tesseract.createWorker('rus+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round((m.progress || 0) * 100);
        onProgress?.(pct);
      }
    },
  });

  const { data } = await worker.recognize(file);
  await worker.terminate();

  const textLines = [];
  if (data.lines && Array.isArray(data.lines)) {
    for (const line of data.lines) {
      const t = (line.text || '').trim();
      if (!t) continue;
      textLines.push({
        text: t,
        bbox: line.bbox || null,
      });
    }
  } else {
    const lines = (data.text || '').split('\n');
    for (const l of lines) {
      const t = l.trim();
      if (!t) continue;
      textLines.push({ text: t, bbox: null });
    }
  }

  console.log('[scan] OCR lines:', textLines);

  return textLines;
}

/* ============================================================
   КАТЕГОРИИ
   ============================================================ */
const CATEGORY_MAP = {
  'супермаркеты': 'Продукты',
  'продукты': 'Продукты',
  'медицина': 'Здоровье',
  'аптеки': 'Аптека',
  'различные товары': 'Покупки',
  'покупки': 'Покупки',
  'фастфуд': 'Кафе и рестораны',
  'кафе и рестораны': 'Кафе и рестораны',
  'рестораны': 'Кафе и рестораны',
  'транспорт': 'Транспорт',
  'такси': 'Такси',
  'бензин': 'Бензин',
  'азс': 'Бензин',
  'заправки': 'Бензин',
  'красота': 'Красота',
  'развлечения': 'Развлечения',
  'подписки': 'Подписки',
  'связь': 'Интернет и связь',
  'интернет': 'Интернет и связь',
  'телеком': 'Интернет и связь',
  'мобильная связь': 'Интернет и связь',
  'жкх': 'Коммунальные',
  'коммунальные': 'Коммунальные',
  'путешествия': 'Путешествия',
  'образование': 'Образование',
  'кредиты': 'Кредиты',
  'страхование': 'Страхование',
  'налоги': 'Налоги',
  'штрафы': 'Налоги',
  'госуслуги': 'Налоги',
  'авто': 'Автомобиль',
  'автомобиль': 'Автомобиль',
  'животные': 'Домашние животные',
  'благотворительность': 'Благотворительность',
  'ремонт': 'Ремонт',
  'одежда и обувь': 'Одежда и обувь',
  'зарплата': 'Зарплата',
  'перевод от': 'Перевод от',
  'перевод': 'Перевод между счетами',
  'кэшбэк': 'Кэшбэк',
  'возврат': 'Возврат',
  'проценты': 'Проценты по вкладу',
  'услуги': 'Прочее',
};

function detectCategory(line) {
  if (!line) return 'Прочее';
  const low = line.toLowerCase().trim();

  if (CATEGORY_MAP[low]) return CATEGORY_MAP[low];

  for (const key of Object.keys(CATEGORY_MAP)) {
    if (low.startsWith(key)) return CATEGORY_MAP[key];
  }

  if (/магнит|пятёрочк|пятерочк|перекресток|лента|ашан|дикси|fix\s*price|красное|k&b|sp_/i.test(low)) return 'Продукты';
  if (/mcdonald|kfc|burger|пицц|додо|вкусно|parovoz|subway/i.test(low)) return 'Кафе и рестораны';
  if (/yandex|яндекс|такси|uber|ситимобил/i.test(low)) return 'Такси';
  if (/azs|азс|газпромнефт|лукойл|роснефт|бензин/i.test(low)) return 'Бензин';
  if (/мтс|билайн|мегафон|теле2|ростелеком/i.test(low)) return 'Интернет и связь';
  if (/medcentr|медцентр|smc\s+dobryj|доктор|клиник|zdorove|медицина/i.test(low)) return 'Здоровье';
  if (/аптек|aptek|gorzdrav/i.test(low)) return 'Аптека';
  if (/netflix|spotify|яндекс\s*плюс|ivi|okko|подписк/i.test(low)) return 'Подписки';
  if (/ozon|озон|wildberries|вайлдберриз|avito/i.test(low)) return 'Покупки';

  return 'Прочее';
}

/* ============================================================
   ПАРСЕР
   ============================================================ */

// ✅ Сумма: последнее число, поддерживаем все виды минусов
const AMOUNT_RE = /([+\-−–—]?\s*\d[\d\s]*(?:[.,]\d{1,2})?)[^\d]*$/;

const MONTHS_RU = '(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)';
const DATE_LINE_RE = new RegExp(
  '^\\s*(\\d{1,2})\\s*' + MONTHS_RU + '[а-яё]*' +
  '(?:\\s+(\\d{4}))?' +
  '(?:\\s*[\\.…\\-–—]+\\s*[+\\-−]?[\\d\\s,.]+(?:[₽pPрРгГ]|руб)?)?\\s*$',
  'i'
);
const DATE_NUM_RE = /^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?\s*$/;

const SUMMARY_LINE_RE = /^(итого|итог|баланс|всего|траты|доходы|расходы|сумма|выписка|операции|сентябрь|октябрь|ноябрь|декабрь|январь|февраль|март|апрель|май|июнь|июль|август)\b/i;

const MONTH_INDEX = {
  'январ': 0, 'феврал': 1, 'март': 2, 'апрел': 3,
  'май': 4, 'мая': 4, 'июн': 5, 'июл': 6,
  'август': 7, 'сентябр': 8, 'октябр': 9, 'ноябр': 10, 'декабр': 11,
};

function looksLikeFilterLine(s) {
  if (!s) return false;
  if (/[▾▼▲]/.test(s)) return true;
  const words = s.split(/\s+/);
  if (words.length >= 2 && words.length <= 4 &&
      !/\d/.test(s) && !/[₽]/.test(s) &&
      /^(все|доходы|расходы|счета|карты|без|переводов|сентябр|октябр|ноябр|декабр|январ|феврал|март|апрел|ма|июн|июл|август)/i.test(s)) {
    return true;
  }
  return false;
}

function isDateLine(s) {
  if (!s) return false;
  const lower = s.toLowerCase().trim();
  if (/^[вb][чc][её]?ра[\s,.:;\-—–0-9₽pPрРгГ]*$/i.test(lower)) return true;
  if (/^[вb][чc][её]ра\b/i.test(lower)) return true;
  if (/^поза[вb][чc][её]ра[\s,.:;\-—–0-9₽pPрРгГ]*$/i.test(lower)) return true;
  if (/поза[вb][чc][её]ра/i.test(lower)) return true;
  if (/^[сc][её]годня[\s,.:;\-—–0-9₽pPрРгГ]*$/i.test(lower)) return true;
  if (/^[сc][её]годня\b/i.test(lower)) return true;
  if (DATE_LINE_RE.test(s)) return true;
  if (DATE_NUM_RE.test(s)) return true;
  return false;
}

function extractDate(s) {
  if (!s) return null;
  const lower = s.toLowerCase().trim();

  if (/поза[вb][чc][её]ра/i.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  if (/[вb][чc][её]ра/i.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  if (/[сc][её]годня/i.test(lower)) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }

  const mRu = lower.match(
    new RegExp('(\\d{1,2})\\s*' + MONTHS_RU + '[а-яё]*(?:\\s+(\\d{4}))?', 'i')
  );
  if (mRu) {
    const day = parseInt(mRu[1], 10);
    const monthKey = Object.keys(MONTH_INDEX).find(k => mRu[0].includes(k));
    const month = monthKey !== undefined ? MONTH_INDEX[monthKey] : null;
    let year = mRu[2] ? parseInt(mRu[2], 10) : new Date().getFullYear();
    if (month !== null && day >= 1 && day <= 31) {
      return new Date(year, month, day, 12, 0, 0);
    }
  }

  const mNum = s.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (mNum) {
    const day = parseInt(mNum[1], 10);
    const month = parseInt(mNum[2], 10) - 1;
    let year = parseInt(mNum[3], 10);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      return new Date(year, month, day, 12, 0, 0);
    }
  }

  return null;
}

/**
 * Извлечь сумму. ✅ ОКРУГЛЯЕМ ДО ЦЕЛОГО.
 * ✅ Поддерживаем все виды минусов: - − – —
 */
function extractAmount(s) {
  if (!s) return null;
  const m = s.match(AMOUNT_RE);
  if (!m) return null;

  const raw = m[1];
  let sign = null;
  let amountStr = raw;

  // ✅ Универсальная проверка знака
  if (/^[+＋]/.test(raw.trim())) {
    sign = '+';
    amountStr = raw.replace(/^[+＋]/, '').trim();
  } else if (/^[\-−–—]/.test(raw.trim())) {
    sign = '-';
    amountStr = raw.replace(/^[\-−–—]/, '').trim();
  }

  const clean = amountStr.replace(/\s+/g, '').replace(',', '.');
  const parsed = parseFloat(clean);

  if (!isFinite(parsed) || parsed <= 0) return null;

  const amount = Math.round(parsed);

  if (amount <= 0 || amount > 10000000) return null;

  const mIdx = s.indexOf(raw, m.index || 0);
  const rest = s.slice(0, mIdx >= 0 ? mIdx : 0).trim();

  return { amount, sign, raw, rest };
}

function looksLikeTitle(s) {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 2) return false;
  if (!/[\u0400-\u04FFa-zA-Z]/.test(t)) return false;
  if (SUMMARY_LINE_RE.test(t)) return false;
  if (looksLikeFilterLine(t)) return false;
  return true;
}

function looksLikeCategory(s) {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 3 || t.length > 40) return false;
  if (/\d/.test(t)) return false;
  if (!/^[А-ЯA-ZЁ]/.test(t)) return false;
  if (SUMMARY_LINE_RE.test(t)) return false;
  if (looksLikeFilterLine(t)) return false;
  if (t.split(/\s+/).length > 3) return false;
  return true;
}

function isAmountLine(s) {
  if (!s) return false;
  return /^[+\-−–—\s]*\d[\d\s.,]*\s*(?:[₽pPрРгГ]|руб\.?)?$/.test(s.trim());
}

const CARD_TYPES = /^(дебетовая|кредитная|виртуальная|зарплатная|детская)\s+карта$/i;

function isMetadataLine(s) {
  if (!s) return false;
  const low = s.toLowerCase().trim();

  if (CARD_TYPES.test(low)) return true;

  const cleaned = low
    .replace(/(дебетовая|кредитная|виртуальная|зарплатная|детская)/g, '')
    .replace(/(карта|счёт|счет)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return true;

  if (CATEGORY_MAP[cleaned]) return true;

  return false;
}

/**
 * Главная функция.
 */
export function parseReceipt(textLines) {
  const lines = [];
  for (let idx = 0; idx < textLines.length; idx++) {
    const li = textLines[idx];
    const t = (li.text || '').trim();
    if (!t) continue;
    lines.push({ text: t, order: idx });
  }

  lines.forEach(l => {
    l.text = l.text
      .replace(/^[\\|*`~^\[\]{}]+/g, ' ')
      .replace(/[\\|*`~^\[\]{}]+$/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  });

  const items = [];

  let currentDate = new Date();
  currentDate.setHours(12, 0, 0, 0);

  function buildItem(title, category, amt, date) {
    let type = 'expense';
    if (amt.sign === '+') type = 'income';
    else if (amt.sign === '-') type = 'expense';

    const rawTitle = (title || '').trim();
    const cleanTitle = rawTitle
      .replace(/\s+[оиcсОИCС]\s+Black\s*$/gi, '')
      .replace(/\s+Black\s*$/gi, '')
      .replace(/[\-\+\—–_\\|*`~^\[\]{}]+\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    let finalCategory = 'Прочее';

    if (category) {
      const clean = category
        .replace(/\s+[оиcсОИCС]\s+Black\s*/gi, ' ')
        .replace(/\s+Black\s*/gi, ' ')
        .replace(/\s+Дебетовая\s+карта\s*/gi, ' ')
        .replace(/\s+Кредитная\s+карта\s*/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (clean) {
        finalCategory = detectCategory(clean);
      }
    }

    if (finalCategory === 'Прочее') {
      finalCategory = detectCategory(cleanTitle);
    }

    return {
      date: date.toISOString(),
      description: cleanTitle.slice(0, 80),
      amount: amt.amount,
      type,
      category: finalCategory,
    };
  }

  let i = 0;
  while (i < lines.length) {
    const cur = lines[i];
    const curText = cur.text;

    // 1. Дата?
    if (isDateLine(curText)) {
      const d = extractDate(curText);
      if (d) currentDate = d;
      i++;
      continue;
    }

    // 2. Метаданные / фильтры / сводки
    if (isMetadataLine(curText)) { i++; continue; }
    if (looksLikeFilterLine(curText)) { i++; continue; }

    const roubles = (curText.match(/[₽рРPpL]/g) || []).length;
    if (roubles >= 2) { i++; continue; }

    if (SUMMARY_LINE_RE.test(curText) && !extractAmount(curText)) { i++; continue; }

    // 3. Сумма?
    const amt = extractAmount(curText);

    if (amt) {
      let title = '';
      let category = '';

      if (amt.rest && looksLikeTitle(amt.rest)) {
        title = amt.rest;

        if (i + 1 < lines.length) {
          const next = lines[i + 1];
          if (looksLikeCategory(next.text)) {
            category = next.text;
            items.push(buildItem(title, category, amt, currentDate));
            i += 2;
            continue;
          }
        }

        items.push(buildItem(title, '', amt, currentDate));
        i++;
        continue;
      }

      if (i - 1 >= 0) {
        const prev = lines[i - 1];

        if (looksLikeCategory(prev.text) && i - 2 >= 0) {
          const prev2 = lines[i - 2];
          if (looksLikeTitle(prev2.text) && !isAmountLine(prev2.text)) {
            title = prev2.text;
            category = prev.text;
          }
        }

        if (!title && looksLikeTitle(prev.text) && !isAmountLine(prev.text)) {
          title = prev.text;
        }
      }

      if (title) {
        items.push(buildItem(title, category, amt, currentDate));
      }

      i++;
      continue;
    }

    i++;
  }

  console.log('[scan] ИТОГО операций:', items.length);
  console.log('[scan] разобранные операции:', items);

  return items;
}