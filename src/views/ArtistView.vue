<script setup>
  import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
  import { useRoute } from 'vue-router'
  import { Play, Share2, Loader2 } from '@/components/icons'
  import { usePlayerStore } from '@/stores/player'
  import { useUiStore } from '@/stores/ui'
  import {
    getArtistDetail,
    getArtistAlbums,
    getArtistSongs
  } from '@/api/artist'
  import { resizeImage } from '@/utils/common'
  import { getPageScrollContainer } from '@/utils/pageScroll'
  import { IMAGE_SIZE_LARGE, PLACEHOLDER_COVER_300 } from '@/constants'
  import TrackList from '@/components/TrackList.vue'

  const route = useRoute()
  const playerStore = usePlayerStore()
  const uiStore = useUiStore()

  const artist = ref(null)
  const hotSongs = ref([]) // 精选热门 50，仅供「播放热门」按钮
  const allSongs = ref([]) // 全部歌曲（分页加载）
  const totalSongs = ref(null) // null = 总数未知
  const hasMoreSongs = ref(false)
  const loadingMoreSongs = ref(false)
  const songsOffset = ref(0)
  const desc = ref('')
  const albums = ref([])
  const totalAlbums = ref(null) // null = 总数未知（API 未返 total 且未到末页）
  const loading = ref(true)
  const hasMoreAlbums = ref(false)
  const albumsError = ref(false) // 专辑加载失败：替代静默 console.error，提供重试
  const loadingMoreAlbums = ref(false)
  const albumsOffset = ref(0)
  const activeTab = ref('songs')
  const ALBUM_PAGE_SIZE = 12
  const SONG_PAGE_SIZE = 50
  // 滚动触底预载高度：sentinel 距视口底此距离即触发加载（约半屏，页面级平滑预载）
  const ALBUM_LOAD_ROOT_MARGIN = '400px'

  // 专辑计数文案：总数已知显总数，否则显已加载 + '?'
  const albumCountLabel = computed(() => {
    if (totalAlbums.value != null) return String(totalAlbums.value)
    return `${albums.value.length}${hasMoreAlbums.value ? '+' : ''}`
  })

  // 歌曲计数文案：同上逻辑
  const songCountLabel = computed(() => {
    if (totalSongs.value != null) return String(totalSongs.value)
    return `${allSongs.value.length}${hasMoreSongs.value ? '+' : ''}`
  })

  const coverUrl = computed(() => {
    const raw = artist.value?.picUrl || artist.value?.img1v1Url || ''
    return raw ? resizeImage(raw, IMAGE_SIZE_LARGE) : PLACEHOLDER_COVER_300
  })

  async function loadData(id) {
    loading.value = true
    try {
      const data = await getArtistDetail(id)
      artist.value = data.artist
      hotSongs.value = data.hotSongs
      desc.value = data.desc
      albums.value = []
      // 总数主源：artist.albumSize（/artists 响应自带，首屏即得）
      totalAlbums.value =
        typeof data.artist?.albumSize === 'number'
          ? data.artist.albumSize
          : null
      albumsOffset.value = 0
      albumsError.value = false
      allSongs.value = []
      totalSongs.value = null
      hasMoreSongs.value = false
      songsOffset.value = 0
      activeTab.value = 'songs'
      // 歌曲为默认 tab，与专辑首页并行拉取
      await Promise.all([loadMoreAlbums(id), loadMoreSongs(id)])
    } catch (e) {
      console.error('Failed to load artist:', e)
    }
    loading.value = false
  }

  async function loadMoreAlbums(id = route.params.id) {
    if (loadingMoreAlbums.value) return
    loadingMoreAlbums.value = true
    try {
      const data = await getArtistAlbums(id, {
        limit: ALBUM_PAGE_SIZE,
        offset: albumsOffset.value
      })
      const list = data.hotAlbums || []
      albums.value.push(...list)
      albumsOffset.value += list.length
      hasMoreAlbums.value = !!data.more
      // 总数兜底：albumSize 缺失时才用分页端点的 total，末页再用已加载数
      if (totalAlbums.value == null) {
        if (typeof data.total === 'number') {
          totalAlbums.value = data.total
        } else if (!data.more) {
          totalAlbums.value = albums.value.length
        }
      }
      albumsError.value = false
    } catch (e) {
      console.error('Failed to load artist albums:', e)
      albumsError.value = true
      // ponytail: 拉掉 hasMore 停掉 observer，避免触底死循环重试；retry 成功后由 data.more 重新置位
      hasMoreAlbums.value = false
    }
    loadingMoreAlbums.value = false
  }

  async function loadMoreSongs(id = route.params.id) {
    if (loadingMoreSongs.value) return
    loadingMoreSongs.value = true
    try {
      const data = await getArtistSongs(id, {
        limit: SONG_PAGE_SIZE,
        offset: songsOffset.value,
        order: 'hot'
      })
      const list = data.songs || []
      allSongs.value.push(...list)
      songsOffset.value += list.length
      hasMoreSongs.value = !!data.more
      // 总数兜底：端点 total 优先，末页再用已加载数
      if (totalSongs.value == null) {
        if (typeof data.total === 'number') {
          totalSongs.value = data.total
        } else if (!data.more) {
          totalSongs.value = allSongs.value.length
        }
      }
    } catch (e) {
      console.error('Failed to load artist songs:', e)
    }
    loadingMoreSongs.value = false
  }

  // 滚动触底自动加载哨兵（镜像 CommentModal 模式）
  // 使用正文滚动区域；rootMargin 由 ALBUM_LOAD_ROOT_MARGIN 控制
  const songSentinel = ref(null)
  const albumSentinel = ref(null)
  let songObserver = null
  let albumObserver = null

  // 通用观察器：sentinel 进入视口且 hasMore 且非加载中 → loadFn()
  // 加载后若仍有更多则重连哨兵强制重判：IO 仅在 crossing 时触发，
  // 加载后哨兵可能仍在 margin 内不会自动重触发（否则需上下滚动才继续加载）
  function makeObserver(loadFn, hasMoreRef, loadingMoreRef, getSentinel) {
    const observer = new IntersectionObserver(
      async entries => {
        if (
          entries[0].isIntersecting &&
          hasMoreRef.value &&
          !loadingMoreRef.value
        ) {
          await loadFn()
          // 重连：observe() 会以当前相交状态异步再触发一次回调，哨兵仍在 margin 内即继续预载
          if (hasMoreRef.value && !loadingMoreRef.value && getSentinel()) {
            observer.disconnect()
            observer.observe(getSentinel())
          }
        }
      },
      {
        root: getPageScrollContainer(),
        rootMargin: ALBUM_LOAD_ROOT_MARGIN
      }
    )
    return observer
  }

  function setupSongObserver() {
    if (songObserver || !songSentinel.value || !hasMoreSongs.value) return
    songObserver = makeObserver(
      loadMoreSongs,
      hasMoreSongs,
      loadingMoreSongs,
      () => songSentinel.value
    )
    songObserver.observe(songSentinel.value)
  }
  function teardownSongObserver() {
    if (songObserver) {
      songObserver.disconnect()
      songObserver = null
    }
  }
  function setupAlbumObserver() {
    if (albumObserver || !albumSentinel.value || !hasMoreAlbums.value) return
    albumObserver = makeObserver(
      loadMoreAlbums,
      hasMoreAlbums,
      loadingMoreAlbums,
      () => albumSentinel.value
    )
    albumObserver.observe(albumSentinel.value)
  }
  function teardownAlbumObserver() {
    if (albumObserver) {
      albumObserver.disconnect()
      albumObserver = null
    }
  }

  // tab 激活且还有更多时建观察器；切走或耗尽时拆
  // loading 入依赖：hasMore 在 loading=true 期间变化，nextTick 时 sentinel 尚未渲染，
  // 需等 loading=false 重新触发 setup（否则默认 songs tab 观察器挂不上 → 滚动不加载）
  watch([activeTab, hasMoreSongs, loading], () => {
    nextTick(() => {
      if (
        activeTab.value === 'songs' &&
        hasMoreSongs.value &&
        songSentinel.value
      ) {
        setupSongObserver()
      } else {
        teardownSongObserver()
      }
    })
  })
  watch([activeTab, hasMoreAlbums, loading], () => {
    nextTick(() => {
      if (
        activeTab.value === 'albums' &&
        hasMoreAlbums.value &&
        albumSentinel.value
      ) {
        setupAlbumObserver()
      } else {
        teardownAlbumObserver()
      }
    })
  })

  onUnmounted(() => {
    teardownSongObserver()
    teardownAlbumObserver()
  })

  function playAll() {
    if (hotSongs.value.length > 0) {
      playerStore.setPlaylist(hotSongs.value, 0)
    }
  }

  async function shareArtist() {
    if (!artist.value) return
    const url = `https://music.163.com/#/artist?id=${artist.value.id}`
    try {
      await navigator.clipboard.writeText(url)
      uiStore.showToast('链接已复制', 'success')
    } catch {
      uiStore.showToast('复制失败', 'error')
    }
  }

  function albumYear(album) {
    if (!album.publishTime) return ''
    const y = new Date(album.publishTime).getFullYear()
    return isNaN(y) ? '' : String(y)
  }

  function albumCover(album) {
    const raw = album.picUrl || album.blurPicUrl || ''
    return raw ? resizeImage(raw, IMAGE_SIZE_LARGE) : PLACEHOLDER_COVER_300
  }

  watch(
    () => route.params.id,
    newId => {
      if (newId) loadData(newId)
    },
    { immediate: true }
  )
