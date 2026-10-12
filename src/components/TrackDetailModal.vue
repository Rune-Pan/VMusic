<script setup>
  import { ref, computed, watch } from 'vue'
  import { X, Loader2 } from '@lucide/vue'
  import { userPlayHistory } from '@/api/user'
  import { useUserStore } from '@/stores/user'
  import { resizeImage } from '@/utils/common'
  import { IMAGE_SIZE_CARD } from '@/constants'
  import { useEscClose } from '@/composables/useEscClose'

  const props = defineProps({
    visible: {
      type: Boolean,
      default: false
    },
    track: {
      type: Object,
      default: null
    }
  })

  const emit = defineEmits(['close'])
  const userStore = useUserStore()

  const playCount = ref(null)
  const loadingPlayCount = ref(false)

  const artistName = computed(
    () => props.track?.ar?.map(a => a.name).join(', ') || '未知歌手'
  )
  const albumName = computed(() => props.track?.al?.name || '未知专辑')
  const coverUrl = computed(() =>
    resizeImage(props.track?.al?.picUrl, IMAGE_SIZE_CARD)
  )

  function formatTime(timestamp) {
    if (!timestamp) return '--'
    const date = new Date(timestamp)
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  }

  function getFeeText(fee) {
    const map = { 0: '免费', 1: 'VIP', 4: '付费', 8: '试听' }
    return map[fee] || '未知'
  }

  async function fetchPlayCount() {
    if (!userStore.isLoggedIn || !userStore.userInfo.id || !props.track?.id)
      return
    loadingPlayCount.value = true
    playCount.value = null
    try {
      const data = await userPlayHistory({
        uid: userStore.userInfo.id,
        type: 0
      })
      const allData = data.allData || []
      const found = allData.find(item => item.song?.id === props.track.id)
      playCount.value = found?.playCount || 0
    } catch (e) {
      console.error('Failed to fetch play count:', e)
      playCount.value = 0
    } finally {
      loadingPlayCount.value = false
    }
  }

  watch(
    () => props.visible,
    v => {
      if (v && props.track?.id) {
        fetchPlayCount()
      }
    }
  )

  function close() {
    emit('close')
  }

  useEscClose(() => props.visible, close)
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="track-detail-overlay" @click="close">
      <div class="track-detail-modal" @click.stop>
        <div class="track-detail-header">
          <div class="track-detail-title">歌曲详情</div>
          <button class="close-btn" aria-label="关闭" @click="close">
            <X :size="20" />
          </button>
        </div>

        <div class="track-detail-body">
          <img :src="coverUrl" :alt="track?.name" class="track-detail-cover" />
          <div class="track-detail-meta">
            <div class="track-detail-name">{{ track?.name || '未知歌曲' }}</div>
            <div class="track-detail-artist">{{ artistName }}</div>
            <div class="track-detail-album">专辑：{{ albumName }}</div>
          </div>
          <div class="track-detail-info">
            <div class="info-item">
              <span class="info-label">发行时间</span>
              <span class="info-value">
                {{ formatTime(track?.publishTime) }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">歌曲类型</span>
              <span class="info-value">{{ getFeeText(track?.fee) }}</span>
            </div>
            <div v-if="userStore.isLoggedIn" class="info-item">
              <span class="info-label">听歌次数</span>
              <span v-if="loadingPlayCount" class="info-value">
                <Loader2 class="spin" :size="14" />
              </span>
              <span v-else class="info-value">{{ playCount ?? '--' }} 次</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
  .track-detail-overlay {
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

  .track-detail-modal {
    width: 100%;
    max-width: 420px;
    max-height: 80vh;
    background: var(--color-modal-bg);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .track-detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-border-light);
  }

  .track-detail-title {
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

  .track-detail-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
  }

  .track-detail-cover {
    width: 160px;
    height: 160px;
    border-radius: var(--radius-lg);
    object-fit: cover;
    box-shadow: var(--shadow-lg);
    margin: 0 auto var(--spacing-lg);
    display: block;
  }

  .track-detail-meta {
    text-align: center;
    margin-bottom: var(--spacing-lg);
  }

  .track-detail-name {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: var(--spacing-xs);
  }

  .track-detail-artist {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin-bottom: 4px;
  }

  .track-detail-album {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .track-detail-info {
    width: 100%;
    padding: var(--spacing-md) 0;
    border-top: 1px solid var(--color-border-light);
    margin-top: var(--spacing-md);
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-xs) 0;
  }

  .info-label {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .info-value {
    font-size: 13px;
    color: var(--color-text-secondary);
  }
</style>
