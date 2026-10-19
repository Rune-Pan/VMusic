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
  import { useShortcuts } from '@/composables/useShortcuts'
  import { runPreload } from '@/composables/usePreload'

  const userStore = useUserStore()
  const playerStore = usePlayerStore()
  const musicStore = useMusicStore()
  const route = useRoute()
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
    userStore.restore()
    userStore.fetchLikedSongs()
    musicStore.restorePlaylists()
    musicStore.restoreCategoryState()
  })
</script>

<template>
  <div class="app-container">
    <Navbar v-if="showNavbar" />
    <main
      class="main-content"
      :class="{
        'has-navbar': userStore.isLoggedIn && !isPlayerPage,
        'has-player': userStore.isLoggedIn && playerStore.hasTrack
      }"
    >
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
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
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .main-content {
    flex: 1;
    width: 100%;
    transition: padding-top 0.3s ease;
  }

  .main-content.has-navbar {
    padding-top: var(--navbar-height);
  }

  .main-content.has-player {
    padding-bottom: var(--player-height);
  }
</style>
