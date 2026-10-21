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

      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const v = gray < 150 ? 255 : 0; 
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

export function parseBankScreenshot(textLines) {
  if (!textLines || !textLines.length) return [];

  const lines = [...textLines].sort((a, b) => {
    if (!a.bbox || !b.bbox) return 0;
    return a.bbox.y0 - b.bbox.y0;
  });

  const operations = [];
  
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

  const parsedItems = []; 

  const now = new Date();
  let defaultYear = now.getFullYear();

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

    amount = Math.round(amount);
    const type = sign === '+' ? 'income' : 'expense';

    let description = text.replace(amountMatch[0], '').trim();
    
    if (description.toLowerCase().includes('black') || description.toLowerCase().includes('+')) {
        continue;
    }

    let mainLineIndex = i;
    if (!description || description.length < 2) {
      if (i - 1 >= 0 && !DATE_WORD_RE.test(lines[i-1].text) && !DATE_NUM_RE.test(lines[i-1].text)) {
        description = lines[i-1].text;
        mainLineIndex = i - 1;
      } else if (i + 1 < lines.length) {
        description = lines[i+1].text;
      }
    }

    description = description.replace(/[|•·\-\+−]/g, '').trim();
    if (!description) description = 'Операция';

    let category = 'Прочее';
    const linesToCheck = [description, lines[i+1]?.text || '', lines[i-1]?.text || ''];
    for (const checkText of linesToCheck) {
        const low = checkText.toLowerCase();
        for (const cat of CATEGORY_WORDS) {
            if (low.includes(cat.toLowerCase())) {
                category = cat;
                description = description.replace(new RegExp(cat, 'ig'), '').trim();
                break;
            }
        }
        if (category !== 'Прочее') break;
    }

    let opBbox = line.bbox;
    if (lines[mainLineIndex] && lines[mainLineIndex].bbox && line.bbox) {
       const l1 = lines[mainLineIndex].bbox;
       const l2 = line.bbox;
       opBbox = {
           x0: Math.min(l1.x0, l2.x0),
           y0: Math.min(l1.y0, l2.y0),
           x1: Math.max(l1.x1, l2.x1),
           y1: Math.max(l1.y1, l2.y1)
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
      }
    });
  }

  // ============================================================
  // Логика распределения дат (СНИЗУ ВВЕРХ)
  // ============================================================
  let currentDate = new Date();
  currentDate.setHours(12, 0, 0, 0);
  
  let currentOpsGroup = [];
  let isUncertainGroup = false; // Флаг для верхней группы

  for (let i = parsedItems.length - 1; i >= 0; i--) {
    const item = parsedItems[i];

    if (item.type === 'op') {
      currentOpsGroup.push(item);
    } else if (item.type === 'date') {
      currentDate = item.date;
      
      // Присваиваем группе найденную дату
      for (const op of currentOpsGroup) {
        operations.push({
          ...op.opData,
          date: currentDate.toISOString(),
          dateUncertain: isUncertainGroup, // Передаем флаг
        });
      }
      
      currentOpsGroup = []; 
      isUncertainGroup = false; // Следующая группа (выше) будет неопределенной
      
      // Готовим дату для группы выше
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // Самые верхние операции (у которых не было даты сверху)
  for (const op of currentOpsGroup) {
    operations.push({
      ...op.opData,
      date: currentDate.toISOString(),
      dateUncertain: true, // Помечаем как неопределенные
    });
  }

  operations.reverse();

  const seen = new Set();
  return operations.filter(op => {
    const key = `${op.name}|${op.amount}|${op.date.slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}