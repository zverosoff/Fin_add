import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    vue(),

    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      includeAssets: [
        'favicon.svg',
        'icons.svg',
        'img/favicon.png',
        'img/sber.png',
        'img/tbank.png',
      ],

      manifest: {
        name: 'Финансы PRO+',
        short_name: 'Финансы',
        description: 'Управление личными финансами: счета, операции, аналитика, цели, чат.',
        lang: 'ru',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#eef2f8',
        theme_color: '#eef2f8',

        icons: [
          { src: '/img/favicon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/img/favicon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/img/favicon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },

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