// frontend/src/composables/useReceiptOCR.js

/* ============================================================
   Предобработка изображения
   ============================================================ */
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

/* ============================================================
   OCR
   ============================================================ */
export async function recognizeText(file, onProgress) {
  if (!window.Tesseract) throw new Error('Tesseract.js не загрузился');

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
      textLines.push({ text: t, bbox: line.bbox || null });
    }
  } else {
    const lines = (data.text || '').split('\n');
    for (const l of lines) {
      const t = l.trim();
      if (!t) continue;
      textLines.push({ text: t, bbox: null });
    }
  }

  return { lines: textLines, width: data.imageWidth || 0, height: data.imageHeight || 0 };
}

// ============================================================
// ОБЩИЕ УТИЛИТЫ
// ============================================================
const MONTHS = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
  'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
};

const CATEGORY_WORDS = [
  'Супермаркеты', 'Фастфуд', 'Переводы', 'Заправки', 'Сервис',
  'Кафе и рестораны', 'Транспорт', 'Развлечения', 'Здоровье',
  'Аптеки', 'Одежда и обувь', 'Разное', 'Коммунальные',
  'Связь', 'Подписки', 'Выдача наличных', 'Пополнение'
];

function extractCategory(text) {
  const low = (text || '').toLowerCase();
  for (const cat of CATEGORY_WORDS) {
    if (low.includes(cat.toLowerCase())) return cat;
  }
  return 'Прочее';
}

function detectBankType(lines) {
  const fullText = lines.map(l => l.text).join(' ').toLowerCase();
  let tbankScore = 0;
  let sberScore = 0;

  if (fullText.includes('т-банк') || fullText.includes('tbank') || fullText.includes('тинькофф')) tbankScore += 2;
  if (fullText.includes('black') || fullText.includes('блек')) tbankScore += 1;
  if (fullText.includes('кэшбэк') && fullText.includes('руб')) tbankScore += 1;

  if (fullText.includes('сбер') || fullText.includes('sber')) sberScore += 2;
  if (fullText.includes('спасибо') || fullText.includes('бонусов')) sberScore += 1;
  if (fullText.includes('оплата товаров и услуг')) sberScore += 1;
  if (fullText.includes('переводы людям')) sberScore += 1;

  if (tbankScore > sberScore) return 'tbank';
  if (sberScore > tbankScore) return 'sber';
  return null;
}

function isValidBankScreenshot(lines) {
  const fullText = lines.map(l => l.text).join(' ').toLowerCase();
  const bankMarkers = ['₽', 'руб', 'оплата', 'перевод', 'баланс', 'карта', 'счёт', 'счет', 'сбер', 'т-банк', 'tbank', 'история', 'операции'];
  let foundMarkers = 0;
  for (const marker of bankMarkers) {
    if (fullText.includes(marker)) foundMarkers++;
  }
  if (foundMarkers === 0) return false;

  let russianLettersCount = 0;
  let totalCharsCount = 0;
  for (const line of lines) {
    const t = line.text || '';
    totalCharsCount += t.length;
    for (let i = 0; i < t.length; i++) {
      if (t.charCodeAt(i) >= 1040 && t.charCodeAt(i) <= 1103) {
        russianLettersCount++;
      }
    }
  }
  if (totalCharsCount > 0 && (russianLettersCount / totalCharsCount) < 0.3) {
    return false;
  }
  return true;
}

// ============================================================
// ОБЩИЕ РЕГУЛЯРКИ
// ============================================================
const DATE_WORD_RE = /(Сегодня|Вчера|Позавчера)/i;
const DATE_NUM_RE = /(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:[,\s]+([а-я]{2}))?/i;

// 🚫 Служебные слова — если в строке есть хоть одно, это НЕ операция
const SERVICE_WORDS = [
  'аналитика', 'обновляем', 'всего', 'остаток', 'баланс',
  'лимит', 'кэшбэк', 'бонус', 'рассрочк', 'страховк',
  'накопительн', 'переводы людям', 'переводы с карты',
  'операции', 'история', 'траты за', 'доходы за',
];

function isServiceLine(text) {
  const low = (text || '').toLowerCase();
  if (!low) return true;
  return SERVICE_WORDS.some(w => low.includes(w));
}

/**
 * Определяем дату из строки-заголовка.
 * Возвращает Date или null.
 */
