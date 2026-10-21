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

/** Иконки категорий */
const CATEGORY_ICONS = {
  'Еда': '🍔', 'Продукты': '🛒', 'Кафе и рестораны': '☕',
  'Транспорт': '🚗', 'Такси': '🚕', 'Бензин': '⛽',
  'Общественный транспорт': '🚌',
  'Жильё': '🏠', 'Аренда': '🔑', 'Ипотека': '🏦',
  'Коммунальные': '💡', 'Интернет и связь': '📶',
  'Развлечения': '🎬', 'Подписки': '📺',
  'Покупки': '🛍️', 'Одежда и обувь': '👕',
  'Здоровье': '💊', 'Аптека': '💉', 'Спорт': '🏋️',
  'Образование': '📚', 'Дети': '👶', 'Домашние животные': '🐾',
  'Путешествия': '✈️', 'Красота': '💄',
  'Подарки': '🎁', 'Благотворительность': '❤️',
  'Кредиты': '💳', 'Страхование': '🛡️', 'Налоги': '📋',
  'Техника': '📱', 'Ремонт': '🔧', 'Автомобиль': '🚙',
  'Зарплата': '💼', 'Аванс': '💰', 'Премия': '🏆',
  'Фриланс': '💻', 'Бизнес': '📊',
  'Инвестиции': '📈', 'Дивиденды': '💹',
  'Проценты по вкладу': '🏦', 'Кэшбэк': '💸', 'Возврат': '↩️',
  'Перевод от': '👤', 'Перевод между счетами': '🔁',
  'Перевод между пользователями': '👥',
  'Прочее': '📦',
};

export function categoryIcon(category) {
  return CATEGORY_ICONS[category] || '📦';
}

export function userEmoji(user) {
  return user === 'Сергей' ? '👨' : user === 'Саша' ? '👩' : '👤';
}

export function bankLogo(id) {
  if (!id) return null;
  if (id.startsWith('sber'))  return '/img/sber.png';
  if (id.startsWith('tbank')) return '/img/tbank.png';
  return null;
}

export function bankLabel(id) {
  if (!id) return '';
  if (id.startsWith('sber'))  return 'СберБанк';
  if (id.startsWith('tbank')) return 'Т-Банк';
  return '';
}