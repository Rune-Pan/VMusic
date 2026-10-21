<script setup>
  // 参考 YesPlayMusic src/views/playlist.vue
  import { ref, computed, watch, onUnmounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { Play, MessageSquareText, Share2 } from '@/components/icons'
  import { usePlayerStore } from '@/stores/player'
  import { useMusicStore } from '@/stores/music'
  import { useUserStore } from '@/stores/user'
  import { useUiStore } from '@/stores/ui'
  import { getPlaylistDetail } from '@/api/playlist'
  import { getTrackDetail } from '@/api/track'
  import { resizeImage } from '@/utils/common'
  import { IMAGE_SIZE_LARGE } from '@/constants'
  import TrackList from '@/components/TrackList.vue'
  import CommentModal from '@/components/CommentModal.vue'
  import PlaylistFormModal from '@/components/PlaylistFormModal.vue'

  const route = useRoute()
  const router = useRouter()
  const playerStore = usePlayerStore()
  const musicStore = useMusicStore()
  const userStore = useUserStore()
  const uiStore = useUiStore()

  const playlist = ref(null)
  const local = computed(() => route.meta.localPlaylist === true)
  const editing = ref(false)
  const mutating = ref(false)
  const loadError = ref('')
  let loadGeneration = 0
  const showCommentModal = ref(false)
  const tracks = ref([])
  const loading = ref(true)
  const hasMore = ref(false)
  const loadingMore = ref(false)
  let lastLoadedTrackIndex = 0

  const coverUrl = computed(() =>
    resizeImage(playlist.value?.coverImgUrl || playlist.value?.coverUrl, IMAGE_SIZE_LARGE)
  )
  const isUserOwnPlaylist = computed(() => {
    return !local.value && playlist.value?.creator && String(playlist.value.creator.userId) === String(userStore.userInfo.id)
  })

  // 参考 YesPlayMusic loadData
  const canManage = computed(() => isUserOwnPlaylist.value && playlist.value?.specialType !== 5)

  // 缓存由 api 层 getPlaylistDetail 的 SWR + IDB 承担（见 src/utils/db.js）
  async function loadData(id, force = false) {
    const token = ++loadGeneration
    loading.value = true
    loadError.value = ''
    hasMore.value = false
    playlist.value = null
    tracks.value = []
    try {
      const data = local.value
        ? { playlist: musicStore.userPlaylists.find(p => String(p.id) === String(id)) }
        : await getPlaylistDetail(id, force)
      if (token !== loadGeneration) return
      if (!data.playlist) throw new Error('歌单不存在或暂时不可访问')
      playlist.value = data.playlist
      tracks.value = data.playlist.tracks || []
      lastLoadedTrackIndex = tracks.value.length - 1
      if (!local.value && data.playlist.trackCount > tracks.value.length) {
        await loadMore()
      }
    } catch (e) {
      if (token === loadGeneration) loadError.value = e.message || '歌单加载失败，请重试'
    } finally {
      if (token === loadGeneration) loading.value = false
    }
  }

  // 参考 YesPlayMusic loadMore
  async function loadMore(loadNum = 100) {
    if (!playlist.value?.trackIds || loadingMore.value) return
    const token = loadGeneration
    loadingMore.value = true
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
      if (token !== loadGeneration) return
      tracks.value.push(...(data.songs || []))
      lastLoadedTrackIndex += trackIDs.length
      hasMore.value = lastLoadedTrackIndex + 1 < playlist.value.trackIds.length
    } catch {
      if (token === loadGeneration) {
        hasMore.value = true
        uiStore.showToast('曲目加载失败，可点击加载更多重试', 'error')
      }
    }
    if (token === loadGeneration) loadingMore.value = false
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

  async function handleRemoveTrack(track) {
    if (!canManage.value || mutating.value) return
    const id = playlist.value.id
    const confirmed = await uiStore.showConfirm({ title: '从网易云歌单移除', message: `确定将「${track.name}」从这个云歌单移除？`, confirmText: '移除' })
    if (!confirmed) return
    await mutate(() => musicStore.changePlaylistTracks(id, [track.id], 'del'))
  }

  async function mutate(write, deleted = false) {
    if (mutating.value) return
    const id = playlist.value.id
    const token = loadGeneration
    const uid = userStore.userInfo.id
    mutating.value = true
    try {
      await write()
      if (token !== loadGeneration || uid !== userStore.userInfo.id) return
      uiStore.showToast('网易云歌单已更新', 'success')
      if (deleted) await router.push({ name: 'profile' })
      else await loadData(id, true)
    } catch (e) {
      if (token === loadGeneration && uid === userStore.userInfo.id) uiStore.showToast(e.message || '操作失败，请重试', 'error')
    } finally { mutating.value = false }
  }

  async function deletePlaylist() {
    if (!canManage.value || mutating.value) return
    const id = playlist.value.id
    const confirmed = await uiStore.showConfirm({ title: '删除网易云歌单', message: `确定删除「${playlist.value.name}」？此操作将删除云端歌单。`, confirmText: '删除歌单' })
    if (confirmed) await mutate(() => musicStore.deletePlaylist(id), true)
  }

  async function toggleSubscribed() {
    if (local.value || isUserOwnPlaylist.value || mutating.value) return
    const id = playlist.value.id
    const subscribed = !playlist.value.subscribed
    if (!subscribed && !await uiStore.showConfirm({ title: '取消收藏', message: `取消收藏「${playlist.value.name}」？`, confirmText: '取消收藏' })) return
    await mutate(() => musicStore.setPlaylistSubscribed(id, subscribed))
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
    () => musicStore.playlistChanges[route.params.id],
    () => {
      if (!local.value && !mutating.value && playlist.value) loadData(route.params.id, true)
    }
  )
  watch(
    () => [route.name, route.params.id],
    ([, newId]) => {
      loadingMore.value = false
      if (newId) loadData(newId)
    },
    { immediate: true }
  )
  onUnmounted(() => { loadGeneration++ })
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
            <span>{{ local ? tracks.length : playlist.trackCount }} 首歌曲</span>
            <span v-if="playlist.playCount">
              · 播放 {{ playlist.playCount }}
            </span>
          </div>
          <div class="description" v-if="playlist.description">
            {{ playlist.description }}
          </div>
          <p v-if="local" class="description">本机历史歌单 · 只读，不会自动上传网易云。</p>
          <div class="buttons" :aria-busy="mutating">
            <button class="play-all-btn" @click="playAll">
              <Play :size="20" />
              <span>播放全部</span>
            </button>
            <button v-if="!local" class="action-btn" @click="openComments">
              <MessageSquareText :size="16" />
              <span>评论</span>
            </button>
            <button v-if="!local" class="action-btn" @click="sharePlaylist">
              <Share2 :size="16" />
              <span>分享</span>
            </button>
            <button v-if="canManage" class="action-btn" :disabled="mutating" @click="editing = true">编辑歌单</button>
            <button v-if="canManage" class="action-btn" :disabled="mutating" @click="deletePlaylist">删除歌单</button>
            <button v-if="!local && !isUserOwnPlaylist" class="action-btn" :disabled="mutating" @click="toggleSubscribed">{{ playlist.subscribed ? '取消收藏' : '收藏歌单' }}</button>
          </div>
        </div>
      </div>

      <!-- 歌曲列表 - 参考 YesPlayMusic TrackList -->
      <div class="tracks-section">
        <h2 class="section-title">歌曲列表</h2>
        <TrackList
          :tracks="tracks"
          :show-remove="canManage && !mutating"
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
      <p role="alert">{{ loadError || '歌单不存在' }}</p>
      <button class="action-btn" @click="loadData(route.params.id, true)">重新加载</button>
    </div>

    <PlaylistFormModal :visible="editing" :playlist="playlist" @close="editing = false" @saved="loadData(route.params.id, true)" />
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
