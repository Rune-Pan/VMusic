<script setup>
  import { ref, onMounted, onUnmounted } from 'vue'
  import { Trash2, Play, ListEnd, Heart } from '@/components/icons'
  import { usePlayerStore } from '@/stores/player'
  import { useUserStore } from '@/stores/user'
  import { useUiStore } from '@/stores/ui'
  import { likeSong } from '@/api/track'
  import {
    formatDuration,
    formatRelativeTime,
    resizeImage
  } from '@/utils/common'
  import { IMAGE_SIZE_CARD } from '@/constants'

  // reason 文案 → 角标文案 + 修饰类
  const BADGE = {
    '需 VIP': { text: 'VIP', cls: 'vip' },
    需购买: { text: '购买', cls: 'purchase' },
    无版权: { text: '无版权', cls: 'nocopyright' }
  }
  function trackBadge(reason) {
    return BADGE[reason]
  }

  const props = defineProps({
    tracks: { type: Array, default: () => [] },
    showRemove: { type: Boolean, default: false },
    showPlayedAt: { type: Boolean, default: false },
    showPlayCount: { type: Boolean, default: false }
  })

  const emit = defineEmits(['remove', 'play'])
  const playerStore = usePlayerStore()
  const userStore = useUserStore()
  const uiStore = useUiStore()

  // 右键菜单状态
  const contextMenu = ref({ visible: false, x: 0, y: 0, track: null })
  const liking = ref(false)

  function playTrack(track, index) {
    playerStore.play(track, props.tracks)
    emit('play', { track, index })
  }

  function isCurrentTrack(track) {
    return playerStore.currentTrack?.id === track.id
  }

  function isLiked(track) {
    return track ? userStore.isLiked(track.id) : false
  }

  function openContextMenu(e, track) {
    e.preventDefault()
    e.stopPropagation()
    contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, track }
  }

  function closeContextMenu() {
    contextMenu.value.visible = false
  }

  function menuPlay() {
    const track = contextMenu.value.track
    if (!track) return
    const idx = props.tracks.findIndex(t => t.id === track.id)
    playTrack(track, idx)
    closeContextMenu()
  }

  function menuPlayNext() {
    const track = contextMenu.value.track
    if (!track) return
    playerStore.playNext(track)
    uiStore.showToast('已添加到下一首播放', 'success')
    closeContextMenu()
  }

  async function menuToggleLike() {
    const track = contextMenu.value.track
    if (!track || liking.value) return
    if (!userStore.isLoggedIn) {
      uiStore.showToast('请先登录', 'warning')
      closeContextMenu()
      return
    }
    const uid = userStore.userInfo.id
    const nextLiked = !isLiked(track)
    liking.value = true
    try {
      await likeSong({ id: track.id, like: nextLiked })
      if (uid !== userStore.userInfo.id) return
      if (nextLiked) userStore.addLikedSong(track.id, track)
      else userStore.removeLikedSong(track.id)
      uiStore.showToast(nextLiked ? '已添加到喜欢' : '已取消喜欢', 'success')
    } catch (e) {
      if (uid !== userStore.userInfo.id) return
      uiStore.showToast('操作失败，请稍后重试', 'error')
      console.error('Like song failed:', e)
    } finally {
      liking.value = false
    }
    closeContextMenu()
  }

  function handleDocumentClick() {
    if (contextMenu.value.visible) closeContextMenu()
  }
  function handleDocumentContext() {
    if (contextMenu.value.visible) closeContextMenu()
  }
  function handleEsc(e) {
    if (e.key === 'Escape' && contextMenu.value.visible) closeContextMenu()
  }

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick)
    document.addEventListener('contextmenu', handleDocumentContext)
    document.addEventListener('keydown', handleEsc)
    window.addEventListener('scroll', closeContextMenu, true)
  })
  onUnmounted(() => {
    document.removeEventListener('click', handleDocumentClick)
    document.removeEventListener('contextmenu', handleDocumentContext)
    document.removeEventListener('keydown', handleEsc)
    window.removeEventListener('scroll', closeContextMenu, true)
  })
