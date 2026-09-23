import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  { path: '/', redirect: '/finance' },

  {
    path: '/finance',
    name: 'finance',
    component: () => import('@/views/FinanceView.vue'),
  },
  {
    path: '/analytics',
    name: 'analytics',
    component: () => import('@/views/AnalyticsView.vue'),
  },
  {
    path: '/deposits',
    name: 'deposits',
    component: () => import('@/views/DepositsView.vue'),
  },

  { path: '/:catchAll(.*)', redirect: '/finance' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  // Публичные страницы — пускаем всегда
  if (to.meta.public) {
    // Если уже залогинен и идёт на /login — редирект на /finance
    if (to.name === 'login' && auth.isAuthenticated) {
      return { name: 'finance' };
    }
    return true;
  }

  // Закрытые страницы — нужна сессия.
  // Проверяем флаг (он выставляется App.vue при bootstrap).
  // Если флага нет, но есть имя пользователя — считаем, что сессия есть,
  // и App.vue проверит её через /auth/me.
  if (!auth.isAuthenticated && !auth.user) {
    return { name: 'login' };
  }

  return true;
});

export default router;