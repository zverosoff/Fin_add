/**
 * Парсинг PDF-выписок Т-Банка и Сбера через PDF.js
 */

/* ============================================================
   Извлечение текста из PDF
   ============================================================ */
export async function extractPdfText(file) {
  if (!window.pdfjsLib) throw new Error('PDF.js не загрузился');

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const linesMap = new Map();
    for (const item of content.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5] / 2) * 2;
      if (!linesMap.has(y)) linesMap.set(y, []);
      linesMap.get(y).push({ x: item.transform[4], text: item.str });
    }

    const sortedYs = Array.from(linesMap.keys()).sort((a, b) => b - a);

    for (const y of sortedYs) {
      const rowItems = linesMap.get(y).sort((a, b) => a.x - b.x);
      const line = rowItems
        .map(it => it.text.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (line) allLines.push(line);
    }
  }

  return {
    fullText: allLines.join(' '),
    pagesData: allLines,
    lines: allLines,
  };
}

/* ============================================================
   Определение банка
   ============================================================ */
export function detectBank(fullText) {
  const t = (fullText || '').toLowerCase();

  // Т-Банк — уникальные маркеры
  if (t.includes('т-банк') || t.includes('тбанк') || t.includes('tbank')) return 'tbank';
  if (t.includes('справка о движении средств')) return 'tbank';
  if (t.includes('универсальная лицензия банка россии № 2673')) return 'tbank';
  if (t.includes('бик 044525974')) return 'tbank';

  // Сбер — уникальные маркеры
  if (t.includes('индивидуальная выписка')) return 'sber';
  if (t.includes('выписка по счёту дебетовой карты')) return 'sber';
  if (t.includes('выписка по счету дебетовой карты')) return 'sber';
  if (t.includes('пао сбербанк')) return 'sber';
  if (/дата\s+операции\s*\(мск\)/i.test(fullText)) return 'sber';
  if (/расшифровка\s+операций/i.test(fullText)) return 'sber';

  return 'unknown';
}

/* ============================================================
   Парсер Т-Банка
   Склеиваем всё в один текст и ищем операции регуляркой
   ============================================================ */
