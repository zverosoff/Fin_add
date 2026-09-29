// frontend/src/composables/useTheme.js
import { ref, watch } from 'vue';

const STORAGE_KEY = 'finance-theme-v2';

export const THEMES = [
  { id: 'light',        label: 'Светлая',     icon: '☀️',  group: 'light' },
  { id: 'dark',         label: 'Тёмная',      icon: '🌙',  group: 'dark'  },
  { id: 'sunset',       label: 'Закат',       icon: '🌅',  group: 'light' },
  { id: 'sunset-dark',  label: 'Закат тёмн.', icon: '🌆',  group: 'dark'  },
  { id: 'night',        label: 'Ночь',        icon: '🌌',  group: 'dark'  },
  { id: 'ocean',        label: 'Океан',       icon: '🌊',  group: 'light' },
  { id: 'ocean-dark',   label: 'Океан тёмн.', icon: '🐋',  group: 'dark'  },
  { id: 'auto',         label: 'Система',     icon: '⚙️',  group: 'auto'  },
];

export const BACKGROUNDS = [
  { id: 'default',  label: 'По умолчанию', icon: '⬜', style: null, dark: null },
  { id: 'sky',      label: 'Небо',         icon: '🌤️', style: 'linear-gradient(180deg, #cfe9ff 0%, #eaf6ff 100%)',       dark: 'linear-gradient(180deg, #0b1a2b 0%, #0f2238 100%)' },
  { id: 'sunset',   label: 'Закат',        icon: '🌅', style: 'linear-gradient(180deg, #ffe0c7 0%, #ffd1dc 100%)',       dark: 'linear-gradient(180deg, #2a1520 0%, #3a1a2a 100%)' },
  { id: 'mint',     label: 'Мята',         icon: '🌿', style: 'linear-gradient(180deg, #d7f5e3 0%, #eafaf1 100%)',       dark: 'linear-gradient(180deg, #0e2a1e 0%, #0f3325 100%)' },
  { id: 'lavender', label: 'Лаванда',      icon: '💜', style: 'linear-gradient(180deg, #e6ddff 0%, #f3edff 100%)',       dark: 'linear-gradient(180deg, #1e1538 0%, #2a1e4a 100%)' },
  { id: 'paper',    label: 'Бумага',       icon: '📄', style: 'repeating-linear-gradient(45deg, #fafafa 0 8px, #f4f4f4 8px 16px)', dark: 'repeating-linear-gradient(45deg, #1c1c1e 0 8px, #242426 8px 16px)' },
  { id: 'graph',    label: 'Клетка',       icon: '📐', style: 'repeating-linear-gradient(0deg, #eef2f7 0 1px, transparent 1px 20px), repeating-linear-gradient(90deg, #eef2f7 0 1px, transparent 1px 20px)', dark: 'repeating-linear-gradient(0deg, #1e2732 0 1px, transparent 1px 20px), repeating-linear-gradient(90deg, #1e2732 0 1px, transparent 1px 20px)' },
  { id: 'dots',     label: 'Точки',        icon: '🔵', style: 'radial-gradient(circle, #dfe6ee 1px, transparent 1px) 0 0 / 16px 16px, #f6f8fb', dark: 'radial-gradient(circle, #2a3441 1px, transparent 1px) 0 0 / 16px 16px, #0f1419' },
  { id: 'waves',    label: 'Волны',        icon: '🌊', style: 'repeating-radial-gradient(circle at 0 100%, transparent 0 10px, #eaf3fb 10px 20px)', dark: 'repeating-radial-gradient(circle at 0 100%, transparent 0 10px, #172130 10px 20px)' },
];

export const FONT_SIZES = [
  { id: 'sm', label: 'Мелкий',       scale: 0.85 },
  { id: 'md', label: 'Обычный',      scale: 1.0  },
  { id: 'lg', label: 'Крупный',      scale: 1.15 },
  { id: 'xl', label: 'Очень крупный', scale: 1.3  },
];

export const FONT_FAMILIES = [
  { id: 'system', label: 'Система', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { id: 'inter',  label: 'Inter',   family: 'Inter, -apple-system, sans-serif' },
  { id: 'serif',  label: 'Serif',   family: 'Georgia, "Times New Roman", serif' },
  { id: 'mono',   label: 'Mono',    family: '"JetBrains Mono", "SF Mono", Consolas, monospace' },
];

const theme = ref(localStorage.getItem(STORAGE_KEY + '-theme') || 'light');
const background = ref(localStorage.getItem(STORAGE_KEY + '-bg') || 'default');
const fontSize = ref(localStorage.getItem(STORAGE_KEY + '-fs') || 'md');
const fontFamily = ref(localStorage.getItem(STORAGE_KEY + '-ff') || 'system');

function resolveTheme(id) {
  if (id === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return id;
}

function isDarkTheme(id) {
  const resolved = resolveTheme(id);
  return ['dark', 'sunset-dark', 'night', 'ocean-dark'].includes(resolved)
    || THEMES.find(t => t.id === resolved)?.group === 'dark';
}

function applyToDom() {
  const resolved = resolveTheme(theme.value);

  // ✅ Пишем тему чата в отдельный data-атрибут — не трогаем общую тему страницы
  document.documentElement.dataset.chatTheme = resolved;
  document.documentElement.dataset.bg = background.value;

  const bgConfig = BACKGROUNDS.find(b => b.id === background.value);
  const dark = isDarkTheme(theme.value);
  const pattern = dark
    ? (bgConfig?.dark || bgConfig?.style || null)
    : (bgConfig?.style || null);

  if (pattern) {
    document.documentElement.style.setProperty('--chat-bg-pattern', pattern);
  } else {
    document.documentElement.style.removeProperty('--chat-bg-pattern');
  }
}

function applyFonts() {
  const size = FONT_SIZES.find(f => f.id === fontSize.value);
  const fam = FONT_FAMILIES.find(f => f.id === fontFamily.value);

  if (size) {
    document.documentElement.style.setProperty('--chat-font-scale', String(size.scale));
  }
  if (fam) {
    document.documentElement.style.setProperty('--chat-font-family', fam.family);
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

watch(fontSize, (v) => {
  localStorage.setItem(STORAGE_KEY + '-fs', v);
  applyFonts();
});

watch(fontFamily, (v) => {
  localStorage.setItem(STORAGE_KEY + '-ff', v);
  applyFonts();
});

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme.value === 'auto') applyToDom();
  });
  applyToDom();
  applyFonts();
}

export function useTheme() {
  return {
    theme,
    background,
    fontSize,
    fontFamily,
    setTheme:      (v) => { theme.value = v; },
    setBackground: (v) => { background.value = v; },
    setFontSize:   (v) => { fontSize.value = v; },
    setFontFamily: (v) => { fontFamily.value = v; },
    THEMES,
    BACKGROUNDS,
    FONT_SIZES,
    FONT_FAMILIES,
  };
}