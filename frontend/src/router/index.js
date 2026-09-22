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
    path: '/analytics',                             // ← НОВОЕ
    name: 'analytics',                              // ← НОВОЕ
    component: () => import('@/views/AnalyticsView.vue'),  // ← НОВОЕ
  },
  { path: '/:catchAll(.*)', redirect: '/finance' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.token) return { name: 'login' };
  if (to.name === 'login' && auth.token) return { name: 'finance' };
});

export default router;