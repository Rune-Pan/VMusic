<script setup>
  // 参考 YesPlayMusic src/views/playlist.vue
  import { ref, computed, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { Play, MessageSquareText, Share2 } from '@/components/icons'
  import { usePlayerStore } from '@/stores/player'
  import { useMusicStore } from '@/stores/music'
  import { useUserStore } from '@/stores/user'
  import { useUiStore } from '@/stores/ui'
  import { getPlaylistDetail } from '@/api/playlist'
  import { getTrackDetail } from '@/api/track'
  import { resizeImage } from '@/utils/common'
  import { cachePlaylistDetail } from '@/utils/db'
  import { IMAGE_SIZE_LARGE } from '@/constants'
  import TrackList from '@/components/TrackList.vue'
  import CommentModal from '@/components/CommentModal.vue'

  const route = useRoute()
  const playerStore = usePlayerStore()
  const musicStore = useMusicStore()
  const userStore = useUserStore()
  const uiStore = useUiStore()

  const playlist = ref(null)
  const showCommentModal = ref(false)
  const tracks = ref([])
  const loading = ref(true)
  const hasMore = ref(false)
  const loadingMore = ref(false)
  let lastLoadedTrackIndex = 0

  const coverUrl = computed(() =>
    resizeImage(playlist.value?.coverImgUrl, IMAGE_SIZE_LARGE)
  )
  const isUserOwnPlaylist = computed(() => {
    return playlist.value?.creator?.userId === userStore.userInfo.id
  })

  // 参考 YesPlayMusic loadData
  // 缓存由 api 层 getPlaylistDetail 的 SWR + IDB 承担（见 src/utils/db.js）
  async function loadData(id) {
    loading.value = true
    try {
      const data = await getPlaylistDetail(id)
      playlist.value = data.playlist
      tracks.value = data.playlist.tracks || []
      lastLoadedTrackIndex = tracks.value.length - 1
      // 参考 YesPlayMusic：如果歌曲未完全加载，继续加载更多
      if (playlist.value.trackCount > tracks.value.length) {
        loadingMore.value = true
        await loadMore()
      }
    } catch (e) {
      console.error('Failed to load playlist:', e)
    }
    loading.value = false
  }

  // 参考 YesPlayMusic loadMore
  async function loadMore(loadNum = 100) {
    if (!playlist.value?.trackIds) return
    const trackIDs = playlist.value.trackIds
      .filter(
        (_t, index) =>
          index > lastLoadedTrackIndex &&
          index <= lastLoadedTrackIndex + loadNum
      )
      .map(t => t.id)
    if (trackIDs.length === 0) {
      hasMore.value = false
      loadingMore.value = false
      return
    }
    try {
      const data = await getTrackDetail(trackIDs.join(','))
      tracks.value.push(...(data.songs || []))
      lastLoadedTrackIndex += trackIDs.length
      hasMore.value = lastLoadedTrackIndex + 1 < playlist.value.trackIds.length
    } catch (e) {
      console.error('Failed to load more tracks:', e)
    }
    loadingMore.value = false
  }

  function playAll() {
    if (tracks.value.length > 0) {
      playerStore.setPlaylist(tracks.value, 0)
    }
  }

  function openComments() {
    if (!playlist.value) return
    showCommentModal.value = true
  }

  function handleRemoveTrack(track) {
    musicStore.removeTrackFromPlaylist(playlist.value.id, track.id)
    tracks.value = tracks.value.filter(t => t.id !== track.id)
    // 同步 IDB 缓存，避免返回后仍显示已删除歌曲
    cachePlaylistDetail(
      playlist.value.id,
      playlist.value,
      tracks.value,
      playlist.value.subscribed || false
    ).catch(() => {})
  }

  async function sharePlaylist() {
    if (!playlist.value) return
    const url = `https://music.163.com/#/playlist?id=${playlist.value.id}`
    try {
      await navigator.clipboard.writeText(url)
      uiStore.showToast('链接已复制', 'success')
    } catch {
      uiStore.showToast('复制失败', 'error')
    }
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
  <div class="playlist-view">
    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="skeleton-cover"></div>
      <div class="skeleton-lines">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line medium"></div>
      </div>
    </div>

    <div v-else-if="playlist" class="content-wrapper">
      <!-- 歌单信息区 - 参考 YesPlayMusic playlist-info -->
      <div class="playlist-info">
        <div class="cover-wrapper">
          <img :src="coverUrl" :alt="playlist.name" class="cover" />
        </div>
        <div class="info">
          <h1 class="title">{{ playlist.name }}</h1>
          <div class="creator" v-if="playlist.creator">
            创建者：
            <span class="creator-name">{{ playlist.creator.nickname }}</span>
          </div>
          <div class="meta">
            <span>{{ playlist.trackCount }} 首歌曲</span>
            <span v-if="playlist.playCount">
              · 播放 {{ playlist.playCount }}
            </span>
          </div>
          <div class="description" v-if="playlist.description">
            {{ playlist.description }}
          </div>
          <div class="buttons">
            <button class="play-all-btn" @click="playAll">
              <Play :size="20" />
              <span>播放全部</span>
            </button>
            <button class="action-btn" @click="openComments">
              <MessageSquareText :size="16" />
              <span>评论</span>
            </button>
            <button class="action-btn" @click="sharePlaylist">
              <Share2 :size="16" />
              <span>分享</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 歌曲列表 - 参考 YesPlayMusic TrackList -->
      <div class="tracks-section">
        <h2 class="section-title">歌曲列表</h2>
        <TrackList
          :tracks="tracks"
          :show-remove="isUserOwnPlaylist"
          @remove="handleRemoveTrack"
        />
        <div v-if="tracks.length === 0" class="empty-state">暂无歌曲</div>
      </div>

      <!-- 加载更多 - 参考 YesPlayMusic load-more -->
      <div v-if="hasMore" class="load-more">
        <button
          class="load-more-btn"
          :disabled="loadingMore"
          @click="loadMore(100)"
        >
          {{ loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>歌单不存在</p>
    </div>

    <CommentModal
      :visible="showCommentModal"
      type="playlist"
      :id="playlist?.id"
      :title="playlist?.name"
      @close="showCommentModal = false"
    />
  </div>
</template>

<style scoped>
  .playlist-view {
    min-height: calc(100vh - var(--navbar-height));
  }
  .content-wrapper {
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: var(--spacing-2xl) var(--spacing-xl);
  }

  /* 参考 YesPlayMusic playlist-info 布局 */
  .playlist-info {
    display: flex;
    gap: var(--spacing-2xl);
    margin-bottom: var(--spacing-2xl);
    align-items: flex-start;
  }
  .cover-wrapper {
    flex-shrink: 0;
  }
  .cover {
    width: 240px;
    height: 240px;
    border-radius: var(--radius-xl);
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
  .creator {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-xs);
  }
  .creator-name {
    font-weight: 600;
    color: var(--color-text);
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
  .action-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .tracks-section {
    margin-top: var(--spacing-xl);
  }
  .section-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: var(--spacing-md);
  }

  .load-more {
    display: flex;
    justify-content: center;
    padding: var(--spacing-xl);
  }
  .load-more-btn {
    padding: var(--spacing-sm) var(--spacing-2xl);
    background: var(--color-secondary-bg);
    color: var(--color-text-secondary);
    border-radius: var(--radius-full);
    font-size: 14px;
    transition: all var(--transition-fast);
  }
  .load-more-btn:hover:not(:disabled) {
    background: var(--color-secondary-bg-hover);
    color: var(--color-text);
  }
  .load-more-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* Loading skeleton */
  .loading-state {
    display: flex;
    gap: var(--spacing-2xl);
    padding: var(--spacing-2xl) var(--spacing-xl);
    max-width: var(--content-max-width);
    margin: 0 auto;
  }
  .skeleton-cover {
    width: 240px;
    height: 240px;
    border-radius: var(--radius-xl);
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
</style>