export function parseTbankStatement(pagesData) {
  const operations = [];
  const pageText = pagesData.flat().join(' ').replace(/\s+/g, ' ').trim();

  console.log('[tbank-parser] длина текста:', pageText.length);

  const re = /(\d{2}\.\d{2}\.\d{4})\s+(\d{2}\.\d{2}\.\d{4})\s+([+\-]\s*\d[\d\s]*[.,]\d{2})\s*₽\s*([+\-]\s*\d[\d\s]*[.,]\d{2})\s*₽\s+(.+?)(?=\s+\d{2}\.\d{2}\.\d{4}\s+\d{2}\.\d{2}\.\d{4}|$)/g;

  let m;
  let count = 0;

  while ((m = re.exec(pageText)) !== null) {
    count++;
    const [, dOp, dSp, sum1Raw, sum2Raw, rawDesc] = m;

    const dd = parseInt(dOp.slice(0, 2), 10);
    const mm = parseInt(dOp.slice(3, 5), 10);
    const yy = parseInt(dOp.slice(6, 10), 10);
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12) continue;

    const sumClean = sum1Raw.replace(/\s+/g, '').replace(',', '.').replace(/[+\-]/g, '');
    const amount = parseFloat(sumClean);
    if (!isFinite(amount) || amount <= 0) continue;

    const isIncome = sum1Raw.trim().startsWith('+');

    let description = (rawDesc || '')
      .replace(/\s+\d{4}\s*$/, '')
      .replace(/\s+\d{2}:\d{2}\s+\d{2}:\d{2}\s+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (description.length < 2) description = 'Операция';

    const category = guessCategoryFromDescription(description);

    operations.push({
      date: new Date(yy, mm - 1, dd, 12, 0, 0).toISOString(),
      name: description.slice(0, 100),
      amount,
      type: isIncome ? 'income' : 'expense',
      category,
      source: 'tbank',
    });
  }

  console.log('[tbank-parser] совпадений:', count, ', операций:', operations.length);

  const seen = new Set();
  return operations.filter(op => {
    const key = `${op.name}|${op.amount}|${op.date.slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ============================================================
   Парсер Сбера
   Формат строки после склейки токенов:
   "20.09.2026 21:57 Супермаркеты 606,00 803,60 21.09.2026 266502 SAMOKAT... Операция по карте"
   
   Токены:
   [0] дата операции (dd.mm.yyyy)
   [1] время операции (hh:mm)
   [2] КАТЕГОРИЯ (2-4 слова)
   [3] СУММА ОПЕРАЦИИ (может быть +10 000,00 или 606,00)
   [4] ОСТАТОК СРЕДСТВ
   [5] дата обработки (dd.mm.yyyy)
   [6] код авторизации
   [7+] описание
   ============================================================ */
export function parseSberStatement(pagesData) {
  const operations = [];
  const allLines = pagesData.flat();

  // Категории Сбера
  const SBER_CATS = [
    'Супермаркеты',
    'Рестораны и кафе',
    'Перевод на карту',
    'Перевод с карты',
    'Выдача наличных',
    'Прочие операции',
    'Оплата по QR-коду СБП',
    'Оплата по QR–коду СБП',
    'Коммунальные платежи, связь, интернет',
    'Коммунальные платежи',
    'Транспорт',
    'Развлечения',
    'Здоровье',
    'Одежда и обувь',
    'Аптеки',
    'Фастфуд',
    'АЗС',
    'Путешествия',
    'Образование',
    'Дом, ремонт',
    'Красота',
    'Животные',
    'Госуслуги',
    'Наличные',
    'Благотворительность',
    'Связь, телеком',
    'Комиссии и прочее',
    'Штрафы, налоги',
    'Финансовые операции',
    'Перевод между своими счетами',
    'Зарплата',
    'Пенсия',
    'Социальные выплаты',
    'Возврат покупки',
  ];

  // Склеиваем всё в один длинный текст
  const fullText = allLines.join(' ').replace(/\s+/g, ' ').trim();

  console.log('[sber-parser] длина текста:', fullText.length);

  // ============================================================
  // Основная регулярка
  // ============================================================
  const rowRe = /(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})\s+([А-ЯЁ][А-Яа-яЁё\s,–-]+?)\s+([+\-]?\s*\d[\d\s]*[.,]\d{2})\s+(\d[\d\s]*[.,]\d{2})\s+(\d{2}\.\d{2}\.\d{4})\s+(\d{4,8})\s+(.+?)(?=\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}|$)/g;

  let m;
  let count = 0;

  while ((m = rowRe.exec(fullText)) !== null) {
    count++;
    const [, dateStr, timeStr, catRaw, sumRaw, balanceRaw, , , rawDesc] = m;

    // Дата
    const dd = parseInt(dateStr.slice(0, 2), 10);
    const mm = parseInt(dateStr.slice(3, 5), 10);
    const yy = parseInt(dateStr.slice(6, 10), 10);
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12) continue;

    // Сумма
    const sumText = sumRaw.replace(/\s+/g, '').replace(',', '.');
    const amount = parseFloat(sumText.replace(/[+\-]/g, ''));
    if (!isFinite(amount) || amount <= 0 || amount > 10_000_000) continue;

    // Знак
    const isIncome = sumRaw.trim().startsWith('+');

    // Категория
    let category = 'Прочее';
    const catTrimmed = catRaw.trim();
    for (const c of SBER_CATS) {
      if (catTrimmed === c || catTrimmed.startsWith(c)) {
        category = c;
        break;
      }
    }

    // Описание
    let description = (rawDesc || '')
      .replace(/\.\s*Операция по карте.*$/i, '')
      .replace(/\s*В сумму операции включена комиссия.*$/i, '')
      .replace(/^\s*SBSCR_\s*/i, '')
      .replace(/^\s*MAPP_\s*/i, '')
      .replace(/^\s*POS_\s*/i, '')
      .replace(/^\s*ATM_\s*/i, '')
      .replace(/^\s*C2C_\s*/i, '')
      .replace(/^\s*P2P_\s*/i, '')
      .replace(/^\s*ONL_\s*/i, '')
      .replace(/_\S+@\S+/g, '')
      .replace(/@\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!description) description = category;

    // Тип: по знаку или по описанию
    let type = isIncome ? 'income' : 'expense';

    if (!isIncome && !/-/.test(sumRaw)) {
      const low = (description + ' ' + category).toLowerCase();
      if (/заработн|зарплат|перевод от|возврат|зачислен|пополнени|кэшбэк|проценты|дивиденд|аванс|премия|пенсия|пособи|выплат|перевод на карту/i.test(low)) {
        type = 'income';
      }
    }

    operations.push({
      date: new Date(yy, mm - 1, dd, 12, 0, 0).toISOString(),
      name: description.slice(0, 100),
      amount,
      type,
      category,
      source: 'sber',
    });
  }

  console.log('[sber-parser] совпадений:', count, ', операций:', operations.length);

  // Дедупликация
  const seen = new Set();
  return operations.filter(op => {
    const key = `${op.name}|${op.amount}|${op.date.slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ============================================================
   Категоризация
   ============================================================ */
function guessCategoryFromDescription(desc) {
  const d = (desc || '').toLowerCase();

  if (/пополнение.*система\s+быстрых|система\s+быстрых/i.test(d)) return 'Перевод от';
  if (/пополнение/i.test(d)) return 'Перевод от';
  if (/внешний\s+перевод/i.test(d)) return 'Перевод между пользователями';
  if (/внутренний\s+перевод|перевод\s+с\s+договора|перевод\s+на\s+договор/i.test(d)) return 'Перевод между счетами';
  if (/отмена\s+операции/i.test(d)) return 'Возврат';
  if (/возврат/i.test(d)) return 'Возврат';
  if (/кэшбэк/i.test(d)) return 'Кэшбэк';
  if (/зарплат|заработн|аванс/i.test(d)) return 'Зарплата';
  if (/дивиденд/i.test(d)) return 'Дивиденды';
  if (/процент/i.test(d)) return 'Проценты по вкладу';
  if (/обслуживание|комисси/i.test(d)) return 'Прочее';
  if (/вывод.*брокер|пополнение.*брокер|брокер/i.test(d)) return 'Инвестиции';

  if (/magnit|магнит|пятёрочк|пятерочк|pyaterochka|перекресток|лента|ашан|дикси|fixprice|fix\s*price|krasnoe|красное|gradusi|aia\*5ka|bulkin/i.test(d)) return 'Продукты';
  if (/kfc|burger|макдоналдс|subway|вкусно|parovoz|паровоз|balayan|пицц|додо|yandex\*eda|яндекс\s*еда/i.test(d)) return 'Кафе и рестораны';
  if (/yandex\*go|яндекс\s*go|такси|ridez|uber|gett|ситимобил/i.test(d)) return 'Такси';
  if (/gazpromneft|газпромнефт|rosneft|роснефт|azs|азс|лукойл|lukoil|rznk|azs\s+ip/i.test(d)) return 'Бензин';
  if (/mts|мтс|билайн|beeline|megafon|мегафон|теле2|tele2|mbank|интернет|ростелеком/i.test(d)) return 'Интернет и связь';
  if (/aptek|аптек|gorzdrav|горздрав|36\.6/i.test(d)) return 'Аптека';
  if (/yandex\*360|yandex\*plus|яндекс\s*плюс|netflix|spotify|ivi|okko|kion|youtube\s*premium/i.test(d)) return 'Подписки';
  if (/sportmaster|спортмастер|decathlon|декатлон|adidas|nike/i.test(d)) return 'Спорт';
  if (/детск|детский\s+мир|detskiy\s+mir/i.test(d)) return 'Дети';
  if (/zoomagazin|zoo|зоо|vet|ветеринар|корм/i.test(d)) return 'Домашние животные';
  if (/avtomojka|автомойк|avtomolka|автосервис/i.test(d)) return 'Автомобиль';
  if (/strojmag|строймаг|leroy|леруа|obi|оби|петрович/i.test(d)) return 'Ремонт';
  if (/m\.transport|mos\.transport|tpp_transport|метро|lastochka|ласточка/i.test(d)) return 'Общественный транспорт';
  if (/ozon|озон|wildberries|вайлдберриз|avito|авито|ym\s*\*ozon/i.test(d)) return 'Покупки';
  if (/garmoniya|гармония|samsung|самсунг|mvideo|мвидео|dns|mts\s+e/i.test(d)) return 'Техника';
  if (/bilet|билет|театр|кино|концерт/i.test(d)) return 'Развлечения';
  if (/garden|сад|ogorod|огород/i.test(d)) return 'Сад и огород';

  return 'Прочее';
}

/* ============================================================
   Универсальный разбор
   ============================================================ */
export async function parsePdfFile(file, bankHint = 'auto') {
  const { fullText, pagesData } = await extractPdfText(file);

  if (!fullText.trim()) {
    throw new Error('Не удалось извлечь текст из PDF');
  }

  let bank = bankHint;
  if (bank === 'auto') bank = detectBank(fullText);

  console.log('[pdf] определён банк:', bank);
  console.log('[pdf] всего строк:', pagesData.length);

  let parsed = [];
  if (bank === 'tbank') {
    parsed = parseTbankStatement(pagesData);
  } else if (bank === 'sber') {
    parsed = parseSberStatement(pagesData);
  } else {
    const tb = parseTbankStatement(pagesData);
    const sb = parseSberStatement(pagesData);
    parsed = tb.length >= sb.length ? tb : sb;
  }

  console.log('[pdf] итог операций:', parsed.length);

  return { bank, operations: parsed, fullText };
}