</script>

<template>
  <div class="track-list">
    <div v-if="tracks.length === 0" class="empty">暂无歌曲</div>
    <div v-else class="track-header">
      <div class="index">#</div>
      <div class="info">歌名 / 歌手</div>
      <div class="album hidden-mobile">专辑</div>
      <div class="duration">时长</div>
      <div class="actions"></div>
    </div>
    <div
      v-for="(track, index) in tracks"
      :key="track.id"
      class="track-item"
      :class="{ active: isCurrentTrack(track) }"
      @dblclick="playTrack(track, index)"
      @contextmenu="openContextMenu($event, track)"
    >
      <div class="index">{{ index + 1 }}</div>
      <div
        class="info"
        role="button"
        tabindex="0"
        :aria-label="`播放${track.name}`"
        @keydown.enter.stop="playTrack(track, index)"
        @keydown.space.stop.prevent="playTrack(track, index)"
        @click="playTrack(track, index)"
      >
        <div class="track-cover-wrapper">
          <img
            :src="resizeImage(track.al?.picUrl, IMAGE_SIZE_CARD)"
            :alt="track.name"
            class="track-cover"
            loading="lazy"
          />
          <!-- 当前播放：音浪动画（playing 跳动，暂停静止） -->
          <div
            v-if="isCurrentTrack(track)"
            class="cover-equalizer"
            :class="{ paused: !playerStore.playing }"
          >
            <span></span>
            <span></span>
            <span></span>
          </div>
          <!-- hover 播放图标（非当前播放的歌） -->
          <div v-else class="cover-play-icon">
            <Play :size="18" />
          </div>
        </div>
        <div class="info-text">
          <div class="name text-ellipsis">
            {{ track.name }}
            <span
              v-if="trackBadge(track.reason)"
              class="track-badge"
              :class="trackBadge(track.reason).cls"
            >
              {{ trackBadge(track.reason).text }}
            </span>
          </div>
          <div class="artist text-ellipsis">
            {{ track.ar?.map(a => a.name).join(', ') || '未知歌手' }}
          </div>
        </div>
      </div>
      <div class="album text-ellipsis hidden-mobile">
        {{ track.al?.name || '--' }}
      </div>
      <div v-if="showPlayedAt && track.playedAt" class="played-at">
        {{ formatRelativeTime(track.playedAt) }}
      </div>
      <div v-else-if="showPlayCount && track.playCount" class="play-count">
        {{ track.playCount }}次
      </div>
      <div v-else class="duration">{{ formatDuration(track.dt) }}</div>
      <div class="actions">
        <button
          v-if="showRemove"
          class="action-btn delete"
          :aria-label="`移除${track.name}`"
          @click.stop="emit('remove', track)"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <transition name="fade">
      <ul
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @click.stop
      >
        <li class="context-item" @click="menuPlay">
          <Play :size="15" />
          <span>播放</span>
        </li>
        <li class="context-item" @click="menuPlayNext">
          <ListEnd :size="15" />
          <span>下一首播放</span>
        </li>
        <li class="context-divider"></li>
        <li class="context-item" @click="menuToggleLike">
          <Heart
            :size="15"
            :fill="isLiked(contextMenu.track) ? 'currentColor' : 'none'"
          />
          <span>{{ isLiked(contextMenu.track) ? '取消喜欢' : '我喜欢' }}</span>
        </li>
      </ul>
    </transition>
  </div>
</template>

