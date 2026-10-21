<script setup>
  import { ref, computed, watch, onUnmounted } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import {
    Music,
    Search,
    LogOut,
    User,
    Sun,
    Moon,
    Monitor,
    X,
    CalendarDays,
    ChartNoAxesColumnIncreasing
  } from '@/components/icons'
  import BrandMark from '@/components/BrandMark.vue'
  import GlassSurface from '@/components/GlassSurface.vue'
  import { useUserStore } from '@/stores/user'
  import { useMusicStore } from '@/stores/music'
  import { useUiStore } from '@/stores/ui'
  import { useTheme } from '@/composables/useTheme'
  import { useSidebarAutoHide } from '@/composables/useSidebarAutoHide'
  import { useSidebarCollapse } from '@/composables/useSidebarCollapse'
  import { cancelPageScroll, getPageScrollContainer } from '@/utils/pageScroll'

  const router = useRouter()
  const route = useRoute()
  const userStore = useUserStore()
  const musicStore = useMusicStore()
  const uiStore = useUiStore()
  const { theme, toggleTheme } = useTheme()
  const { isAutoHideActive, triggerWidth, hideDelay } = useSidebarAutoHide()
  const { collapsed } = useSidebarCollapse()
  const sidebarRegion = ref(null)
  const expanded = ref(false)
  const keyboardWithin = ref(false)
  const hoveredRegions = new Set()
  let showTimer = null
  let hideTimer = null

  function clearTimers() {
    clearTimeout(showTimer)
    clearTimeout(hideTimer)
    showTimer = hideTimer = null
  }

  function scheduleHide() {
    clearTimers()
    if (!isAutoHideActive.value || hoveredRegions.size || keyboardWithin.value) return
    hideTimer = setTimeout(() => {
      expanded.value = false
      hideTimer = null
    }, hideDelay.value)
  }

  function enterRegion(region, event) {
    if (event.pointerType && !['mouse', 'pen'].includes(event.pointerType)) return
    hoveredRegions.add(region)
    clearTimeout(hideTimer)
    hideTimer = null
    if (!isAutoHideActive.value || expanded.value || showTimer !== null) return
    showTimer = setTimeout(() => {
      expanded.value = true
      showTimer = null
    }, 100)
  }

  function leaveRegion(region) {
    hoveredRegions.delete(region)
    if (!hoveredRegions.size) scheduleHide()
  }

  function onSidebarFocusIn(event) {
    clearTimers()
    expanded.value = true
    keyboardWithin.value = event.target.matches(':focus-visible')
    if (!keyboardWithin.value) scheduleHide()
  }

  function onSidebarFocusOut(event) {
    if (sidebarRegion.value?.contains(event.relatedTarget)) return
    keyboardWithin.value = false
    scheduleHide()
  }

  function onSidebarKeydown() {
    clearTimers()
    keyboardWithin.value = true
    expanded.value = true
  }

  watch(isAutoHideActive, () => {
    clearTimers()
    hoveredRegions.clear()
    if (sidebarRegion.value?.matches(':hover')) hoveredRegions.add('panel')
    keyboardWithin.value = !!sidebarRegion.value?.querySelector(':focus-visible')
    expanded.value = !!(hoveredRegions.size || keyboardWithin.value)
  }, { flush: 'post' })
  watch(hideDelay, () => {
    if (hideTimer !== null) scheduleHide()
  })
  onUnmounted(clearTimers)

  const themeLabel = computed(() => {
    if (theme.value === 'auto') return '切换到深色模式'
    if (theme.value === 'dark') return '切换到浅色模式'
    return '跟随系统主题'
  })

  const navigation = [
    { path: '/', name: 'home', label: '首页', icon: Music },
    {
      path: '/daily-recommend',
      name: 'daily-recommend',
      label: '每日推荐',
      icon: CalendarDays
    },
    {
      path: '/toplist',
      name: 'toplist',
      label: '排行榜',
      icon: ChartNoAxesColumnIncreasing
    },
    { path: '/profile', name: 'profile', label: '个人中心', icon: User }
  ]
  const searchKeyword = ref(musicStore.searchKeyword)
  const showUserMenu = ref(false)

  // 搜索返回及清空时同步顶部输入框。
  watch(
    () => musicStore.searchKeyword,
    kw => {
      searchKeyword.value = kw
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

  function onNavigationKeydown(event) {
    if (
      event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey ||
      event.target.closest('input, textarea, select, [contenteditable="true"]')
    ) return
    const container = getPageScrollContainer()
    if (!container) return
    const step = container.clientHeight * 0.875
    const positions = {
      PageDown: container.scrollTop + step,
      PageUp: container.scrollTop - step,
      Home: 0,
      End: container.scrollHeight
    }
    if (!(event.key in positions)) return
    event.preventDefault()
    cancelPageScroll()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({ top: positions[event.key], behavior: reduce ? 'auto' : 'smooth' })
  }
</script>

<template>
  <div
    class="desktop-navigation"
    :class="{
      'auto-hide': isAutoHideActive,
      'sidebar-open': expanded,
      'sidebar-keyboard': keyboardWithin,
      collapsed
    }"
    :style="{ '--sidebar-trigger-width': `${triggerWidth}px` }"
    @keydown="onNavigationKeydown"
  >
    <div
      v-if="isAutoHideActive"
      class="sidebar-trigger"
      aria-hidden="true"
      @pointerenter="enterRegion('trigger', $event)"
      @pointerleave="leaveRegion('trigger')"
    ></div>
    <div
      ref="sidebarRegion"
      class="sidebar-region"
      @pointerenter="enterRegion('panel', $event)"
      @pointerleave="leaveRegion('panel')"
      @pointerdown="keyboardWithin = false"
      @focusin="onSidebarFocusIn"
      @focusout="onSidebarFocusOut"
      @keydown="onSidebarKeydown"
    >
      <GlassSurface as="aside" class="sidebar-navigation" aria-label="主导航">
        <button class="brand-home" aria-label="听潮首页" @click="goToHome">
          <span class="brand-mark"><BrandMark :size="22" /></span>
          <span class="brand-wordmark">听潮</span>
        </button>
        <nav class="primary-navigation">
          <router-link
            v-for="item in navigation"
            :key="item.name"
            :to="item.path"
            class="nav-link"
            :class="{ active: route.name === item.name }"
            :aria-current="route.name === item.name ? 'page' : undefined"
            :aria-label="item.label"
          >
            <component :is="item.icon" :size="19" />
            <span>{{ item.label }}</span>
          </router-link>
        </nav>
      </GlassSurface>
    </div>
    <header class="desktop-toolbar">
      <form class="search-box" role="search" @submit.prevent="doSearch">
        <Search :size="19" aria-hidden="true" />
        <input
          v-model="searchKeyword"
          type="search"
          maxlength="100"
          aria-label="搜索音乐"
          placeholder="搜索歌曲、歌手、歌单或专辑"
          @search="doSearch"
        />
        <button
          v-if="searchKeyword"
          type="button"
          class="clear-btn"
          aria-label="清空搜索"
          @click="clearSearch"
        >
          <X :size="16" />
        </button>
        <span v-else class="search-key" aria-hidden="true">回车搜索</span>
      </form>
      <div class="toolbar-actions">
        <button
          class="theme-toggle"
          type="button"
          :aria-label="themeLabel"
          @click="toggleTheme"
        >
          <Monitor v-if="theme === 'auto'" :size="19" />
          <Sun v-else-if="theme === 'dark'" :size="19" />
          <Moon v-else :size="19" />
        </button>
        <div class="user-menu-wrapper" data-dialog-return>
          <button
            class="avatar-btn"
            aria-label="账户菜单"
            :aria-expanded="showUserMenu"
            @click="showUserMenu = !showUserMenu"
          >
            <img :src="userStore.avatarUrl" alt="我的头像" class="avatar" />
          </button>
          <transition name="fade">
            <div v-if="showUserMenu" class="user-menu" @click.stop>
              <button class="menu-item" @click="goToProfile">
                <User :size="16" />
                <span>个人中心</span>
              </button>
              <button class="menu-item logout" @click="logout">
                <LogOut :size="16" />
                <span>退出登录</span>
              </button>
            </div>
          </transition>
        </div>
      </div>
    </header>
  </div>
</template>

<style scoped>
  .sidebar-region {
    position: fixed;
    top: 50%;
    left: 0;
    width: calc(var(--sidebar-effective-width, var(--sidebar-width)) + var(--shell-gap));
    padding-left: var(--shell-gap);
    z-index: var(--z-navbar);
    transform: translateY(-50%);
    transition:
      transform var(--transition-base),
      opacity var(--transition-base);
  }
  .auto-hide:not(.sidebar-open) .sidebar-region {
    transform: translate(-100%, -50%);
    opacity: 0;
    pointer-events: none;
  }
  .sidebar-keyboard .sidebar-region {
    transition: none;
  }
  .sidebar-trigger {
    position: fixed;
    top: calc(var(--navbar-height) + var(--shell-gap));
    bottom: 0;
    left: 0;
    width: var(--sidebar-trigger-width);
    z-index: var(--z-navbar);
  }
  .sidebar-navigation {
    width: var(--sidebar-effective-width, var(--sidebar-width));
    display: flex;
    flex-direction: column;
    padding: 16px;
    border-radius: 24px;
  }
  .brand-home {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 8px;
    border-radius: 16px;
    text-align: left;
  }
  .brand-mark {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 10px;
    color: var(--color-primary);
    background: var(--color-primary-bg);
    box-shadow: inset 0 1px 0 var(--glass-highlight);
  }
  .brand-wordmark {
    font-size: 20px;
    font-weight: 720;
    letter-spacing: -0.03em;
    line-height: 1.15;
    white-space: nowrap;
  }
  .primary-navigation {
    display: grid;
    gap: 6px;
    margin-top: 12px;
  }
  .nav-link {
    display: flex;
    gap: 10px;
    align-items: center;
    height: 44px;
    padding: 0 10px;
    border-radius: 14px;
    color: var(--color-text-secondary);
    font-size: 14px;
    font-weight: 580;
    transition:
      background-color 180ms,
      color 180ms,
      transform 180ms;
    white-space: nowrap;
  }
  .nav-link:hover {
    background: var(--color-secondary-bg-transparent);
    color: var(--color-text);
    transform: translateX(2px);
  }
  .nav-link.active {
    color: var(--color-accent-ink);
    background: var(--color-primary-bg);
    box-shadow: inset 0 1px 0 var(--glass-highlight);
  }
  .collapsed .sidebar-navigation {
    padding: 12px;
  }
  .collapsed :is(.brand-home, .nav-link) {
    position: relative;
    justify-content: center;
    gap: 0;
    padding-inline: 0;
  }
  .collapsed .brand-home {
    height: 44px;
  }
  .collapsed :is(.brand-wordmark, .nav-link > span) {
    display: none;
  }
  .collapsed .nav-link:hover {
    transform: none;
  }
  .collapsed :is(.brand-home, .nav-link)::after {
    content: attr(aria-label);
    position: absolute;
    left: calc(100% + 24px);
    top: 50%;
    transform: translateY(-50%);
    z-index: var(--z-tooltip, 1200);
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    background: var(--glass-solid);
    color: var(--color-text);
    box-shadow: var(--shadow-md);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.5;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .collapsed :is(.brand-home, .nav-link):is(:hover, :focus-visible)::after {
    opacity: 1;
    visibility: visible;
  }
  .desktop-toolbar {
    position: fixed;
    top: var(--shell-gap);
    left: var(--main-side-offset);
    right: var(--scrollbar-size);
    width: calc(max(100%, 880px) - var(--main-side-offset) - var(--scrollbar-size));
    max-width: var(--content-max-width);
    margin-inline: auto;
    padding-inline: var(--content-inline-padding);
    height: var(--navbar-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    z-index: var(--z-sticky);
  }
  .search-box {
    display: flex;
    align-items: center;
    gap: 12px;
    width: min(520px, 76%);
    height: 44px;
    padding: 0 16px;
    border-radius: var(--radius-full);
    background: var(--surface-content);
    color: var(--color-text-secondary);
    box-shadow: inset 0 1px 0 var(--glass-highlight);
  }
  .search-box input {
    width: 100%;
    min-width: 0;
    font-size: 13px;
  }
  .search-box input::-webkit-search-cancel-button {
    display: none;
  }
  .search-box:focus-within {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  .search-box input:focus-visible {
    outline: none;
  }
  .search-key {
    font-size: 10px;
    white-space: nowrap;
  }
  .clear-btn {
    font-size: 20px;
  }
  .toolbar-actions {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .theme-toggle {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--surface-content);
  }
  .avatar-btn {
    padding: 3px;
    border-radius: 50%;
    border: 1px solid var(--glass-border);
  }
  .avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    object-fit: cover;
  }
  .user-menu-wrapper {
    position: relative;
  }
  .user-menu {
    position: absolute;
    top: calc(100% + 12px);
    right: 0;
    width: 170px;
    padding: 8px;
    background: var(--glass-solid);
    border-radius: 16px;
    box-shadow: var(--shadow-glass);
  }
  .menu-item {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 11px 12px;
    width: 100%;
    text-align: left;
    font-size: 13px;
    border-radius: 10px;
  }
  .menu-item:hover {
    background: var(--color-secondary-bg-hover);
  }
  .logout {
    color: var(--color-error);
  }
  @media (max-width: 1199px) {
    .search-key {
      display: none;
    }
  }
</style>
