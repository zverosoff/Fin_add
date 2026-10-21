// frontend/src/composables/useReceiptOCR.js

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

      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 4);
      const isDarkTheme = avgBrightness < 128;

      for (let i = 0; i < data.length; i += 4) {
        let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (isDarkTheme) gray = 255 - gray; 
        
        const v = gray > 180 ? 0 : 255; 
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
  if (!window.Tesseract) throw new Error('Tesseract.js не загрузился');

  const worker = await Tesseract.createWorker('rus+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round((m.progress || 0) * 100);
        onProgress?.(pct);
      }
    },
  });

  await worker.setParameters({
    tessedit_pageseg_mode: '6',
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
  const low = text.toLowerCase();
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
// ПАРСЕР ДЛЯ Т-БАНКА
// ============================================================
function parseTbank(lines) {
  const parsedItems = [];
  const now = new Date();
  let defaultYear = now.getFullYear();

  const DATE_WORD_RE = /(Сегодня|Вчера|Позавчера)/i;
  const DATE_NUM_RE = /(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:[,\s]+([а-я]{2}))?/i;
  // ✅ Сделали регулярку более лояльной (теперь понимает и без минуса, как в Сбере)
  const AMOUNT_RE = /([+\-−]?)\s*([\d\s]+(?:[.,]\d{2})?)\s*[₽pPрР]?/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = (line.text || '').trim();
    if (!text) continue;
    const y = line.bbox ? line.bbox.y0 : 0;

    let foundDate = null;
    if (DATE_WORD_RE.test(text)) {
      const word = text.match(DATE_WORD_RE)[0].toLowerCase();
      foundDate = new Date();
      if (word === 'вчера') foundDate.setDate(foundDate.getDate() - 1);
      else if (word === 'позавчера') foundDate.setDate(foundDate.getDate() - 2);
    } else {
      const dateMatch = text.match(DATE_NUM_RE);
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const month = MONTHS[dateMatch[2].toLowerCase()];
        let year = defaultYear;
        if (month > now.getMonth()) year -= 1;
        foundDate = new Date(year, month, day, 12, 0, 0);
      }
    }

    if (foundDate) {
      foundDate.setHours(12, 0, 0, 0);
      parsedItems.push({ type: 'date', y, date: foundDate });
      continue;
    }

    const amountMatch = text.match(AMOUNT_RE);
    if (!amountMatch) continue;

    const sign = amountMatch[1];
    const rawAmount = amountMatch[2].replace(/\s+/g, '').replace(',', '.');
    let amount = parseFloat(rawAmount);
    if (isNaN(amount) || amount <= 0) continue;

    // Если это Т-Банк и там нет знака, значит скорее всего это не Т-Банк, но мы все равно попробуем
    if (amount < 1 && !text.includes('₽')) continue;

    amount = Math.round(amount);
    // В Т-Банке обычно есть минус, если его нет - ставим расход
    const type = sign === '+' ? 'income' : 'expense';

    let description = text.replace(amountMatch[0], '').trim();
    if (description.toLowerCase().includes('black') || description.toLowerCase().includes('+')) continue;

    let mainLineIndex = i;
    if (!description || description.length < 2) {
      if (i - 1 >= 0) { description = lines[i-1].text; mainLineIndex = i - 1; }
      else if (i + 1 < lines.length) description = lines[i+1].text;
    }

    description = description.replace(/[|•·\-\+−]/g, '').trim();
    if (!description) description = 'Операция';
    const category = extractCategory(description + ' ' + (lines[i+1]?.text || ''));

    let opBbox = line.bbox;
    if (lines[mainLineIndex] && lines[mainLineIndex].bbox && line.bbox) {
       const l1 = lines[mainLineIndex].bbox;
       const l2 = line.bbox;
       opBbox = { x0: Math.min(l1.x0, l2.x0), y0: Math.min(l1.y0, l2.y0), x1: Math.max(l1.x1, l2.x1), y1: Math.max(l1.y1, l2.y1) };
    }

    parsedItems.push({ type: 'op', y, opData: { name: description.slice(0, 80), amount, type, category, bbox: opBbox } });
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

  const DATE_WORD_RE = /(Сегодня|Вчера|Позавчера)/i;
  const DATE_NUM_RE = /(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:[,\s]+([а-я]{2}))?/i;
  const SBER_AMOUNT_RE = /([+\-−]?)\s*(\d[\d\s]*(?:[.,]\d{2})?)\s*[₽pPрР]?\s*$/;

  let listStartY = 0;
  for (const line of lines) {
    const text = (line.text || '').trim();
    if (DATE_WORD_RE.test(text) || DATE_NUM_RE.test(text)) {
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

    let foundDate = null;
    if (DATE_WORD_RE.test(text)) {
      const word = text.match(DATE_WORD_RE)[0].toLowerCase();
      foundDate = new Date();
      if (word === 'вчера') foundDate.setDate(foundDate.getDate() - 1);
      else if (word === 'позавчера') foundDate.setDate(foundDate.getDate() - 2);
    } else {
      const dateMatch = text.match(DATE_NUM_RE);
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const month = MONTHS[dateMatch[2].toLowerCase()];
        let year = defaultYear;
        if (month > now.getMonth()) year -= 1;
        foundDate = new Date(year, month, day, 12, 0, 0);
      }
    }

    if (foundDate) {
      foundDate.setHours(12, 0, 0, 0);
      parsedItems.push({ type: 'date', y, date: foundDate });
      continue;
    }

    const amountMatch = text.match(SBER_AMOUNT_RE);
    if (!amountMatch) continue;

    const sign = amountMatch[1];
    const rawAmount = amountMatch[2].replace(/\s+/g, '').replace(',', '.');
    let amount = parseFloat(rawAmount);
    if (isNaN(amount) || amount <= 0) continue;

    if (amount < 1 && !text.includes('₽')) continue;

    const type = sign === '+' ? 'income' : 'expense';
    amount = Math.round(amount);

    let description = text.replace(amountMatch[0], '').trim();
    description = description.replace(/[|•·\-\+−]/g, '').trim();

    if (!description || description.length < 2 || /^\d+$/.test(description)) {
       if (i - 1 >= 0 && !DATE_WORD_RE.test(lines[i-1].text) && !DATE_NUM_RE.test(lines[i-1].text)) {
           description = lines[i-1].text;
       }
    }

    if (description.length > 80 && description.includes('.')) continue;
    if (!description) description = 'Операция';

    let category = 'Прочее';
    const nextLine = lines[i+1]?.text || '';
    
    if (nextLine.includes('Оплата') || nextLine.includes('товаров') || nextLine.includes('услуг')) {
       category = extractCategory(nextLine);
    } else {
       category = extractCategory(description + ' ' + nextLine);
    }

    parsedItems.push({
      type: 'op',
      y,
      opData: { name: description.slice(0, 80), amount, type, category, bbox: line.bbox }
    });
  }
  return parsedItems;
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================
export function parseBankScreenshot(textLines, currentBankType = 'tbank') {
  if (!textLines || !textLines.length) return { operations: [], suggestedBank: null };

  // ✅ Сначала определяем банк по маркерам
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
  // Парсим тем банком, который выбран пользователем
  if (currentBankType === 'sber') {
    parsedItems = parseSber(lines);
  } else {
    parsedItems = parseTbank(lines);
  }

  // ✅ Если мы не нашли операции, но подозреваем, что это другой банк — предлагаем переключиться
  if (parsedItems.length === 0 && suggestedBank) {
    return { operations: [], suggestedBank };
  }

  if (parsedItems.length === 0) {
    throw new Error('Не удалось распознать операции. Убедитесь, что на скриншоте есть список операций с суммами.');
  }

  const operations = [];
  let currentDate = new Date();
  currentDate.setHours(12, 0, 0, 0);
  let currentOpsGroup = [];
  let isUncertainGroup = false; 

  for (let i = parsedItems.length - 1; i >= 0; i--) {
    const item = parsedItems[i];
    if (item.type === 'op') {
      currentOpsGroup.push(item);
    } else if (item.type === 'date') {
      currentDate = item.date;
      for (const op of currentOpsGroup) {
        operations.push({ ...op.opData, date: currentDate.toISOString(), dateUncertain: isUncertainGroup });
      }
      currentOpsGroup = []; 
      isUncertainGroup = false; 
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  for (const op of currentOpsGroup) {
    operations.push({ ...op.opData, date: currentDate.toISOString(), dateUncertain: true });
  }

  operations.reverse();

  const validatedOperations = operations.map((op) => {
    let isSuspicious = false;
    let suspicionReason = '';

    if (op.name.length < 3 || /^[^а-яА-ЯёЁa-zA-Z]+$/.test(op.name)) {
      isSuspicious = true;
      suspicionReason = 'Непонятное название';
    }

    if (op.amount > 10000 && op.amount % 1000 === 0) {
       isSuspicious = true;
       suspicionReason = 'Похоже на аналитику';
    }

    const lowerName = op.name.toLowerCase();
    if (lowerName.includes('расходы') || lowerName.includes('зачислен') || lowerName.includes('переводы людям') || lowerName.includes('аналитика')) {
      isSuspicious = true;
      suspicionReason = 'Похоже на общую информацию';
    }

    return { ...op, isSuspicious, suspicionReason };
  });

  const seen = new Set();
  const finalOps = validatedOperations.filter(op => {
    const key = `${op.name}|${op.amount}|${op.date.slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { operations: finalOps, suggestedBank };
}