<style scoped>
  .track-list {
    width: 100%;
  }
  .empty {
    padding: var(--spacing-xl);
    text-align: center;
    color: var(--color-text-muted);
    font-size: 14px;
  }
  .track-item {
    display: grid;
    grid-template-columns: 40px 1fr 1fr 80px auto;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast);
  }
  .track-header {
    display: grid;
    grid-template-columns: 40px 1fr 1fr 80px auto;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-xs) var(--spacing-md);
    font-size: 13px;
    color: var(--color-text-muted);
    border-bottom: 1px solid var(--color-border-light);
  }
  .track-item:hover {
    background: var(--color-secondary-bg-hover);
  }
  .track-item.active {
    background: var(--color-primary-bg-transparent);
  }
  .track-item.active .name {
    color: var(--color-primary);
  }
  .index {
    font-size: 13px;
    color: var(--color-text-muted);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .info {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    min-width: 0;
    cursor: pointer;
  }
  .track-cover-wrapper {
    position: relative;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }
  .track-cover {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }
  /* 封面遮罩层（hover 播放图标 / 当前播放音浪） */
  .cover-play-icon,
  .cover-equalizer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    color: #ffffff;
    border-radius: var(--radius-sm);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  .track-item:hover .cover-play-icon {
    opacity: 1;
  }
  /* 当前播放始终显示音浪 */
  .track-item .cover-equalizer {
    opacity: 1;
  }
  /* 音浪：3 根竖条，playing 时跳动，paused 时静止 */
  .cover-equalizer span {
    display: inline-block;
    width: 3px;
    height: 12px;
    margin: 0 1px;
    background: #ffffff;
    border-radius: 1px;
    animation: equalize 0.9s ease-in-out infinite;
  }
  .cover-equalizer span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .cover-equalizer span:nth-child(3) {
    animation-delay: 0.4s;
  }
  .cover-equalizer.paused span {
    animation-play-state: paused;
    height: 6px;
  }
  @keyframes equalize {
    0%,
    100% {
      height: 4px;
    }
    50% {
      height: 14px;
    }
  }
  .info-text {
    min-width: 0;
    flex: 1;
  }
  .name {
    font-size: 14px;
    color: var(--color-text);
    margin-bottom: 2px;
  }
  .track-badge {
    display: inline-block;
    margin-left: 6px;
    padding: 0 4px;
    border-radius: var(--radius-sm);
    font-size: 10px;
    line-height: 14px;
    color: #ffffff;
    vertical-align: middle;
  }
  .track-badge.vip {
    background: var(--color-badge-vip);
  }
  .track-badge.purchase {
    background: var(--color-badge-purchase);
  }
  .track-badge.nocopyright {
    background: var(--color-badge-nocopyright);
  }
  .artist {
    font-size: 12px;
    color: var(--color-text-secondary);
  }
  .album {
    font-size: 13px;
    color: var(--color-text-secondary);
  }
  .duration {
    font-size: 13px;
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .played-at {
    font-size: 12px;
    color: var(--color-text-muted);
    text-align: right;
    white-space: nowrap;
  }
  .play-count {
    font-size: 12px;
    color: var(--color-text-muted);
    text-align: right;
    white-space: nowrap;
  }
  .actions {
    display: flex;
    gap: var(--spacing-xs);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  .track-item:hover .actions {
    opacity: 1;
  }
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
  }
  .action-btn:hover {
    background: var(--color-secondary-bg-hover);
    color: var(--color-text);
  }
  .action-btn.delete:hover {
    color: var(--color-error);
  }
  .context-menu {
    position: fixed;
    z-index: var(--z-modal);
    min-width: 160px;
    margin: 0;
    padding: var(--spacing-xs);
    list-style: none;
    background: var(--color-modal-bg);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-xl);
  }
  .context-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 13px;
    color: var(--color-text);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--transition-fast);
  }
  .context-item:hover {
    background: var(--color-secondary-bg-hover);
  }
  .context-divider {
    height: 1px;
    margin: var(--spacing-xs) 0;
    background: var(--color-border-light);
  }
  .hidden-mobile {
    display: block;
  }
</style>
