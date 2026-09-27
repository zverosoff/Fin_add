// frontend/src/composables/useTheme.js
import { ref, watch } from 'vue';

const STORAGE_KEY = 'finance-theme-v1';

export const THEMES = [
  { id: 'light',    label: 'Светлая',   icon: '☀️',  bg: '#f2f2f7',  bgPattern: null },
  { id: 'dark',     label: 'Тёмная',    icon: '🌙',  bg: '#0f1419',  bgPattern: null },
  { id: 'auto',     label: 'Как в системе', icon: '⚙️', bg: null,     bgPattern: null },
];

export const BACKGROUNDS = [
  { id: 'default',  label: 'По умолчанию', icon: '⬜', style: null },
  { id: 'sky',      label: 'Небо',         icon: '🌤️', style: 'linear-gradient(180deg, #cfe9ff 0%, #eaf6ff 100%)' },
  { id: 'sunset',   label: 'Закат',        icon: '🌅', style: 'linear-gradient(180deg, #ffe0c7 0%, #ffd1dc 100%)' },
  { id: 'mint',     label: 'Мята',         icon: '🌿', style: 'linear-gradient(180deg, #d7f5e3 0%, #eafaf1 100%)' },
  { id: 'lavender', label: 'Лаванда',      icon: '💜', style: 'linear-gradient(180deg, #e6ddff 0%, #f3edff 100%)' },
  { id: 'paper',    label: 'Бумага',       icon: '📄', style: 'repeating-linear-gradient(45deg, #fafafa 0 8px, #f4f4f4 8px 16px)' },
  { id: 'graph',    label: 'Клетка',       icon: '📐', style: 'repeating-linear-gradient(0deg, #f5f5f5 0 1px, transparent 1px 20px), repeating-linear-gradient(90deg, #f5f5f5 0 1px, transparent 1px 20px)' },
];

const theme = ref(localStorage.getItem(STORAGE_KEY + '-theme') || 'light');
const background = ref(localStorage.getItem(STORAGE_KEY + '-bg') || 'default');

function applyToDom() {
  let resolved = theme.value;
  if (resolved === 'auto') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.bg = background.value;

  const bgConfig = BACKGROUNDS.find(b => b.id === background.value);
  if (bgConfig?.style) {
    document.documentElement.style.setProperty('--chat-bg-pattern', bgConfig.style);
  } else {
    document.documentElement.style.removeProperty('--chat-bg-pattern');
  }
}

watch(theme, (v) => {
  localStorage.setItem(STORAGE_KEY + '-theme', v);
  applyToDom();
});

watch(background, (v) => {
  localStorage.setItem(STORAGE_KEY + '-bg', v);
  applyToDom();
});

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme.value === 'auto') applyToDom();
  });
  applyToDom();
}

export function useTheme() {
  return {
    theme,
    background,
    setTheme: (v) => { theme.value = v; },
    setBackground: (v) => { background.value = v; },
    THEMES,
    BACKGROUNDS,
  };
}