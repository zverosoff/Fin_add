// frontend/src/composables/useLinkify.js
/**
 * Простой и безопасный парсер:
 *  - URL       → <a target="_blank" rel="noopener">
 *  - Телефоны  → <a href="tel:...">
 *  - *жирный*  → <b>
 *  - _курсив_  → <i>
 *  - `код`     → <code>
 *
 * Возвращает HTML-строку. Экранирование ввода обязательно!
 */

const URL_RE = /\bhttps?:\/\/[^\s<>"']+|(?<![@\w])www\.[^\s<>"']+/gi;
const PHONE_RE = /(?:\+7|\b8)[\s\-()]?\d{3}[\s\-()]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}\b/g;
const BOLD_RE = /\*([^*\n]+)\*/g;
const ITALIC_RE = /_([^_\n]+)_/g;
const CODE_RE = /`([^`\n]+)`/g;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function linkify(raw) {
  if (!raw) return '';

  // 1) Экранируем ВСЁ, чтобы не было XSS
  let s = escapeHtml(raw);

  // 2) Markdown-форматирование
  s = s.replace(CODE_RE, '<code class="md-code">$1</code>');
  s = s.replace(BOLD_RE, '<b>$1</b>');
  s = s.replace(ITALIC_RE, '<i>$1</i>');

  // 3) URL
  s = s.replace(URL_RE, (match) => {
    const href = match.startsWith('http') ? match : `https://${match}`;
    const safe = href.replace(/"/g, '&quot;');
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="md-link">${match}</a>`;
  });

  // 4) Телефоны
  s = s.replace(PHONE_RE, (match) => {
    const digits = match.replace(/\D/g, '');
    return `<a href="tel:${digits}" class="md-phone">${match}</a>`;
  });

  return s;
}