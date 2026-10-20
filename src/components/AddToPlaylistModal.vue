<script setup>
  import GlassSurface from '@/components/GlassSurface.vue'
  import { ref, watch } from 'vue'
  import { X, Loader2, Music, Check } from '@/components/icons'
  import { userPlaylist } from '@/api/user'
  import { addTracksToPlaylist } from '@/api/playlist'
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

  const serverPlaylists = ref([])
  const loading = ref(false)
  const addingId = ref(null)

  async function loadPlaylists() {
    if (!userStore.isLoggedIn || !userStore.userInfo.id) return
    loading.value = true
    try {
      const data = await userPlaylist({ uid: userStore.userInfo.id, limit: 50 })
      serverPlaylists.value = data.playlist || []
    } catch (e) {
      console.error('Failed to load playlists:', e)
    } finally {
      loading.value = false
    }
  }

  function isInPlaylist(playlist) {
    if (!props.track) return false
    // 本地歌单：检查 tracks 数组
    if (playlist.tracks) {
      return playlist.tracks.some(t => t.id === props.track.id)
    }
    // 服务端歌单：暂时返回 false（无法预知所有歌曲）
    return false
  }

  async function addToPlaylist(playlist, isLocal) {
    if (!props.track || addingId.value) return
    if (isInPlaylist(playlist)) return

    addingId.value = playlist.id
    try {
      if (isLocal) {
        musicStore.addTrackToPlaylist(playlist.id, props.track)
        uiStore.showToast(`已添加到「${playlist.name}」`, 'success')
        emit('close')
      } else {
        await addTracksToPlaylist({
          op: 'add',
          pid: playlist.id,
          tracks: String(props.track.id)
        })
        uiStore.showToast(`已添加到「${playlist.name}」`, 'success')
        emit('close')
      }
    } catch (e) {
      console.error('Failed to add to playlist:', e)
      uiStore.showToast('添加失败，请稍后重试', 'error')
    } finally {
      addingId.value = null
    }
  }

  function close() {
    emit('close')
  }

  useEscClose(() => props.visible, close)

  watch(
    () => props.visible,
    v => {
      if (v) loadPlaylists()
    }
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
            <!-- 本地歌单 -->
            <div v-if="musicStore.userPlaylists.length > 0" class="atp-section">
              <div class="atp-section-title">本地歌单</div>
              <div
                v-for="pl in musicStore.userPlaylists"
                :key="'local-' + pl.id"
                class="atp-item"
                :class="{ 'atp-item-added': isInPlaylist(pl) }"
                role="button"
                tabindex="0"
                :aria-label="`添加到${pl.name}`"
                @keydown.enter.stop="addToPlaylist(pl, true)"
                @keydown.space.stop.prevent="addToPlaylist(pl, true)"
                @click="addToPlaylist(pl, true)"
              >
                <img
                  :src="resizeImage(pl.coverUrl, 96)"
                  alt=""
                  class="atp-cover"
                />
                <div class="atp-info">
                  <div class="atp-name">{{ pl.name }}</div>
                  <div class="atp-count">{{ pl.tracks?.length || 0 }} 首</div>
                </div>
                <Check v-if="isInPlaylist(pl)" :size="18" class="atp-check" />
                <Loader2
                  v-else-if="addingId === pl.id"
                  :size="18"
                  class="spin atp-loading-icon"
                />
              </div>
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
                @keydown.enter.stop="addToPlaylist(pl, false)"
                @keydown.space.stop.prevent="addToPlaylist(pl, false)"
                @click="addToPlaylist(pl, false)"
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
                musicStore.userPlaylists.length === 0 &&
                serverPlaylists.length === 0
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

  .atp-item-added {
    opacity: 0.5;
    cursor: default;
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

  .atp-check {
    color: var(--color-primary);
    flex-shrink: 0;
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
