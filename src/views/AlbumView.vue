<script setup>
  import { computed, onUnmounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ArrowLeft, Play } from '@/components/icons'
  import TrackList from '@/components/TrackList.vue'
  import { getAlbumDetail } from '@/api/album'
  import { usePlayerStore } from '@/stores/player'
  import { useUiStore } from '@/stores/ui'
  import { resizeImage } from '@/utils/common'
  import { IMAGE_SIZE_LARGE, PLACEHOLDER_COVER_300 } from '@/constants'

  const route = useRoute()
  const router = useRouter()
  const player = usePlayerStore()
  const ui = useUiStore()
  const album = ref(null)
  const tracks = ref([])
  const loading = ref(true)
  const error = ref('')
  const expanded = ref(false)
  const coverFailed = ref(false)
  let generation = 0

  const cover = computed(() =>
    !coverFailed.value && album.value?.picUrl
      ? resizeImage(album.value.picUrl, IMAGE_SIZE_LARGE)
      : PLACEHOLDER_COVER_300
  )
  const artists = computed(() =>
    album.value?.artists?.length
      ? album.value.artists
      : album.value?.artist
        ? [album.value.artist]
        : []
  )
  const publishDate = computed(() => {
    if (!album.value?.publishTime) return ''
    const date = new Date(album.value.publishTime)
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN')
  })

  async function loadAlbum(id) {
    const token = ++generation
    loading.value = true
    error.value = ''
    album.value = null
    tracks.value = []
    expanded.value = false
    coverFailed.value = false
    try {
      const data = await getAlbumDetail(id)
      if (token !== generation) return
      album.value = data.album
      tracks.value = data.songs
    } catch (e) {
      if (token === generation)
        error.value = e.message || '专辑加载失败，请重试'
    } finally {
      if (token === generation) loading.value = false
    }
  }

  function playAll() {
    const index = tracks.value.findIndex(track => track.playable !== false)
    if (index < 0) {
      ui.showToast('这张专辑暂无可播放的曲目', 'warning')
      return
    }
    player.setPlaylist(tracks.value, index)
  }

  function goBack() {
    if (router.options.history.state.back) router.back()
    else router.push({ name: 'home' })
  }

  watch(() => route.params.id, loadAlbum, { immediate: true })
  onUnmounted(() => {
    generation++
  })
</script>

<template>
  <div class="album-view content-wrapper">
    <button class="back-btn" @click="goBack">
      <ArrowLeft :size="18" />
      返回
    </button>
    <div
      v-if="loading"
      class="loading-state"
      role="status"
      aria-label="正在加载专辑"
    >
      <div class="skeleton-cover"></div>
      <div class="skeleton-lines">
        <div v-for="i in 4" :key="i" class="skeleton-line"></div>
      </div>
    </div>
    <template v-else-if="album">
      <div class="album-info">
        <img
          class="cover"
          :src="cover"
          :alt="album.name"
          @error="coverFailed = true"
        />
        <div class="info">
          <h1 class="title">{{ album.name }}</h1>
          <div class="artists">
            <template
              v-for="(artist, index) in artists"
              :key="artist.id || index"
            >
              <span v-if="index" aria-hidden="true">/</span>
              <RouterLink
                v-if="artist.id"
                :to="{ name: 'artist', params: { id: artist.id } }"
              >
                {{ artist.name }}
              </RouterLink>
              <span v-else>{{ artist.name }}</span>
            </template>
            <span v-if="!artists.length">未知歌手</span>
          </div>
          <p class="meta">
            <span v-if="publishDate">{{ publishDate }} 发行 ·</span>
            {{ tracks.length }} 首歌曲
          </p>
          <div v-if="album.description" class="description-area">
            <p
              id="album-description"
              class="description"
              :class="{ collapsed: !expanded }"
            >
              {{ album.description }}
            </p>
            <button
              class="description-toggle"
              :aria-expanded="expanded"
              aria-controls="album-description"
              @click="expanded = !expanded"
            >
              {{ expanded ? '收起简介' : '展开简介' }}
            </button>
          </div>
          <p v-else class="description">暂无专辑简介</p>
          <button
            class="play-all-btn"
            :disabled="!tracks.length"
            @click="playAll"
          >
            <Play :size="18" />
            播放全部
          </button>
        </div>
      </div>
      <section class="tracks-section" aria-labelledby="album-tracks-title">
        <h2 id="album-tracks-title">歌曲列表</h2>
        <TrackList :tracks="tracks" />
      </section>
    </template>
    <div v-else class="error-state">
      <p role="alert">{{ error }}</p>
      <button class="retry-btn" @click="loadAlbum(route.params.id)">
        重新加载
      </button>
    </div>
  </div>
</template>

<style scoped>
  .content-wrapper {
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-2xl);
  }
  .back-btn,
  .play-all-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    min-height: 44px;
    border-radius: var(--radius-full);
  }
  .back-btn {
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-lg);
    padding: 0 var(--spacing-sm);
  }
  .back-btn:hover,
  .description-toggle:hover {
    color: var(--color-text);
  }
  .album-info,
  .loading-state {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-2xl);
  }
  .cover,
  .skeleton-cover {
    width: 240px;
    height: 240px;
    flex-shrink: 0;
    border-radius: var(--radius-xl);
    object-fit: cover;
  }
  .cover {
    box-shadow: var(--shadow-lg);
  }
  .info {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
    margin-bottom: var(--spacing-sm);
  }
  .artists {
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-xs);
  }
  .artists a:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .meta {
    color: var(--color-text-muted);
    font-size: 13px;
    margin-bottom: var(--spacing-md);
  }
  .description {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--color-text-secondary);
    font-size: 13px;
    line-height: 1.6;
    max-width: 70ch;
  }
  .description.collapsed {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .description-toggle {
    color: var(--color-accent-ink);
    min-height: 36px;
    font-size: 13px;
  }
  .play-all-btn {
    margin-top: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-xl);
    color: #f8fafc;
    background: var(--color-action-bg);
    font-weight: 600;
  }
  .play-all-btn:hover:not(:disabled) {
    background: var(--color-action-hover);
  }
  .play-all-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .tracks-section {
    margin-top: var(--spacing-2xl);
  }
  .tracks-section h2 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: var(--spacing-md);
  }
  .error-state {
    text-align: center;
    color: var(--color-text-secondary);
    padding: var(--spacing-3xl) 0;
  }
  .retry-btn {
    min-height: 44px;
    padding: var(--spacing-sm) var(--spacing-xl);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    margin-top: var(--spacing-md);
  }
  .skeleton-cover,
  .skeleton-line {
    background: var(--color-secondary-bg);
  }
  .skeleton-lines {
    flex: 1;
    padding-top: var(--spacing-lg);
  }
  .skeleton-line {
    height: 20px;
    margin-bottom: var(--spacing-md);
    border-radius: var(--radius-sm);
  }
  .skeleton-line:nth-child(even) {
    width: 65%;
  }
  @media (max-width: 900px) {
    .album-info,
    .loading-state {
      gap: var(--spacing-lg);
    }
    .cover,
    .skeleton-cover {
      width: 180px;
      height: 180px;
    }
    .title {
      font-size: 24px;
    }
  }
  @media (max-width: 600px) {
    .album-info,
    .loading-state {
      flex-direction: column;
    }
    .info {
      width: 100%;
    }
  }
</style>
