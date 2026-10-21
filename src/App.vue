<script setup>
  import { onMounted, computed, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useUserStore } from '@/stores/user'
  import { usePlayerStore } from '@/stores/player'
  import { useMusicStore } from '@/stores/music'
  import Navbar from '@/components/NavBar.vue'
  import PlayerBar from '@/components/PlayerBar.vue'
  import ConfirmDialog from '@/components/ConfirmDialog.vue'
  import ToastNotification from '@/components/ToastNotification.vue'
  import SearchResultsOverlay from '@/components/SearchResultsOverlay.vue'
  import BackToTop from '@/components/BackToTop.vue'
  import AmbientBackground from '@/components/AmbientBackground.vue'
  import { resizeImage } from '@/utils/common'
  import { useShortcuts } from '@/composables/useShortcuts'
  import { runPreload } from '@/composables/usePreload'
  import { cancelPageScroll, restorePageScroll } from '@/utils/pageScroll'
  import { useSidebarAutoHide } from '@/composables/useSidebarAutoHide'
  import { useSidebarCollapse } from '@/composables/useSidebarCollapse'

  const userStore = useUserStore()
  const playerStore = usePlayerStore()
  const musicStore = useMusicStore()
  const route = useRoute()
  const { isAutoHideActive } = useSidebarAutoHide()
  const { collapsed } = useSidebarCollapse()
  // 挂载快捷键监听（内部仅安装一次）
  useShortcuts()

  const isPlayerPage = computed(() => route.name === 'player')
  const showNavbar = computed(() => userStore.isLoggedIn && !isPlayerPage.value)

  // 登录态从无到有时触发预加载（首次登录或刷新恢复登录后）
  watch(
    () => userStore.isLoggedIn,
    (loggedIn, was) => {
      if (loggedIn && !was) runPreload()
    },
    { immediate: true }
  )

  onMounted(() => {
    musicStore.restorePlaylists()
    musicStore.restoreCategoryState()
  })
</script>

<template>
  <div
    class="app-container"
    :class="{
      'desktop-shell': showNavbar,
      'player-stage': isPlayerPage,
      'sidebar-auto-hide': showNavbar && isAutoHideActive,
      'sidebar-collapsed': showNavbar && collapsed
    }"
  >
    <AmbientBackground
      :cover-url="
        userStore.isLoggedIn
          ? resizeImage(playerStore.currentTrack?.al?.picUrl, 480)
          : ''
      "
    />
    <Navbar v-if="showNavbar" />
    <main
      class="main-content"
      :class="{
        'has-navbar': userStore.isLoggedIn && !isPlayerPage,
        'has-player': userStore.isLoggedIn && playerStore.hasTrack
      }"
      @wheel.passive="cancelPageScroll"
      @touchstart.passive="cancelPageScroll"
      @pointerdown="cancelPageScroll"
      @keydown="cancelPageScroll"
    >
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in" @after-enter="restorePageScroll">
          <component
            :is="Component"
            @vue:mounted="restorePageScroll"
            @vue:updated="restorePageScroll"
          />
        </transition>
      </router-view>
    </main>
    <PlayerBar v-if="userStore.isLoggedIn && playerStore.hasTrack" />
    <ConfirmDialog />
    <ToastNotification />
    <SearchResultsOverlay />
    <BackToTop />
  </div>
</template>

<style scoped>
  .app-container {
    --sidebar-effective-width: var(--sidebar-width);
    --main-side-offset: calc(var(--sidebar-effective-width) + var(--shell-gap) * 2);
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  .main-content {
    flex: 1;
    width: 100%;
    position: relative;
    min-width: 0;
  }

  .app-container.desktop-shell {
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
    padding-top: calc(var(--navbar-height) + var(--shell-gap));
  }

  .main-content.has-navbar {
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
    scroll-padding-block: var(--spacing-md);
    padding-left: var(--main-side-offset);
  }

  .main-content.has-player {
    padding-bottom: calc(var(--player-height) + var(--shell-gap) * 2);
  }

  .sidebar-collapsed {
    --sidebar-effective-width: var(--sidebar-collapsed-width);
  }

  .sidebar-auto-hide {
    --main-side-offset: 0px;
  }
</style>
