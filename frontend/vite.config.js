import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    vue(),

    VitePWA({
      registerType: 'autoUpdate',

      // Инлайним SW-регистрацию в HTML (убирает отдельный файл)
      injectRegister: 'auto',

      // Все ассеты из public/ попадут в precache
      includeAssets: [
        'favicon.svg',
        'icons.svg',
        'img/favicon.png',
        'img/sber.png',
        'img/tbank.png',
      ],

      // ─── Манифест PWA ───
      manifest: {
        name: 'Финансы PRO+',
        short_name: 'Финансы',
        description: 'Управление личными финансами: счета, операции, аналитика, цели.',
        lang: 'ru',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',

        // Цвет фона приложения (совпадает с --bg-0)
        background_color: '#eef2f8',
        // Цвет статус-бара в standalone
        theme_color: '#eef2f8',

        icons: [
          {
            src: '/img/favicon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/img/favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/img/favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      // ─── Workbox (кэш оболочки) ───
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Ограничение размера файла для precache
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,

        // Навигация SPA — отдавать index.html для всех неизвестных маршрутов
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],

        
        // Не кэшируем API и WS
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https?:\/\/.*\/socket\.io\//,
            handler: 'NetworkOnly',
          },
        ],
      },

      
      // В dev SW отключён, чтобы не мешал
      devOptions: {
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});