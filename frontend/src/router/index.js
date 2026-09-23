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
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
  },

  { path: '/:catchAll(.*)', redirect: '/finance' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.public) {
    if (to.name === 'login' && auth.isAuthenticated) {
      return { name: 'finance' };
    }
    return true;
  }

  if (!auth.isAuthenticated && !auth.user) {
    return { name: 'login' };
  }

  return true;
});

export default router;