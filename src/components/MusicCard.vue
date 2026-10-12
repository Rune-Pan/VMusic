<script setup>
  // 参考 YesPlayMusic Cover.vue + CoverRow.vue
  import { ref, computed } from 'vue'
  import { Play, Plus } from '@lucide/vue'
  import { useRouter } from 'vue-router'
  import { usePlayerStore } from '@/stores/player'
  import { useUserStore } from '@/stores/user'
  import { useUiStore } from '@/stores/ui'
  import { resizeImage } from '@/utils/common'
  import AddToPlaylistModal from '@/components/AddToPlaylistModal.vue'

  const props = defineProps({
    item: { type: Object, required: true },
    // 参考 YesPlayMusic Cover.type: 'playlist' 表示歌单，默认当作歌曲处理
    type: { type: String, default: 'track' }
  })

  const router = useRouter()
  const playerStore = usePlayerStore()
  const userStore = useUserStore()
  const uiStore = useUiStore()

  const showAddToPlaylistModal = ref(false)

  // 判断是否为歌单类型（歌单对象无 ar 字段，封面字段为 coverImgUrl 或 picUrl）
  const isPlaylist = computed(() => {
    if (props.type === 'playlist') return true
    const hasPlaylistCover = props.item.coverImgUrl || props.item.picUrl
    return hasPlaylistCover && !props.item.ar && !props.item.al
  })

  // 参考 YesPlayMusic resizeImage filter
  import { PLACEHOLDER_COVER_300, IMAGE_SIZE_CARD } from '@/constants'
  const PLACEHOLDER_IMG = PLACEHOLDER_COVER_300
  const coverUrl = computed(() => {
    const url =
      props.item.al?.picUrl || props.item.coverImgUrl || props.item.picUrl
    return url ? resizeImage(url, IMAGE_SIZE_CARD) : PLACEHOLDER_IMG
  })

  // 歌曲模式：名称、艺人
  const trackName = computed(() => props.item.name || '未知歌曲')
  const trackArtist = computed(
    () => props.item.ar?.map(a => a.name).join(', ') || '未知歌手'
  )

  // 歌单模式：名称、歌曲数
  const playlistName = computed(
    () => props.item.name || props.item.title || '未知歌单'
  )
  const playlistTrackCount = computed(
    () => props.item.trackCount || props.item.tracks?.length || 0
  )
  const playlistCreator = computed(
    () => props.item.creator?.nickname || props.item.creator?.userName || ''
  )

  // 点击行为
  function handleClick() {
    if (isPlaylist.value) {
      // 歌单模式：跳转到歌单详情页
      router.push({ name: 'playlist', params: { id: props.item.id } })
    } else {
      // 歌曲模式：跳转到播放页
      router.push({ name: 'player', params: { id: props.item.id } })
    }
  }

  function playTrack() {
    playerStore.play(props.item)
  }

  function addToPlaylist() {
    if (!userStore.isLoggedIn) {
      uiStore.showToast('请先登录', 'warning')
      return
    }
    if (isPlaylist.value) return
    showAddToPlaylistModal.value = true
  }
</script>

<template>
  <div class="music-card" @click="handleClick">
    <div class="cover-wrapper">
      <img
        :src="coverUrl"
        :alt="item.name"
        class="cover"
        loading="lazy"
        decoding="async"
      />
      <!-- 歌单模式：显示歌曲数 -->
      <div v-if="isPlaylist" class="playlist-badge">
        {{ playlistTrackCount }} 首
      </div>
      <div class="overlay">
        <button class="play-btn" @click.stop="playTrack">
          <Play :size="24" color="#ffffff" fill="#ffffff" />
        </button>
        <button v-if="!isPlaylist" class="add-btn" @click.stop="addToPlaylist">
          <Plus :size="18" color="#ffffff" />
        </button>
      </div>
    </div>
    <div class="info">
      <div class="name text-ellipsis">
        {{ isPlaylist ? playlistName : trackName }}
      </div>
      <div class="artist text-ellipsis">
        <template v-if="isPlaylist">
          {{ playlistCreator ? `by ${playlistCreator}` : '' }}
        </template>
        <template v-else>
          {{ trackArtist }}
        </template>
      </div>
    </div>
  </div>

  <AddToPlaylistModal
    :visible="showAddToPlaylistModal"
    :track="item"
    @close="showAddToPlaylistModal = false"
  />
</template>

<style scoped>
  .music-card {
    cursor: pointer;
    transition: transform var(--transition-base);
    overflow: hidden;
    min-width: 0;
  }

  .music-card:hover {
    transform: translateY(-4px);
  }

  .cover-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-md);
  }

  .cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .playlist-badge {
    position: absolute;
    bottom: 6px;
    right: 6px;
    padding: 2px 8px;
    background: rgba(0, 0, 0, 0.65);
    border-radius: var(--radius-full);
    font-size: 11px;
    color: #ffffff;
    z-index: 2;
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    opacity: 0;
    transition: opacity var(--transition-base);
    z-index: 1;
  }

  .cover-wrapper:hover .overlay {
    opacity: 1;
  }

  .play-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-lg);
    transform: scale(0.8);
    transition: transform var(--transition-base);
  }

  .cover-wrapper:hover .play-btn {
    transform: scale(1);
  }

  .play-btn:hover {
    background: var(--color-primary-hover);
  }

  .add-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .add-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .info {
    padding: var(--spacing-sm) 0;
    min-width: 0;
  }

  .name {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 2px;
  }

  .artist {
    font-size: 12px;
    color: var(--color-text-secondary);
  }
</style>
