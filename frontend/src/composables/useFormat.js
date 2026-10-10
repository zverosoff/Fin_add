/** Число → «12 345» */
export function fmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

/** Число → «12 345,50» */
export function fmtExact(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Дата → «22 сентября, пн» */
export function fmtDateLong(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    weekday: 'short',
  });
}

/** Дата → «22.09» */
export function fmtDateShort(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

/** Месяц → «Сентябрь 2026» */
export function fmtMonth(date) {
  const d = date instanceof Date ? date : new Date(date);
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Ключ дня «2026-09-22» */
export function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Сегодня ли */
export function isToday(date) {
  return dayKey(date) === dayKey(new Date());
}

/* ============================================================
   ✅ ИКОНКИ КАТЕГОРИЙ — PNG
   ============================================================ */

const CATEGORY_ICON_MAP = {
  // Расходы
  'Продукты': 'groceries',
  'Кафе и рестораны': 'cafe',
  'Еда': 'food',
  'Такси': 'taxi',
  'Бензин': 'fuel',
  'Общественный транспорт': 'transport',
  'Транспорт': 'car',
  'Аренда': 'rent',
  'Ипотека': 'mortgage',
  'Жильё': 'home',
  'Коммунальные': 'utilities',
  'Интернет и связь': 'internet',
  'Развлечения': 'entertainment',
  'Подписки': 'subscriptions',
  'Покупки': 'shopping',
  'Одежда и обувь': 'clothes',
  'Техника': 'tech',
  'Аптека': 'pharmacy',
  'Здоровье': 'health',
  'Спорт': 'sport',
  'Красота': 'beauty',
  'Образование': 'education',
  'Дети': 'kids',
  'Домашние животные': 'pets',
  'Путешествия': 'travel',
  'Кредиты': 'credit',
  'Страхование': 'insurance',
  'Налоги': 'taxes',
  'Ремонт': 'repair',
  'Автомобиль': 'car',
  'Гараж': 'garage',
  'Сад и огород': 'garden',
  'Подарки': 'gifts',
  'Благотворительность': 'charity',

  // Доходы
  'Зарплата': 'salary',
  'Аванс': 'advance',
  'Премия': 'bonus',
  'Фриланс': 'freelance',
  'Бизнес': 'business',
  'Инвестиции': 'investments',
  'Дивиденды': 'dividends',
  'Проценты по вкладу': 'deposit',
  'Кэшбэк': 'cashback',
  'Возврат': 'refund',
  'Перевод от': 'transfer-in',
  'Перевод между счетами': 'transfer',
  'Перевод между пользователями': 'transfer-user',
  'Внутренний перевод': 'transfer-internal',

  // Прочее
  'Прочее': 'other',
};

/**
 * ✅ Путь к PNG-иконке категории
 */
export function categoryIcon(category) {
  const name = CATEGORY_ICON_MAP[category] || 'other';
  return `/img/icons/categories/${name}.png`;
}

/* ============================================================
   ✅ АВАТАРЫ ПОЛЬЗОВАТЕЛЕЙ — PNG
   Файлы лежат в /img/icons/mascots/
   ============================================================ */

export const AVATAR_MAN   = '/img/icons/mascots/avatar-man.png';
export const AVATAR_WOMAN = '/img/icons/mascots/avatar-woman.png';

/**
 * ✅ Аватар пользователя (PNG)
 */
export function userAvatarPath(user) {
  if (user === 'Сергей') return AVATAR_MAN;
  if (user === 'Саша') return AVATAR_WOMAN;
  return AVATAR_MAN;
}

/**
 * @deprecated — используйте userAvatarPath
 */
export function userEmoji(user) {
  return user === 'Сергей' ? '👨' : user === 'Саша' ? '👩' : '👤';
}

/* ============================================================
   ✅ БАНКИ — пути на /img/icons/banks/
   ============================================================ */

/** ✅ Иконка счёта/банка (для банк-монеты) */
export function bankIconPath(id) {
  if (!id) return '/img/icons/banks/default.png';
  if (id === 'cash' || id.startsWith('cash_')) return '/img/icons/nav/cash.png';
  if (id.startsWith('sber'))  return '/img/icons/banks/sber.png';
  if (id.startsWith('tbank')) return '/img/icons/banks/tbank.png';
  return '/img/icons/banks/default.png';
}

/** ✅ Логотип банка (алиас) */
export function bankLogo(id) {
  return bankIconPath(id);
}

/** ✅ Название банка */
export function bankLabel(id) {
  if (!id) return '';
  if (id === 'cash' || id.startsWith('cash_')) return 'Наличные';
  if (id.startsWith('sber'))  return 'СберБанк';
  if (id.startsWith('tbank')) return 'Т-Банк';
  return 'Счёт';
}