</script>

<template>
  <div class="artist-view">
    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="skeleton-cover"></div>
      <div class="skeleton-lines">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line medium"></div>
      </div>
    </div>

    <div v-else-if="artist" class="content-wrapper">
      <!-- 歌手信息区 -->
      <div class="artist-info">
        <div class="cover-wrapper">
          <img :src="coverUrl" :alt="artist.name" class="cover" />
        </div>
        <div class="info">
          <h1 class="title">{{ artist.name }}</h1>
          <div class="meta">
            <span>{{ songCountLabel }} 首歌曲</span>
            <span v-if="albums.length">· {{ albumCountLabel }} 张专辑</span>
          </div>
          <div class="description" v-if="desc">{{ desc }}</div>
          <div class="buttons">
            <button class="play-all-btn" @click="playAll">
              <Play :size="20" />
              <span>播放热门</span>
            </button>
            <button class="action-btn" @click="shareArtist">
              <Share2 :size="16" />
              <span>分享</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 标签页：全部歌曲 / 专辑 -->
      <div class="tab-bar">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'songs' }"
          @click="activeTab = 'songs'"
        >
          全部歌曲
          <span v-if="allSongs.length > 0" class="tab-count">
            {{ songCountLabel }}
          </span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'albums' }"
          @click="activeTab = 'albums'"
        >
          专辑
          <span v-if="albums.length > 0" class="tab-count">
            {{ albumCountLabel }}
          </span>
        </button>
      </div>

      <div class="tab-content">
        <!-- 全部歌曲（分页加载） -->
        <div v-if="activeTab === 'songs'" class="tracks-section">
          <TrackList :tracks="allSongs" />
          <div v-if="allSongs.length === 0" class="empty-state">暂无歌曲</div>
          <!-- 滚动触底哨兵：进入视口自动 loadMoreSongs -->
          <div v-if="hasMoreSongs" ref="songSentinel" class="load-sentinel">
            <Loader2 v-if="loadingMoreSongs" class="spin" :size="22" />
          </div>
          <!-- 到底提示：镜像 CommentModal .no-more 模式 -->
          <div
            v-else-if="allSongs.length > 0"
            class="no-more"
            aria-live="polite"
          >
            没有更多歌曲了
          </div>
        </div>

        <!-- 专辑详情入口 -->
        <div v-if="activeTab === 'albums'" class="albums-section">
          <div class="albums-grid">
            <RouterLink
              v-for="album in albums"
              :key="album.id"
              class="album-card"
              :aria-label="album.name"
              :to="{ name: 'album', params: { id: album.id } }"
            >
              <div class="album-cover-wrapper">
                <img
                  :src="albumCover(album)"
                  :alt="album.name"
                  class="album-cover"
                  loading="lazy"
                />
              </div>
              <div class="album-name text-ellipsis">{{ album.name }}</div>
              <div class="album-year text-ellipsis">{{ albumYear(album) }}</div>
            </RouterLink>
          </div>
          <div
            v-if="albumsError"
            class="load-error"
            role="alert"
            @click="loadMoreAlbums()"
          >
            <Loader2 v-if="loadingMoreAlbums" class="spin" :size="16" />
            <span>
              {{ loadingMoreAlbums ? '重试中…' : '加载失败，点击重试' }}
            </span>
          </div>
          <div v-else-if="albums.length === 0" class="empty-state">
            暂无专辑
          </div>
          <!-- 滚动触底哨兵：进入视口自动 loadMoreAlbums -->
          <div
            v-else-if="hasMoreAlbums"
            ref="albumSentinel"
            class="load-sentinel"
          >
            <Loader2 v-if="loadingMoreAlbums" class="spin" :size="22" />
          </div>
          <!-- 到底提示：镜像 CommentModal .no-more 模式 -->
          <div v-else class="no-more" aria-live="polite">没有更多专辑了</div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>歌手不存在</p>
    </div>
  </div>
