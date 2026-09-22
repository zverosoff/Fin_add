/**
 * OCR-обработка чеков через Tesseract.js
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

/**
 * Разбить «склеенные» строки на отдельные.
 */
function splitLines(lines) {
  const result = [];
  const DATE_START_RE = /(\d{1,2}\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-яё]*)/gi;
  const AMOUNT_START_RE = /([+\-−]\s*\d[\d\s]*(?:[.,]\d{1,2})?\s*(?:₽|p|руб\.?))/gi;

  for (const rawLine of lines) {
    let line = String(rawLine).trim();
    if (!line) continue;

    let parts = line
      .split(/\s*[·•]\s*/g)
      .flatMap(p => p.split(/\s*\|\s*/g))
      .map(p => p.trim())
      .filter(Boolean);

    const expanded = [];
    for (const part of parts) {
      let fragments = [part];

      fragments = fragments.flatMap(frag => {
        const matches = [...frag.matchAll(DATE_START_RE)];
        if (matches.length <= 1) return [frag];
        const cuts = matches.map(m => m.index).filter(idx => idx > 0);
        if (!cuts.length) return [frag];
        const pieces = [];
        let last = 0;
        for (const cut of cuts) {
          pieces.push(frag.slice(last, cut).trim());
          last = cut;
        }
        pieces.push(frag.slice(last).trim());
        return pieces.filter(Boolean);
      });

      fragments = fragments.flatMap(frag => {
        const matches = [...frag.matchAll(AMOUNT_START_RE)];
        if (matches.length <= 1) return [frag];
        const cuts = matches
          .map(m => m.index)
          .filter(idx => idx > 0 && idx < frag.length - 15);
        if (!cuts.length) return [frag];
        const pieces = [];
        let last = 0;
        for (const cut of cuts) {
          pieces.push(frag.slice(last, cut).trim());
          last = cut;
        }
        pieces.push(frag.slice(last).trim());
        return pieces.filter(Boolean);
      });

      expanded.push(...fragments);
    }

    result.push(...expanded.filter(p => p && p.length > 1));
  }

  return result;
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

  const rawLines = (data.text || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const lines = splitLines(rawLines);

  console.log('[scan] после splitLines:', lines);

  return lines;
}