function parseDateFromLine(text) {
  // «Сегодня» / «Вчера» / «Позавчера»
  const wordMatch = text.match(DATE_WORD_RE);
  if (wordMatch) {
    const word = wordMatch[0].toLowerCase();
    const d = new Date();
    if (word === 'вчера') d.setDate(d.getDate() - 1);
    else if (word === 'позавчера') d.setDate(d.getDate() - 2);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  // «19 октября» / «19 октября, пн»
  const numMatch = text.match(DATE_NUM_RE);
  if (numMatch) {
    const day = parseInt(numMatch[1], 10);
    const month = MONTHS[numMatch[2].toLowerCase()];
    if (month === undefined) return null;
    const now = new Date();
    let year = now.getFullYear();
    // Если месяц ещё не наступил — значит, это прошлый год
    if (month > now.getMonth()) year -= 1;
    return new Date(year, month, day, 12, 0, 0);
  }

  return null;
}

/**
 * Проверяем, является ли строка заголовком дня.
 * Заголовок — это строка, которая состоит ИЗ даты (или почти из неё),
 * а не содержит дату посреди описания.
 */
function isDayHeader(text) {
  const clean = text.trim();
  if (clean.length > 30) return false; // заголовки короткие

  // «Сегодня», «Вчера», «Позавчера»
  if (/^(Сегодня|Вчера|Позавчера)$/i.test(clean)) return true;

  // «19 октября» или «19 октября, пн»
  if (/^\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:[,\s]+[а-я]{2})?$/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Извлекаем сумму из строки.
 * Возвращает { amount, sign } или null.
 * Требует, чтобы у числа был явный знак + или −, либо строка заканчивалась на «₽».
 */
function extractAmount(text) {
  // 1) Явный знак + сумма (+ 1 000 ₽ / − 1227,51 ₽)
  const signed = text.match(/([+\-−])\s*(\d[\d\s]*(?:[.,]\d{1,2})?)\s*[₽pPрР]?\s*$/);
  if (signed) {
    const raw = signed[2].replace(/\s+/g, '').replace(',', '.');
    const amount = parseFloat(raw);
    if (isFinite(amount) && amount > 0) {
      return { amount, sign: signed[1] === '+' ? '+' : '-' };
    }
  }

  // 2) Без знака, но с «₽» в конце (бывает в Сбере)
  const noSign = text.match(/(\d[\d\s]*(?:[.,]\d{1,2})?)\s*[₽pPрР]\s*$/);
  if (noSign) {
    const raw = noSign[1].replace(/\s+/g, '').replace(',', '.');
    const amount = parseFloat(raw);
    if (isFinite(amount) && amount > 0) {
      return { amount, sign: '-' }; // по умолчанию расход
    }
  }

  return null;
}

// ============================================================
// ПАРСЕР ДЛЯ Т-БАНКА
// ============================================================
function parseTbank(lines) {
  const parsedItems = [];
  const now = new Date();
  let defaultYear = now.getFullYear();
  let currentDate = new Date();
  currentDate.setHours(12, 0, 0, 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = (line.text || '').trim();
    if (!text) continue;
    const y = line.bbox ? line.bbox.y0 : 0;

    // ✅ Заголовок дня — обновляем текущую дату
    if (isDayHeader(text)) {
      const d = parseDateFromLine(text);
      if (d) currentDate = d;
      continue;
    }

    // 🚫 Служебные строки — пропускаем
    if (isServiceLine(text)) continue;

    // ✅ Пытаемся извлечь сумму
    const amt = extractAmount(text);
    if (!amt) continue;

    const amount = Math.round(amt.amount);
    if (amount <= 0) continue;

    const type = amt.sign === '+' ? 'income' : 'expense';

    // Описание: всё до суммы
    let description = text
      .replace(/([+\-−])\s*(\d[\d\s]*(?:[.,]\d{1,2})?)\s*[₽pPрР]?\s*$/, '')
      .replace(/(\d[\d\s]*(?:[.,]\d{1,2})?)\s*[₽pPрР]\s*$/, '')
      .trim();

    // Если описание пустое — берём предыдущую строку (название часто выше суммы)
    let mainLineIndex = i;
    if (!description || description.length < 2) {
      if (i - 1 >= 0) {
        const prev = lines[i - 1];
        const prevText = (prev.text || '').trim();
        if (prevText && !isDayHeader(prevText) && !isServiceLine(prevText) && !/\d{2}[.,]\d{2}/.test(prevText)) {
          description = prevText;
          mainLineIndex = i - 1;
        }
      }
    }

    // Чистим описание
    description = description.replace(/[|•·\-\+−]/g, '').trim();
    if (!description) description = 'Операция';

    // Категория: смотрим описание + следующую строку
    const nextText = (lines[i + 1]?.text || '').trim();
    const category = extractCategory(description + ' ' + nextText);

    // bbox: объединяем строку суммы и строку описания, если они разные
    let opBbox = line.bbox;
    if (mainLineIndex !== i && lines[mainLineIndex]?.bbox && line.bbox) {
      const l1 = lines[mainLineIndex].bbox;
      const l2 = line.bbox;
      opBbox = {
        x0: Math.min(l1.x0, l2.x0),
        y0: Math.min(l1.y0, l2.y0),
        x1: Math.max(l1.x1, l2.x1),
        y1: Math.max(l1.y1, l2.y1),
      };
    }

    parsedItems.push({
      type: 'op',
      y,
      opData: {
        name: description.slice(0, 80),
        amount,
        type,
        category,
        bbox: opBbox,
        date: currentDate.toISOString(),
      },
    });
  }

  return parsedItems;
}

// ============================================================
// ПАРСЕР ДЛЯ СБЕРА
// ============================================================
function parseSber(lines) {
  const parsedItems = [];
  const now = new Date();
  let defaultYear = now.getFullYear();
  let currentDate = new Date();
  currentDate.setHours(12, 0, 0, 0);

  // Находим первую дату — до неё идёт шапка
  let listStartY = 0;
  for (const line of lines) {
    const text = (line.text || '').trim();
    if (isDayHeader(text) || parseDateFromLine(text)) {
      listStartY = line.bbox ? line.bbox.y0 : 0;
      break;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = (line.text || '').trim();
    if (!text) continue;
    const y = line.bbox ? line.bbox.y0 : 0;

    if (y < listStartY - 10) continue;

    // ✅ Заголовок дня
    if (isDayHeader(text)) {
      const d = parseDateFromLine(text);
      if (d) currentDate = d;
      continue;
    }

    // 🚫 Служебные строки
    if (isServiceLine(text)) continue;

    // ✅ Сумма
    const amt = extractAmount(text);
    if (!amt) continue;

    const amount = Math.round(amt.amount);
    if (amount <= 0) continue;

    const type = amt.sign === '+' ? 'income' : 'expense';

    let description = text
      .replace(/([+\-−])\s*(\d[\d\s]*(?:[.,]\d{1,2})?)\s*[₽pPрР]?\s*$/, '')
      .replace(/(\d[\d\s]*(?:[.,]\d{1,2})?)\s*[₽pPрР]\s*$/, '')
      .trim();

    description = description.replace(/[|•·\-\+−]/g, '').trim();

    if (!description || description.length < 2 || /^\d+$/.test(description)) {
      if (i - 1 >= 0) {
        const prev = (lines[i - 1].text || '').trim();
        if (prev && !isDayHeader(prev) && !isServiceLine(prev) && !/\d{2}[.,]\d{2}/.test(prev)) {
          description = prev;
        }
      }
    }

    if (!description) description = 'Операция';

    const nextText = (lines[i + 1]?.text || '').trim();
    const category = extractCategory(description + ' ' + nextText);

    parsedItems.push({
      type: 'op',
      y,
      opData: {
        name: description.slice(0, 80),
        amount,
        type,
        category,
        bbox: line.bbox,
        date: currentDate.toISOString(),
      },
    });
  }

  return parsedItems;
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================
export function parseBankScreenshot(textLines, currentBankType = 'tbank') {
  if (!textLines || !textLines.length) return { operations: [], suggestedBank: null };

  const detectedBank = detectBankType(textLines);
  const suggestedBank = (detectedBank && detectedBank !== currentBankType) ? detectedBank : null;

  if (!isValidBankScreenshot(textLines)) {
    throw new Error('Этот скриншот не похож на выписку из банка. Попробуйте загрузить скриншот операций.');
  }

  const lines = [...textLines].sort((a, b) => {
    if (!a.bbox || !b.bbox) return 0;
    return a.bbox.y0 - b.bbox.y0;
  });

  let parsedItems = [];
  if (currentBankType === 'sber') {
    parsedItems = parseSber(lines);
  } else {
    parsedItems = parseTbank(lines);
  }

  if (parsedItems.length === 0 && suggestedBank) {
    return { operations: [], suggestedBank };
  }

  if (parsedItems.length === 0) {
    throw new Error('Не удалось распознать операции. Убедитесь, что на скриншоте есть список операций с суммами.');
  }

  // Из parsedItems у нас уже есть date для каждой операции — просто собираем
  const operations = parsedItems.map(item => ({
    ...item.opData,
    dateUncertain: false,
  }));

  // Валидация — оставляем, но она уже не так важна, т.к. мы отсекли мусор на входе
  const validatedOperations = operations
    .map((op) => {
      let isSuspicious = false;
      let suspicionReason = '';

      if (op.name.length < 3 || /^[^а-яА-ЯёЁa-zA-Z]+$/.test(op.name)) {
        isSuspicious = true;
        suspicionReason = 'Непонятное название';
      }

      const lowerName = op.name.toLowerCase();
      if (
        lowerName.includes('аналитика') ||
        lowerName.includes('траты') ||
        lowerName.includes('доходы') ||
        lowerName.includes('обновляем')
      ) {
        return null; // полностью выкидываем
      }

      return { ...op, isSuspicious, suspicionReason };
    })
    .filter(Boolean);

  // Дедупликация
  const seen = new Set();
  const finalOps = validatedOperations.filter(op => {
    const key = `${op.name}|${op.amount}|${op.date.slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { operations: finalOps, suggestedBank };
}