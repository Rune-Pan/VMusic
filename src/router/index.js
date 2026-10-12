import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false, title: '登录 - 听潮' }
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true, title: '听潮 - 发现好音乐' }
    },
    {
      path: '/player/:id',
      name: 'player',
      component: () => import('@/views/PlayerView.vue'),
      meta: { requiresAuth: true, title: '播放 - 听潮' }
    },
    {
      path: '/playlist/:id',
      name: 'playlist',
      component: () => import('@/views/PlaylistView.vue'),
      meta: { requiresAuth: true, title: '歌单 - 听潮' }
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
      meta: { requiresAuth: true, title: '个人中心 - 听潮' }
    },
    {
      path: '/daily-recommend',
      name: 'daily-recommend',
      component: () => import('@/views/DailyRecommendView.vue'),
      meta: { requiresAuth: true, title: '每日推荐 - 听潮' }
    },
    {
      path: '/toplist',
      name: 'toplist',
      component: () => import('@/views/ToplistView.vue'),
      meta: { requiresAuth: true, title: '排行榜 - 听潮' }
    },
    {
      path: '/artist/:id',
      name: 'artist',
      component: () => import('@/views/ArtistView.vue'),
      meta: { requiresAuth: true, title: '歌手 - 听潮' }
    }
  ]
})

let restored = false

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  if (!restored) {
    userStore.restore()
    restored = true
  }

  document.title = to.meta.title || '听潮'

  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else if (to.name === 'login' && userStore.isLoggedIn) {
    next({ name: 'home' })
  } else {
    next()
  }
})

export default router