export function parseReceipt(lines) {
  const items = [];

  const AMOUNT_RE = /([+\-]?\s*\d[\d\s]*(?:[.,]\d{1,2})?)\s*(?:[₽pPрРгГ]|руб\.?)?[\s\\|*`~^\[\]{}]*$/;
  const DATE_RU_RE = /(\d{1,2})\s*(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-яё]*\s*(\d{4})?/i;
  const DATE_NUM_RE = /(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?/;

  let currentDate = new Date();
  currentDate.setHours(12, 0, 0, 0);

  const MONTH_INDEX = {
    'январ': 0, 'феврал': 1, 'март': 2, 'апрел': 3,
    'май': 4, 'мая': 4, 'июн': 5, 'июл': 6,
    'август': 7, 'сентябр': 8, 'октябр': 9, 'ноябр': 10, 'декабр': 11,
  };

  // ============================================================
  // Строки, которые пропускаем
  // ============================================================
  const SKIP_RE = /^(итого|итог|баланс|всего|сумма|выписка|операции|операция|чек|касса|касс|смена|фн|фд|фп|инн|кассир|№|n\s|ккт|дата|время|адрес|телефон|сайт|www|http|карта|карты|счета|счёт|счета\s+и\s+карты|без\s+перевод|месяц|за\s+период|с\s+|по\s+|итоговая|детализация|состояние|остаток|доступно|лимит|пополнени|списани|входящие|исходящие|категории|аналитика|кредиты|настройки|профиль|кэшбэк|переводы|одежда\s+и\s+обувь|заправки|дебетовая|кредитная|black)/i;

  const FILTER_RE = /^(все|доходы|расходы|счета|карты|без\s+переводов|переводы|траты|пополнения|покупки|перевести|платежи|кэшбэк\s+и\s+бонусы|аналитика|кредиты|настройки|профиль)$/i;

  const SUMMARY_RE = /^\s*\d[\d\s]*(?:[.,]\d{1,2})?\s*(?:₽|p|руб\.?)?\s*(траты|доходы|расходы|пополнения|итого|баланс|переводы|покупки)\s*$/i;

  const TIME_RE = /^\d{1,2}:\d{2}\s/;
  const GARBAGE_RE = /^\d{1,2}:\d{2}\s+\d+\s*%/;
  const ONLY_AMOUNT_RE = /^[+\-]?\s*\d[\d\s]*(?:[.,]\d{1,2})?\s*(?:₽|p|руб\.?)?$/i;

  // ============================================================
  // НОВЫЕ фильтры (добавлены после отладки)
  // ============================================================

  // «75 281 ₽ - 79 838 ₽ - Операции» — несколько сумм подряд = сводка
  const MULTI_AMOUNT_RE = /^[\s\-−+]*\d[\d\s]*[.,]?\d*\s*₽[\s\-−+]*\d[\d\s]*[.,]?\d*\s*₽/;

  // Категории, названия карт — это метаданные, не операции
  const META_RE = /^(переводы|перевод|одежда\s+и\s+обувь|заправки|продукты|кафе|рестораны|такси|бензин|аптеки|здоровье|красота|развлечения|подписки|покупки|техника|аренда|ипотека|жкх|коммунал|интернет|связь|мобильная|спорт|образование|путешествия|кредиты|страхование|налоги|ремонт|автомобиль|гараж|сад|подарки|благотворительность|дебетовая\s+карта|кредитная\s+карта|black|premium|виртуальная\s+карта|зарплатная\s+карта|детская\s+карта)$/i;

  // «+8», «+51» — бонусы кэшбэка
  const BONUS_RE = /^\+\d{1,3}\s/;

  function extractDate(line) {
    const mRu = line.match(DATE_RU_RE);
    if (mRu) {
      const day = parseInt(mRu[1], 10);
      const monthKey = Object.keys(MONTH_INDEX).find(k => mRu[2].toLowerCase().startsWith(k.slice(0, 4)));
      const month = monthKey !== undefined ? MONTH_INDEX[monthKey] : null;
      let year = mRu[3] ? parseInt(mRu[3], 10) : new Date().getFullYear();
      if (month !== null && day >= 1 && day <= 31) {
        return new Date(year, month, day, 12, 0, 0);
      }
    }

    const mNum = line.match(DATE_NUM_RE);
    if (mNum) {
      const day = parseInt(mNum[1], 10);
      const month = parseInt(mNum[2], 10) - 1;
      let year = mNum[3] ? parseInt(mNum[3], 10) : new Date().getFullYear();
      if (year < 100) year += 2000;
      if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
        return new Date(year, month, day, 12, 0, 0);
      }
    }
    return null;
  }

  function extractAmount(line) {
    const m = line.match(AMOUNT_RE);
    if (!m) return null;

    const raw = m[1];
    const clean = raw.replace(/\s+/g, '').replace(',', '.').replace(/[+\-]/g, '');
    const amount = parseFloat(clean);

    if (!isFinite(amount) || amount <= 0 || amount > 10_000_000) return null;

    const sign = raw.trim().startsWith('+') ? '+'
               : raw.trim().startsWith('-') ? '-'
               : null;
    const rest = line.slice(0, line.lastIndexOf(raw)).trim();
    return { amount, sign, rest };
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line || line.length < 2) continue;

    // Убираем хвосты шапки
    line = line
      .replace(/\s*[-·|]\s*(Операции|Q|S|X|w\/)\s*[\s\/]*$/i, '')
      .replace(/\s+Операции\s+Q\s*\/?\s*$/i, '')
      .trim();

    if (line.length < 2) continue;

    // Отсекаем мусор
    if (SKIP_RE.test(line)) continue;
    if (FILTER_RE.test(line)) continue;
    if (SUMMARY_RE.test(line)) continue;
    if (TIME_RE.test(line)) continue;
    if (GARBAGE_RE.test(line)) continue;
    if (MULTI_AMOUNT_RE.test(line)) continue;   // ← новое
    if (META_RE.test(line)) continue;           // ← новое
    if (BONUS_RE.test(line)) continue;          // ← новое

    // Дата?
    const d = extractDate(line);
    if (d && line.length < 30) {
      currentDate = d;
      continue;
    }

    // Сумма?
    const amt = extractAmount(line);
    if (!amt) continue;

    let title = amt.rest;

    if (!title || ONLY_AMOUNT_RE.test(line)) {
      const prev = i > 0 ? lines[i - 1] : '';
      const next = i + 1 < lines.length ? lines[i + 1] : '';

      const hasPrevDesc = prev
        && !SKIP_RE.test(prev)
        && !FILTER_RE.test(prev)
        && !SUMMARY_RE.test(prev)
        && !TIME_RE.test(prev)
        && !ONLY_AMOUNT_RE.test(prev)
        && !MULTI_AMOUNT_RE.test(prev)
        && !META_RE.test(prev)
        && !BONUS_RE.test(prev)
        && prev.length > 2
        && prev.length < 60
        && !extractAmount(prev);

      const hasNextDesc = next
        && !SKIP_RE.test(next)
        && !FILTER_RE.test(next)
        && !SUMMARY_RE.test(next)
        && !TIME_RE.test(next)
        && !ONLY_AMOUNT_RE.test(next)
        && !MULTI_AMOUNT_RE.test(next)
        && !META_RE.test(next)
        && !BONUS_RE.test(next)
        && next.length > 2
        && next.length < 60
        && !extractAmount(next);

      if (!hasPrevDesc && !hasNextDesc) continue;

      if (hasPrevDesc) title = prev;
      else if (hasNextDesc) title = next;
    }

    if (!title || title.length < 2) title = 'Операция';

    title = title
      .replace(/[\-\+\—–_\\|*`~^\[\]{}]+\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

    if (TIME_RE.test(title) || /^\d+\s*%/.test(title)) continue;

    // Финальная проверка: не мета ли это
    if (META_RE.test(title)) continue;

    const type = amt.sign === '+' ? 'income' : 'expense';

    items.push({
      date: currentDate.toISOString(),
      description: title,
      amount: amt.amount,
      type,
      category: 'Прочее',
    });
  }

  return items;
}