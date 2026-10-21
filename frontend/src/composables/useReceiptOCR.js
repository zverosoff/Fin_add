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

  return { lines: textLines };
}

// ============================================================
// ✅ Умный парсер для банковских скриншотов (Т-Банк, Сбер)
// ============================================================
export function parseBankScreenshot(textLines) {
  if (!textLines || !textLines.length) return [];

  const lines = [...textLines].sort((a, b) => {
    if (!a.bbox || !b.bbox) return 0;
    return a.bbox.y0 - b.bbox.y0;
  });

  const operations = [];
  let currentDate = new Date();
  currentDate.setHours(12, 0, 0, 0);

  const MONTHS = {
    'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
    'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
  };

  const AMOUNT_RE = /([+\-−])\s*([\d\s]+(?:[.,]\d{2})?)\s*[₽pPрР]?/;
  const DATE_WORD_RE = /(Сегодня|Вчера|Позавчера)/i;
  const DATE_NUM_RE = /(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:[,\s]+([а-я]{2}))?/i;

  const CATEGORY_WORDS = [
    'Супермаркеты', 'Фастфуд', 'Переводы', 'Заправки', 'Сервис', 
    'Кафе и рестораны', 'Транспорт', 'Развлечения', 'Здоровье', 
    'Аптеки', 'Одежда и обувь', 'Разное', 'Коммунальные', 
    'Связь', 'Подписки', 'Выдача наличных', 'Пополнение'
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = (line.text || '').trim();
    if (!text) continue;

    // 1. Проверяем заголовки дат
    if (DATE_WORD_RE.test(text)) {
      const word = text.match(DATE_WORD_RE)[0].toLowerCase();
      if (word === 'сегодня') currentDate = new Date();
      else if (word === 'вчера') { currentDate = new Date(); currentDate.setDate(currentDate.getDate() - 1); }
      else if (word === 'позавчера') { currentDate = new Date(); currentDate.setDate(currentDate.getDate() - 2); }
      currentDate.setHours(12, 0, 0, 0);
      continue;
    }

    const dateMatch = text.match(DATE_NUM_RE);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = MONTHS[dateMatch[2].toLowerCase()];
      const now = new Date();
      let year = now.getFullYear();
      if (month > now.getMonth()) year -= 1;
      currentDate = new Date(year, month, day, 12, 0, 0);
      continue;
    }

    // 2. Ищем сумму
    const amountMatch = text.match(AMOUNT_RE);
    if (!amountMatch) continue;

    const sign = amountMatch[1];
    const rawAmount = amountMatch[2].replace(/\s+/g, '').replace(',', '.');
    let amount = parseFloat(rawAmount);
    if (isNaN(amount) || amount <= 0) continue;

    amount = Math.round(amount); // Округление до целого
    const type = sign === '+' ? 'income' : 'expense';

    // 3. Парсим название и категорию
    let description = text.replace(amountMatch[0], '').trim();
    let category = 'Прочее';

    // Если описание короткое, берем следующую строку
    if (!description || description.length < 2) {
      if (i + 1 < lines.length) {
        const nextText = (lines[i + 1].text || '').trim();
        if (!/\d/.test(nextText)) description = nextText;
      }
    }

    description = description.replace(/[|•·\-\+−]/g, '').trim();

    // Вытаскиваем категорию
    for (const cat of CATEGORY_WORDS) {
      if (description.toLowerCase().includes(cat.toLowerCase())) {
        category = cat;
        description = description.replace(new RegExp(cat, 'ig'), '').trim();
        break;
      }
    }

    if (!description || description.length < 2) description = 'Операция';
    description = description.replace(/\s+/g, ' ').slice(0, 80);

    operations.push({
      date: currentDate.toISOString(),
      name: description,
      amount,
      type,
      category,
    });
  }

  // Убираем дубликаты
  const seen = new Set();
  return operations.filter(op => {
    const key = `${op.name}|${op.amount}|${op.date.slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}