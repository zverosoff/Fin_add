/**
 * OCR-обработка чеков и скриншотов банковских приложений через Tesseract.js
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
  const AMOUNT_START_RE = /([+\-−]\s*\d[\d\s]*(?:[.,]\d{1,2})?\s*(?:[₽рРPp]|руб\.?))/gi;

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

/**
 * Словарь категорий Т-Банка (или Сбера) → наши категории
 */
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

function detectCategoryFromLine(line) {
  if (!line) return 'Прочее';
  const low = line.toLowerCase().trim();

  // Полное совпадение
  if (CATEGORY_MAP[low]) return CATEGORY_MAP[low];

  // Начинается с категории
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

/**
 * Проверка: строка похожа на метаданные (категория / карта), а не на название операции.
 */
function isMetadataLine(line) {
  if (!line) return false;
  const low = line.toLowerCase().trim();

  // Просто «Дебетовая карта», «Кредитная карта»
  if (/^(дебетовая|кредитная|виртуальная|зарплатная|детская)\s+карта$/i.test(low)) return true;

  // Строка начинается с известной категории + «карта»/«счёт»
  const words = low.split(/\s+/);
  if (words.length >= 2 && words.length <= 4) {
    const first = words[0];
    if (CATEGORY_MAP[first]) {
      // «Супермаркеты Дебетовая карта», «Медицина Дебетовая карта» и т.п.
      const rest = words.slice(1).join(' ');
      if (/карта|счёт|счет/i.test(rest)) return true;
    }
  }

  return false;
}

/**
 * Парсер распознанных строк.
 */
export function parseReceipt(lines) {
  const items = [];

  // ✅ Символ рубля может быть: ₽, Р (русская), P (латинская), р (русская маленькая), p (латинская маленькая), L (ошибка OCR)
  const ROUBLE_CLASS = '[₽рРPpL]';

  // ✅ Сумма: число в конце строки, валюта — опционально (может быть L, ©, ‘ и т.п.)
  const AMOUNT_RE = new RegExp(
    `([+\\-−]?\\s*\\d[\\d\\s]*(?:[.,]\\d{1,2})?)\\s*(?:${ROUBLE_CLASS}|руб\\.?|©|‘|’|')?[\\s\\\\|*\`~^\\[\\]{}.,;:!?]*$`
  );
  const DATE_RU_RE = /(\d{1,2})\s*(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-яё]*\s*(\d{4})?/i;
  const DATE_NUM_RE = /(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?/;

  let currentDate = new Date();
  currentDate.setHours(12, 0, 0, 0);

  const MONTH_INDEX = {
    'январ': 0, 'феврал': 1, 'март': 2, 'апрел': 3,
    'май': 4, 'мая': 4, 'июн': 5, 'июл': 6,
    'август': 7, 'сентябр': 8, 'октябр': 9, 'ноябр': 10, 'декабр': 11,
  };

  const FILTER_RE = /^(все|доходы|расходы|счета|карты|без\s+переводов|переводы|траты|пополнения|покупки|перевести|платежи|кэшбэк\s+и\s+бонусы|аналитика|кредиты|настройки|профиль|операции|операция|сентябрь|октябрь|ноябрь|декабрь|январь|февраль|март|апрель|май|июнь|июль|август)$/i;

  // Сводка с «₽» или «Р»: «117 085 ₽», «-3 104 ₽», «117 085 ₽ 106 515 ₽»
  const SUMMARY_RE = new RegExp(
    `^\\s*[+\\-−]?\\s*\\d[\\d\\s]*[.,]?\\d*\\s*${ROUBLE_CLASS}(\\s+[+\\-−]?\\s*\\d[\\d\\s]*[.,]?\\d*\\s*${ROUBLE_CLASS})?\\s*(траты|доходы|расходы|пополнения|итого|баланс|переводы|покупки)?\\s*$`,
    'i'
  );

  const ONLY_AMOUNT_RE = new RegExp(`^[+\\-−]?\\s*\\d[\\d\\s]*(?:[.,]\\d{1,2})?\\s*(?:${ROUBLE_CLASS}|руб\\.?)?$`, 'i');

  // ✅ Две «валюты» в строке — сводка (учитываем и Р, и ₽)
  const MULTI_AMOUNT_RE = new RegExp(
    `^[\\s\\-−+]*\\d[\\d\\s]*[.,]?\\d*\\s*${ROUBLE_CLASS}[\\s\\-−+]*\\d[\\d\\s]*[.,]?\\d*\\s*${ROUBLE_CLASS}`
  );

  const TIME_RE = /^\d{1,2}:\d{2}\s/;
  const GARBAGE_RE = /^\d{1,2}:\d{2}\s+\d+\s*%/;
  const CARD_TYPE_RE = /^(дебетовая|кредитная|виртуальная|зарплатная|детская)\s+карта$/i;
  const RASROCHKA_RE = /^(рассрочки|рассрочка|общий\s+платёж|общий\s+платеж|к\s+оплате)/i;
  const BONUS_RE = /^\+\d{1,3}\s/;
  const JUNK_RE = /^[\d:]+\s*№?\s*\d*\s*[a-zA-Zа-яА-Я]?\s*[\/\\]?\s*\d*\s*\d*\s*\d*\s*\)?$/;

  // ✅ Относительная дата — без \b (он не работает на кириллице)
  function extractRelativeDate(line) {
    const t = line.trim().toLowerCase();
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    if (/^сегодня(\s|$)/.test(t)) return new Date(today);
    if (/^вчера(\s|$)/.test(t)) {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return d;
    }
    if (/^позавчера(\s|$)/.test(t)) {
      const d = new Date(today);
      d.setDate(d.getDate() - 2);
      return d;
    }
    return null;
  }

  function extractDate(line) {
    const rel = extractRelativeDate(line);
    if (rel) return rel;

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
    const clean = raw.replace(/\s+/g, '').replace(',', '.').replace(/[+\-−]/g, '');
    const amount = parseFloat(clean);

    if (!isFinite(amount) || amount <= 0 || amount > 10_000_000) return null;

    const sign = /^[+\-−]/.test(raw.trim()) ? raw.trim()[0] : null;
    const rest = line.slice(0, line.lastIndexOf(raw)).trim();
    return { amount, sign, rest };
  }

  // ============================================================
  // Основной проход
  // ============================================================
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line || line.length < 2) continue;

    // ✅ НОРМАЛИЗАЦИЯ
    line = line
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s*[-·|]\s*(Операции|Q|S|X|w\/)\s*[\s\/]*$/i, '')
      .replace(/\s+Операции\s+Q\s*\/?\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (line.length < 2) continue;

    // ─── Пропуски ───
    if (FILTER_RE.test(line)) continue;
    if (TIME_RE.test(line)) continue;
    if (GARBAGE_RE.test(line)) continue;
    if (JUNK_RE.test(line)) continue;
    if (CARD_TYPE_RE.test(line)) continue;
    if (BONUS_RE.test(line)) continue;
    if (RASROCHKA_RE.test(line)) continue;

    // ✅ Сводки (учитываем и ₽, и Р)
    const roubleMatches = line.match(new RegExp(ROUBLE_CLASS, 'g')) || [];
    const roubleCount = roubleMatches.length;

    if (MULTI_AMOUNT_RE.test(line)) continue;
    if (SUMMARY_RE.test(line)) continue;

    // Если в строке 2+ «валюты» — сводка, но только если там нет описания
    // (защита: «Перевод 100 ₽ → 200 ₽» — не бывает, но на всякий)
    if (roubleCount >= 2) continue;

    // ─── Относительная дата ───
    const rel = extractRelativeDate(line);
    if (rel && line.length < 30) {
      currentDate = rel;
      continue;
    }

    // ─── Дата ───
    const d = extractDate(line);
    if (d && line.length < 30) {
      currentDate = d;
      continue;
    }

    // ─── Сумма ───
    const amt = extractAmount(line);
    if (!amt) continue;
    if (ONLY_AMOUNT_RE.test(line)) continue;

    let title = amt.rest;

    // ✅ Если название пустое или это метаданные — берём предыдущую строку,
    // но НЕ метаданные и НЕ категорию
    const titleIsBad = !title || title.length < 2 || isMetadataLine(title);

    if (titleIsBad) {
      const prev = i > 0 ? lines[i - 1] : '';
      const prevIsGood = prev
        && !isMetadataLine(prev)
        && !FILTER_RE.test(prev)
        && !SUMMARY_RE.test(prev)
        && !TIME_RE.test(prev)
        && !ONLY_AMOUNT_RE.test(prev)
        && prev.length > 2
        && prev.length < 80
        && !extractAmount(prev);

      if (prevIsGood) {
        title = prev;
      }
    }

    // Если так и не нашли нормальный заголовок — пропускаем
    if (!title || title.length < 2 || isMetadataLine(title)) continue;

    title = title
      .replace(/[\-\+\—–_\\|*`~^\[\]{}]+\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

    if (TIME_RE.test(title) || /^\d+\s*%/.test(title)) continue;

    // ─── Категория ───
    let category = 'Прочее';
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

    if (nextLine) {
      const cleanedNext = nextLine
        .replace(/(дебетовая|кредитная|виртуальная|зарплатная|детская)\s+карта/gi, '')
        .trim();
      if (cleanedNext) {
        const cat = detectCategoryFromLine(cleanedNext);
        if (cat !== 'Прочее') category = cat;
      }
    }

    if (category === 'Прочее') {
      category = detectCategoryFromLine(title);
    }

    const type = amt.sign === '+' ? 'income' : 'expense';

    items.push({
      date: currentDate.toISOString(),
      description: title,
      amount: amt.amount,
      type,
      category,
    });
  }

  console.log('[scan] ИТОГО операций:', items.length);
  console.log('[scan] разобранные операции:', items);
  return items;
}