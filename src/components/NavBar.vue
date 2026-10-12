<script setup>
  import { ref, computed, watch } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { Music, Search, LogOut, User, Sun, Moon, Monitor } from '@lucide/vue'
  import { useUserStore } from '@/stores/user'
  import { useMusicStore } from '@/stores/music'
  import { useUiStore } from '@/stores/ui'
  import { useTheme } from '@/composables/useTheme'

  const router = useRouter()
  const route = useRoute()
  const userStore = useUserStore()
  const musicStore = useMusicStore()
  const uiStore = useUiStore()
  const { theme, toggleTheme } = useTheme()

  const themeLabel = computed(() => {
    if (theme.value === 'auto') return '切换到深色模式'
    if (theme.value === 'dark') return '切换到浅色模式'
    return '跟随系统主题'
  })

  const searchKeyword = ref('')
  const showUserMenu = ref(false)
  const isHome = computed(() => route.name === 'home')
  const isProfile = computed(() => route.name === 'profile')
  const isDailyRecommend = computed(() => route.name === 'daily-recommend')
  const isToplist = computed(() => route.name === 'toplist')

  // store 清空时同步本地搜索框（如点击搜索结果播放后 SearchResultsOverlay 调 clearSearch）
  watch(
    () => musicStore.searchKeyword,
    kw => {
      if (kw === '' && searchKeyword.value !== '') {
        searchKeyword.value = ''
      }
    }
  )

  function doSearch() {
    if (!searchKeyword.value.trim()) return
    musicStore.search(searchKeyword.value)
  }
  function clearSearch() {
    searchKeyword.value = ''
    musicStore.clearSearch()
  }

  async function logout() {
    showUserMenu.value = false
    const confirmed = await uiStore.showConfirm({
      title: '退出登录',
      message: '确定要退出登录吗？',
      confirmText: '退出',
      cancelText: '取消'
    })
    if (confirmed) {
      userStore.logout()
      router.push({ name: 'login' })
    }
  }

  function goToProfile() {
    showUserMenu.value = false
    router.push({ name: 'profile' })
  }
  function goToHome() {
    router.push({ name: 'home' })
  }
</script>

<template>
  <nav class="navbar glass">
    <div class="nav-left">
      <div class="logo" @click="goToHome">
        <Music :size="24" color="var(--color-primary)" />
        <span class="logo-text">听潮</span>
      </div>
    </div>
    <div class="nav-center">
      <router-link to="/" class="nav-link" :class="{ active: isHome }">
        首页
      </router-link>
      <router-link
        to="/daily-recommend"
        class="nav-link"
        :class="{ active: isDailyRecommend }"
      >
        每日推荐
      </router-link>
      <router-link
        to="/toplist"
        class="nav-link"
        :class="{ active: isToplist }"
      >
        排行榜
      </router-link>
      <router-link
        to="/profile"
        class="nav-link"
        :class="{ active: isProfile }"
      >
        个人中心
      </router-link>
    </div>
    <div class="nav-right">
      <button
        class="theme-toggle"
        type="button"
        :aria-label="themeLabel"
        @click="toggleTheme"
      >
        <Monitor v-if="theme === 'auto'" :size="18" />
        <Sun v-else-if="theme === 'dark'" :size="18" />
        <Moon v-else :size="18" />
      </button>
      <div class="search-box">
        <Search :size="16" color="var(--color-text-muted)" />
        <input
          v-model="searchKeyword"
          type="search"
          maxlength="100"
          placeholder="搜索歌曲、歌手，回车搜索"
          @search="doSearch"
        />
        <button v-if="searchKeyword" class="clear-btn" @click="clearSearch">
          ×
        </button>
      </div>
      <div class="user-menu-wrapper">
        <button class="avatar-btn" @click="showUserMenu = !showUserMenu">
          <img :src="userStore.avatarUrl" alt="avatar" class="avatar" />
        </button>
        <transition name="fade">
          <div v-if="showUserMenu" class="user-menu" @click.stop>
            <div class="menu-item" @click="goToProfile">
              <User :size="16" />
              <span>个人中心</span>
            </div>
            <div class="menu-divider"></div>
            <div class="menu-item logout" @click="logout">
              <LogOut :size="16" />
              <span>退出登录</span>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </nav>
</template>

<style scoped>
  .navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--navbar-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--spacing-xl);
    background: var(--color-navbar-bg);
    z-index: var(--z-navbar);
    border-bottom: 1px solid var(--color-border-light);
  }
  .nav-left {
    display: flex;
    align-items: center;
    flex: 1;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin-left: var(--spacing-sm);
    cursor: pointer;
  }
  .logo-text {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text);
  }
  .nav-center {
    display: flex;
    gap: var(--spacing-md);
    flex: 1;
    justify-content: center;
  }
  .nav-link {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-secondary);
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }
  .nav-link:hover {
    color: var(--color-text);
    background: var(--color-secondary-bg-hover);
    text-decoration: none;
  }
  .nav-link.active {
    color: var(--color-primary);
  }
  .nav-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    flex: 1;
    justify-content: flex-end;
  }
  .theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
  }
  .theme-toggle:hover {
    background: var(--color-secondary-bg-hover);
    color: var(--color-text);
  }
  .search-box {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    background: var(--color-secondary-bg);
    border-radius: var(--radius-full);
    padding: var(--spacing-xs) var(--spacing-md);
    width: 240px;
    transition: all var(--transition-fast);
  }
  .search-box input {
    flex: 1;
    font-size: 13px;
    color: var(--color-text);
    outline: none;
  }

  /* 隐藏 type="search" 的原生清除按钮 */
  .search-box input::-webkit-search-cancel-button {
    display: none;
  }

  .search-box input::-moz-search-cancel-button {
    display: none;
  }
  .clear-btn {
    font-size: 18px;
    color: var(--color-text-muted);
    padding: 0 4px;
  }
  .clear-btn:hover {
    color: var(--color-text);
  }
  .user-menu-wrapper {
    position: relative;
  }
  .avatar-btn {
    padding: 0;
    border-radius: 50%;
    overflow: hidden;
  }
  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }
  .avatar:hover {
    filter: brightness(0.85);
  }
  .user-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background: var(--color-card-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    padding: var(--spacing-xs);
    min-width: 160px;
    border: 1px solid var(--color-border-light);
  }
  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    font-size: 14px;
    color: var(--color-text);
    cursor: pointer;
  }
  .menu-item:hover {
    background: var(--color-secondary-bg-hover);
  }
  .menu-item.logout:hover {
    color: var(--color-error);
  }
  .menu-divider {
    height: 1px;
    background: var(--color-border-light);
    margin: var(--spacing-xs) 0;
  }
</style>
