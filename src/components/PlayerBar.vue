<script setup>
  import GlassSurface from '@/components/GlassSurface.vue'
  import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Heart,
    Repeat,
    Repeat1,
    Shuffle,
    MessageSquareText,
    ListMusic,
    Ellipsis,
    Maximize2,
    Minimize2
  } from '@/components/icons'
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { usePlayerStore } from '@/stores/player'
  import { useUserStore } from '@/stores/user'
  import { useUiStore } from '@/stores/ui'
  import { likeSong } from '@/api/track'
  import { PLACEHOLDER_COVER_48 } from '@/constants'
  import { formatDuration } from '@/utils/common'
  import ProgressBar from '@/components/ProgressBar.vue'
  import CommentModal from '@/components/CommentModal.vue'
  import TrackDetailModal from '@/components/TrackDetailModal.vue'
  import PlaylistPanel from '@/components/PlaylistPanel.vue'
  import AddToPlaylistModal from '@/components/AddToPlaylistModal.vue'

  const router = useRouter()
  const route = useRoute()
  const playerStore = usePlayerStore()
  const userStore = useUserStore()
  const uiStore = useUiStore()

  const isPlayerPage = computed(() => route.name === 'player')

  const liked = computed(() =>
    playerStore.currentTrack
      ? userStore.isLiked(playerStore.currentTrack.id)
      : false
  )
  const likeAnim = ref(false)
  const isLiking = ref(false)
  const showCommentModal = ref(false)
  const showTrackDetailModal = ref(false)
  const showPlaylistPanel = ref(false)
  const showAddToPlaylistModal = ref(false)
  const showMoreMenu = ref(false)
  const moreMenuRef = ref(null)
  // 音量调节气泡：音量变化即显示（拖动/快捷键/静音统一），延迟 1s 隐藏
  const showVolumeTip = ref(false)
  // hover/聚焦音量控件时持续显示气泡（与变化闪现取并集）
  const volumeHovering = ref(false)
  let volumeTipTimer = null
  function flashVolumeTip() {
    showVolumeTip.value = true
    if (volumeTipTimer) clearTimeout(volumeTipTimer)
    volumeTipTimer = setTimeout(() => {
      showVolumeTip.value = false
    }, 1000)
  }
  watch(() => playerStore.volume, flashVolumeTip)
  function onVolumeInput(e) {
    playerStore.setVolume(Number(e.target.value))
  }

  function goToPlayer() {
    if (!playerStore.currentTrack) return
    if (isPlayerPage.value) {
      router.back()
    } else {
      router.push({
        name: 'player',
        params: { id: playerStore.currentTrack.id }
      })
    }
  }

  function handleSeek(time) {
    playerStore.seek(time)
  }

  function toggleMute() {
    playerStore.toggleMute()
  }

  async function toggleLike() {
    if (isLiking.value || !playerStore.currentTrack) return

    if (!userStore.isLoggedIn) {
      uiStore.showToast('请先登录', 'warning')
      return
    }

    const track = playerStore.currentTrack
    const trackId = track.id
    const uid = userStore.userInfo.id
    const nextLiked = !liked.value

    likeAnim.value = true
    setTimeout(() => {
      likeAnim.value = false
    }, 150)

    isLiking.value = true
    try {
      await likeSong({ id: trackId, like: nextLiked })
      if (uid !== userStore.userInfo.id) return
      if (nextLiked) userStore.addLikedSong(trackId, track)
      else userStore.removeLikedSong(trackId)
      uiStore.showToast(nextLiked ? '已添加到喜欢' : '已取消喜欢', 'success')
    } catch (e) {
      if (uid !== userStore.userInfo.id) return
      uiStore.showToast('操作失败，请稍后重试', 'error')
      console.error('Like song failed:', e)
    } finally {
      isLiking.value = false
    }
  }

  function openComments() {
    if (!playerStore.currentTrack) return
    showCommentModal.value = true
  }

  function toggleMoreMenu() {
    showMoreMenu.value = !showMoreMenu.value
  }

  function closeMoreMenu() {
    showMoreMenu.value = false
  }

  function togglePlaylistPanel() {
    showPlaylistPanel.value = !showPlaylistPanel.value
  }

  async function playFromPlaylist(index) {
    if (index < 0 || index >= playerStore.playlist.length) return
    const track = playerStore.playlist[index]
    await playerStore.play(track, playerStore.playlist)
  }

  async function removeFromPlaylist(index) {
    await playerStore.removeFromPlaylist(index)
    uiStore.showToast('已从播放列表移除', 'success')
  }

  function viewTrackDetail() {
    if (!playerStore.currentTrack) return
    showTrackDetailModal.value = true
    closeMoreMenu()
  }

  async function copyTrackLink() {
    if (!playerStore.currentTrack) return
    const url = `https://music.163.com/#/song?id=${playerStore.currentTrack.id}`
    try {
      await navigator.clipboard.writeText(url)
      uiStore.showToast('链接已复制', 'success')
    } catch {
      uiStore.showToast('复制失败', 'error')
    }
    closeMoreMenu()
  }

  function addToPlaylist() {
    if (!playerStore.currentTrack) return
    showAddToPlaylistModal.value = true
    closeMoreMenu()
  }

  function handleClickOutside(event) {
    if (moreMenuRef.value && !moreMenuRef.value.contains(event.target)) {
      showMoreMenu.value = false
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleClickOutside)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
  })

  // formatTime 已移除，使用 formatDuration（来自 @/utils/common）