</template>

<style scoped>
  .artist-view {
    min-height: calc(100vh - var(--navbar-height));
  }
  .content-wrapper {
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: var(--spacing-2xl) var(--spacing-xl);
  }

  .artist-info {
    display: flex;
    gap: var(--spacing-2xl);
    margin-bottom: var(--spacing-2xl);
    align-items: flex-start;
  }
  .cover-wrapper {
    flex-shrink: 0;
  }
  .cover {
    width: 220px;
    height: 220px;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: var(--shadow-lg);
  }
  .info {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: var(--spacing-sm);
  }
  .meta {
    font-size: 13px;
    color: var(--color-text-muted);
    margin-bottom: var(--spacing-md);
  }
  .description {
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.6;
    margin-bottom: var(--spacing-md);
    white-space: pre-line;
  }
  .buttons {
    display: flex;
    gap: var(--spacing-sm);
  }
  .play-all-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-xl);
    background: var(--color-primary);
    color: #ffffff;
    border-radius: var(--radius-full);
    font-size: 14px;
    font-weight: 600;
    transition: background var(--transition-fast);
  }
  .play-all-btn:hover {
    background: var(--color-primary-hover);
  }
  .action-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-xl);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    border-radius: var(--radius-full);
    font-size: 14px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }
  .action-btn:hover:not(:disabled) {
    border-color: var(--color-text);
    color: var(--color-text);
  }

  .tab-bar {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-xl);
    margin-bottom: var(--spacing-lg);
    border-bottom: 1px solid var(--color-border-light);
    padding-bottom: var(--spacing-sm);
  }
  .tab-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 15px;
    font-weight: 500;
    color: var(--color-text-secondary);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    transition: all var(--transition-fast);
  }
  .tab-btn:hover {
    color: var(--color-text);
    background: var(--color-secondary-bg-hover);
  }
  .tab-btn.active {
    color: var(--color-primary);
    font-weight: 600;
  }
  .tab-count {
    font-size: 12px;
    padding: 2px 6px;
    background: var(--color-secondary-bg);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
  }
  .tab-btn.active .tab-count {
    background: var(--color-primary-bg-transparent);
    color: var(--color-primary);
  }

  .tab-content {
    min-height: 300px;
  }

  .tracks-section {
    margin-top: 0;
  }

  .albums-section {
    margin-top: 0;
  }
  .albums-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--spacing-lg);
  }
  .album-card {
    display: block;
    cursor: pointer;
    outline-offset: 4px;
  }
  .album-cover-wrapper {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-secondary-bg);
  }
  .album-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .album-name {
    margin-top: var(--spacing-xs);
    font-size: 14px;
    color: var(--color-text);
  }
  .album-year {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .load-sentinel {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl);
    color: var(--color-text-muted);
  }
  .no-more {
    text-align: center;
    padding: var(--spacing-md) 0;
    font-size: 13px;
    color: var(--color-text-muted);
  }
  .load-error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-md) 0;
    font-size: 13px;
    color: var(--color-error);
    cursor: pointer;
  }
  .load-error:hover {
    text-decoration: underline;
  }
  .spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-state {
    display: flex;
    gap: var(--spacing-2xl);
    padding: var(--spacing-2xl) var(--spacing-xl);
    max-width: var(--content-max-width);
    margin: 0 auto;
  }
  .skeleton-cover {
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: var(--color-secondary-bg);
    animation: pulse 1.5s ease-in-out infinite;
    flex-shrink: 0;
  }
  .skeleton-lines {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding-top: var(--spacing-lg);
  }
  .skeleton-line {
    height: 16px;
    border-radius: var(--radius-sm);
    background: var(--color-secondary-bg);
    animation: pulse 1.5s ease-in-out infinite;
  }
  .skeleton-line.short {
    width: 40%;
  }
  .skeleton-line.medium {
    width: 70%;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .empty-state {
    display: flex;
    justify-content: center;
    padding: var(--spacing-3xl);
    color: var(--color-text-muted);
    font-size: 15px;
  }

  .text-ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
