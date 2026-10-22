import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getPageScrollContainer, queuePageScroll } from '@/utils/pageScroll'
import { getLoginRedirect } from '@/utils/common'

const pagePositions = new Map()
let currentEntry = window.history.state?.position

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    const position = savedPosition
      ? pagePositions.get(window.history.state?.position) || savedPosition
      : { top: 0, left: 0 }
    queuePageScroll(position)
    return false
  },
  routes: [
    {
      path: '/ai',
      name: 'ai',
      component: () => import('@/views/AiView.vue'),
      meta: { requiresAuth: true, title: 'AI 助手 - 听潮' }
    },
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
      path: '/local-playlist/:id',
      name: 'local-playlist',
      component: () => import('@/views/PlaylistView.vue'),
      meta: { requiresAuth: true, localPlaylist: true, title: '本机历史歌单 - 听潮' }
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
      path: '/album/:id',
      name: 'album',
      component: () => import('@/views/AlbumView.vue'),
      meta: { requiresAuth: true, title: '专辑 - 听潮' }
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

router.beforeEach(async to => {
  const container = getPageScrollContainer()
  pagePositions.set(currentEntry, {
    top: container ? container.scrollTop : window.scrollY,
    left: container ? container.scrollLeft : window.scrollX
  })
  const userStore = useUserStore()
  if (!restored) {
    userStore.restore()
    restored = true
  }

  document.title = to.meta.title || '听潮'

  const session = userStore.sessionStatus === 'error' ? 'error' : await userStore.ensureSession()

  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath, ...(session === 'error' ? { retry: 'session' } : {}) } }
  } else if (to.name === 'login' && userStore.isLoggedIn) {
    return getLoginRedirect(to.query.redirect)
  }
})

window.addEventListener('vmusic:session-expired', () => {
  const user = useUserStore()
  if (!user.isLoggedIn) return
  const target = router.currentRoute.value
  user.expireSession()
  router.replace({ name: 'login', query: { redirect: target.fullPath } })
})

router.afterEach((_to, _from, failure) => {
  if (!failure) currentEntry = window.history.state?.position
})

export default router