</script>

<template>
  <GlassSurface class="player-bar" :class="{ immersive: isPlayerPage }">
    <div class="controls">
      <div class="left-section">
        <button
          class="track-cover"
          :aria-label="isPlayerPage ? '返回浏览' : '展开播放页'"
          @click="goToPlayer"
        >
          <img
            :src="playerStore.currentTrack?.al?.picUrl || PLACEHOLDER_COVER_48"
            alt="cover"
            class="cover"
          />
          <div class="cover-hover-overlay">
            <Minimize2 v-if="isPlayerPage" :size="18" />
            <Maximize2 v-else :size="18" />
          </div>
        </button>
        <div class="track-info" @click="goToPlayer">
          <div class="name text-ellipsis">
            {{ playerStore.currentTrack?.name || '未知歌曲' }}
          </div>
          <div class="artist text-ellipsis">
            <span v-if="playerStore.isLoading" role="status">正在加载…</span>
            <span v-else>
              {{
                playerStore.currentTrack?.ar?.map(a => a.name).join(', ') ||
                '未知歌手'
              }}
            </span>
          </div>
        </div>
        <button
          class="ctrl-btn"
          :class="{ active: liked, 'like-anim': likeAnim }"
          aria-label="喜欢"
          @click="toggleLike"
        >
          <Heart :size="18" :fill="liked ? 'currentColor' : 'none'" />
        </button>
        <button class="ctrl-btn" aria-label="评论" @click="openComments">
          <MessageSquareText :size="18" />
        </button>
      </div>

      <div class="main-section">
        <div class="playback-controls">
          <button
            class="ctrl-btn"
            :class="{ active: playerStore.shuffleMode }"
            aria-label="随机播放"
            @click="playerStore.toggleShuffle"
          >
            <Shuffle :size="18" />
          </button>
          <button
            class="ctrl-btn"
            aria-label="上一首"
            @click="playerStore.prev"
          >
            <SkipBack :size="20" />
          </button>
          <button
            class="ctrl-btn play-btn"
            :aria-label="playerStore.wantsPlay ? '暂停' : '播放'"
            @click="playerStore.togglePlay"
          >
            <Play
              v-if="!playerStore.playing && !playerStore.wantsPlay"
              :size="22"
              color="#ffffff"
              fill="#ffffff"
            />
            <Pause v-else :size="22" color="#ffffff" fill="#ffffff" />
          </button>
          <button
            class="ctrl-btn"
            aria-label="下一首"
            @click="playerStore.next"
          >
            <SkipForward :size="20" />
          </button>
          <button
            class="ctrl-btn"
            :class="{ active: playerStore.repeatMode !== 'off' }"
            aria-label="循环模式"
            @click="playerStore.toggleRepeat"
          >
            <Repeat v-if="playerStore.repeatMode !== 'one'" :size="18" />
            <Repeat1 v-else :size="18" />
          </button>
        </div>

        <div class="progress-row">
          <span class="time">{{ formatDuration(playerStore.progress) }}</span>
          <ProgressBar
            :current="playerStore.progress"
            :total="playerStore.duration"
            :show-time="false"
            @seek="handleSeek"
          />
          <span class="time">{{ formatDuration(playerStore.duration) }}</span>
        </div>
      </div>

      <div class="right-section">
        <div class="volume-control">
          <button
            class="ctrl-btn"
            :aria-label="playerStore.volume === 0 ? '取消静音' : '静音'"
            @click="toggleMute"
          >
            <VolumeX v-if="playerStore.volume === 0" :size="18" />
            <Volume2 v-else :size="18" />
          </button>
          <div
            class="volume-slider-wrapper"
            @mouseenter="volumeHovering = true"
            @mouseleave="volumeHovering = false"
          >
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="playerStore.volume"
              class="volume-slider"
              aria-label="音量"
              @input="onVolumeInput"
              @focus="volumeHovering = true"
              @blur="volumeHovering = false"
            />
            <div
              v-show="showVolumeTip || volumeHovering"
              class="volume-tip"
              :style="{ left: `calc(${playerStore.volume * 100}% - 12px)` }"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              :aria-label="`音量 ${Math.round(playerStore.volume * 100)}%`"
            >
              {{ Math.round(playerStore.volume * 100) }}
            </div>
          </div>
        </div>
        <button
          class="ctrl-btn"
          aria-label="播放列表"
          @click="togglePlaylistPanel"
        >
          <ListMusic :size="18" />
        </button>
        <div ref="moreMenuRef" class="more-menu-wrapper" data-dialog-return>
          <button
            class="ctrl-btn"
            aria-label="更多"
            @click.stop="toggleMoreMenu"
          >
            <Ellipsis :size="18" />
          </button>
          <transition name="fade">
            <div v-if="showMoreMenu" class="more-menu">
              <button class="more-menu-item" @click="viewTrackDetail">
                查看歌曲详情
              </button>
              <button class="more-menu-item" @click="copyTrackLink">
                复制歌曲链接
              </button>
              <button class="more-menu-item" @click="addToPlaylist">
                添加到歌单
              </button>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </GlassSurface>

  <CommentModal
    :visible="showCommentModal"
    type="track"
    :id="playerStore.currentTrack?.id"
    :title="playerStore.currentTrack?.name"
    @close="showCommentModal = false"
  />

  <TrackDetailModal
    :visible="showTrackDetailModal"
    :track="playerStore.currentTrack"
    @close="showTrackDetailModal = false"
  />

  <PlaylistPanel
    :visible="showPlaylistPanel"
    :playlist="playerStore.playlist"
    :current-track="playerStore.currentTrack"
    @close="showPlaylistPanel = false"
    @play="playFromPlaylist"
    @remove="removeFromPlaylist"
  />

  <AddToPlaylistModal
    :visible="showAddToPlaylistModal"
    :track="playerStore.currentTrack"
    @close="showAddToPlaylistModal = false"
  />
