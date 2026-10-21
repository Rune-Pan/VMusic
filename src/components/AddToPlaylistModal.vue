<script setup>
  import GlassSurface from '@/components/GlassSurface.vue'
  import { ref, computed, watch } from 'vue'
  import { X, Loader2, Music } from '@/components/icons'
  import { useUserStore } from '@/stores/user'
  import { useMusicStore } from '@/stores/music'
  import { useUiStore } from '@/stores/ui'
  import { resizeImage } from '@/utils/common'
  import { useEscClose } from '@/composables/useEscClose'

  const props = defineProps({
    visible: { type: Boolean, default: false },
    track: { type: Object, default: null }
  })

  const emit = defineEmits(['close'])

  const userStore = useUserStore()
  const musicStore = useMusicStore()
  const uiStore = useUiStore()

  const serverPlaylists = computed(() => (musicStore.serverPlaylists || []).filter(p => String(p.creator?.userId) === String(userStore.userInfo.id) && p.specialType !== 5))
  const loading = computed(() => musicStore.playlistsLoading)
  const addingId = ref(null)

  async function loadPlaylists() {
    if (!userStore.isLoggedIn || !userStore.userInfo.id) return
    try { await musicStore.fetchUserPlaylists(userStore.userInfo.id) }
    catch { /* 保留弹窗，展示重试 */ }
  }

  async function addToPlaylist(playlist) {
    if (!props.track || addingId.value) return
    const uid = userStore.userInfo.id
    addingId.value = playlist.id
    try {
      await musicStore.changePlaylistTracks(playlist.id, [props.track.id], 'add')
      if (uid !== userStore.userInfo.id) return
      uiStore.showToast(`已添加到「${playlist.name}」`, 'success')
      emit('close')
    } catch (e) {
      if (uid === userStore.userInfo.id) uiStore.showToast(e.message || '添加失败，请稍后重试', 'error')
    } finally { addingId.value = null }
  }

  function close() {
    emit('close')
  }

  useEscClose(() => props.visible, close)

  watch(
    () => props.visible,
    v => {
      if (v) loadPlaylists()
    },
    { immediate: true }
  )
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="atp-overlay" @click="close">
      <GlassSurface class="atp-modal" modal label="添加到歌单" @click.stop>
        <div class="atp-header">
          <div class="atp-title">添加到歌单</div>
          <button class="close-btn" aria-label="关闭" @click="close">
            <X :size="20" />
          </button>
        </div>

        <div class="atp-body">
          <div v-if="loading" class="atp-empty">
            <Loader2 class="spin" :size="24" />
            <span>加载歌单...</span>
          </div>

          <template v-else>
            <div v-if="musicStore.playlistsError" class="atp-empty" role="alert">
              <p>{{ musicStore.playlistsError }}</p>
              <button @click="musicStore.fetchUserPlaylists(userStore.userInfo.id, true).catch(() => {})">重新加载歌单</button>
            </div>
            <!-- 网易云歌单 -->
            <div v-if="serverPlaylists.length > 0" class="atp-section">
              <div class="atp-section-title">网易云歌单</div>
              <div
                v-for="pl in serverPlaylists"
                :key="'server-' + pl.id"
                class="atp-item"
                role="button"
                tabindex="0"
                :aria-label="`添加到${pl.name}`"
                :aria-disabled="Boolean(addingId)"
                @keydown.enter.stop="addToPlaylist(pl)"
                @keydown.space.stop.prevent="addToPlaylist(pl)"
                @click="addToPlaylist(pl)"
              >
                <img
                  :src="resizeImage(pl.coverImgUrl, 96)"
                  alt=""
                  class="atp-cover"
                />
                <div class="atp-info">
                  <div class="atp-name">{{ pl.name }}</div>
                  <div class="atp-count">{{ pl.trackCount || 0 }} 首</div>
                </div>
                <Loader2
                  v-if="addingId === pl.id"
                  :size="18"
                  class="spin atp-loading-icon"
                />
              </div>
            </div>

            <!-- 空状态 -->
            <div
              v-if="
                serverPlaylists.length === 0 && !musicStore.playlistsError
              "
              class="atp-empty"
            >
              <Music :size="48" color="var(--color-text-muted)" />
              <p>还没有歌单，去个人中心创建一个吧</p>
            </div>
          </template>
        </div>
      </GlassSurface>
    </div>
  </transition>
</template>

<style scoped>
  .atp-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    backdrop-filter: blur(4px);
    z-index: var(--z-modal);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);
  }

  .atp-modal {
    width: 100%;
    max-width: 420px;
    max-height: 70vh;
    background: var(--color-modal-bg);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .atp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-border-light);
  }

  .atp-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 50%;
    color: var(--color-text-muted);
    transition:
      color var(--transition-fast),
      background-color var(--transition-fast);
  }

  .close-btn:hover {
    color: var(--color-text);
    background: var(--color-secondary-bg-hover);
  }

  .atp-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-sm) 0;
  }

  .atp-section {
    padding: 0 var(--spacing-sm);
  }

  .atp-section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-muted);
    padding: var(--spacing-sm) var(--spacing-md);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .atp-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .atp-item:hover {
    background: var(--color-secondary-bg-hover);
  }

  .atp-cover {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-sm);
    object-fit: cover;
    flex-shrink: 0;
  }

  .atp-info {
    flex: 1;
    min-width: 0;
  }

  .atp-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .atp-count {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 2px;
  }

  .atp-loading-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .atp-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-2xl) var(--spacing-lg);
    color: var(--color-text-muted);
    font-size: 14px;
  }
</style>
