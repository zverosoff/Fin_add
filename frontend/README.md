# 💎 Финансы PRO+

Fullstack-приложение для управления личными финансами.

## Стек

- **Frontend**: Vue 3 + Vite + Pinia + Vue Router
- **Backend**: Node.js + Express + SQLite (`node:sqlite`) + Socket.IO
- **Auth**: JWT + PIN

## Структура
finance-pro/
├── backend/ # Node.js API + WebSocket + SQLite
│ ├── src/
│ ├── amvera.yml
│ └── package.json
├── frontend/ # Vue 3 SPA
│ ├── src/
│ ├── .env.production
│ ├── vercel.json
│ └── package.json
└── .gitignore

text

## Локальный запуск

**Backend:**
```bash
cd backend
npm install
npm run dev
Frontend:

bash
cd frontend
npm install
npm run dev
Открыть: http://localhost:5173

Деплой
Backend → Amvera (Node.js Server, /data для SQLite)

Frontend → Vercel (Vite preset, frontend/ root)

Лицензия
Приватный проект.