</template>

<style scoped>
  .player-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: var(--player-height);
    background: var(--color-player-bg);
    z-index: var(--z-player);
    border-top: 1px solid var(--color-border-light);
    display: flex;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-2xl);
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease;
  }

  .player-bar.immersive {
    background: transparent;
    border-color: transparent;
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    gap: var(--spacing-lg);
  }

  .left-section {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    min-width: 200px;
    width: 25%;
    flex-shrink: 0;
  }

  .track-cover {
    cursor: pointer;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-md);
  }

  .cover {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    object-fit: cover;
    box-shadow: var(--shadow-sm);
  }

  .cover-hover-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    color: #ffffff;
    opacity: 0;
    transition: opacity var(--transition-fast);
    border-radius: var(--radius-md);
  }

  .track-cover:hover .cover-hover-overlay {
    opacity: 1;
  }

  .track-info {
    cursor: pointer;
    min-width: 0;
    margin-right: var(--spacing-sm);
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

  .main-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: var(--spacing-xs);
    min-width: 0;
  }

  .playback-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
  }

  .progress-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    width: 100%;
    max-width: 600px;
  }

  .right-section {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--spacing-xs);
    min-width: 200px;
    width: 25%;
    flex-shrink: 0;
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .ctrl-btn:hover {
    color: var(--color-text);
  }

  /* tooltip：读取 aria-label，hover + 键盘焦点触发，往上弹 */
  .ctrl-btn::after {
    content: attr(aria-label);
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.85);
    color: #ffffff;
    font-size: 12px;
    line-height: 1.4;
    border-radius: var(--radius-sm);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--transition-fast);
    z-index: var(--z-tooltip, 1200);
  }

  .ctrl-btn:hover::after,
  .ctrl-btn:focus-visible::after {
    opacity: 1;
  }

  .ctrl-btn.active {
    color: var(--color-primary);
  }

  .ctrl-btn.like-anim {
    animation: heart-pop 0.15s ease;
  }

  @keyframes heart-pop {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(0.85);
    }
    100% {
      transform: scale(1);
    }
  }

  .play-btn {
    width: 42px;
    height: 42px;
    background: var(--color-primary);
    color: #ffffff;
  }

  .play-btn:hover {
    background: var(--color-primary-hover);
    color: #ffffff;
  }

  .more-menu-wrapper {
    position: relative;
  }

  .more-menu {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    min-width: 160px;
    background: var(--color-modal-bg);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-xl);
    padding: var(--spacing-xs);
    z-index: var(--z-dropdown);
  }

  .more-menu-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 13px;
    color: var(--color-text);
    border-radius: var(--radius-sm);
    transition: background-color var(--transition-fast);
  }

  .more-menu-item:hover {
    background: var(--color-secondary-bg-hover);
  }

  .volume-control {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .volume-slider-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .volume-slider {
    width: 80px;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--color-secondary-bg-hover);
    border-radius: var(--radius-full);
    outline: none;
  }

  /* 音量数值气泡：拖动时显示，跟随拇指位置 */
  .volume-tip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    min-width: 28px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.85);
    color: #ffffff;
    font-size: 11px;
    line-height: 1.4;
    text-align: center;
    border-radius: var(--radius-sm);
    pointer-events: none;
    z-index: var(--z-tooltip, 1200);
  }

  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-primary);
    cursor: pointer;
  }

  .volume-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-primary);
    cursor: pointer;
    border: none;
  }

  .text-ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
