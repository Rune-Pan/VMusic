<script setup>
  import GlassSurface from '@/components/GlassSurface.vue'
  import { X, Play, Trash2 } from '@/components/icons'
  import { resizeImage, formatDuration } from '@/utils/common'
  import { IMAGE_SIZE_AVATAR } from '@/constants'
  import { useEscClose } from '@/composables/useEscClose'
  import { usePlayerStore } from '@/stores/player'

  const playerStore = usePlayerStore()

  const props = defineProps({
    visible: {
      type: Boolean,
      default: false
    },
    playlist: {
      type: Array,
      default: () => []
    },
    currentTrack: {
      type: Object,
      default: null
    }
  })

  const emit = defineEmits(['close', 'play', 'remove'])

  function getArtist(track) {
    return track.ar?.map(a => a.name).join(', ') || '未知歌手'
  }

  function getCover(track) {
    return resizeImage(track.al?.picUrl, IMAGE_SIZE_AVATAR)
  }

  function isPlaying(track) {
    return track.id === props.currentTrack?.id
  }

  function playTrack(index) {
    emit('play', index)
  }

  function removeTrack(index) {
    emit('remove', index)
  }

  function close() {
    emit('close')
  }

  useEscClose(() => props.visible, close)
</script>

<template>
  <transition name="slide-right">
    <div v-if="visible" class="playlist-overlay" @click="close">
      <GlassSurface class="playlist-panel" modal label="播放列表" @click.stop>
        <div class="playlist-header">
          <div class="playlist-title">播放列表</div>
          <button class="close-btn" aria-label="关闭" @click="close">
            <X :size="20" />
          </button>
        </div>

        <div class="playlist-count">共 {{ playlist.length }} 首</div>

        <div class="playlist-body">
          <div
            v-for="(track, index) in playlist"
            :key="track.id"
            class="playlist-item"
            role="button"
            tabindex="0"
            :aria-label="`播放${track.name}`"
            @keydown.enter.self.stop="playTrack(index)"
            @keydown.space.self.stop.prevent="playTrack(index)"
            :class="{ active: isPlaying(track) }"
            @click="playTrack(index)"
          >
            <div class="item-index">
              {{ index + 1 }}
            </div>
            <div class="item-cover-wrapper">
              <img :src="getCover(track)" class="item-cover" alt="" />
              <div
                v-if="isPlaying(track)"
                class="cover-equalizer"
                :class="{ paused: !playerStore.playing }"
              >
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div v-else class="cover-play-icon">
                <Play :size="16" />
              </div>
            </div>
            <div class="item-info">
              <div class="item-name text-ellipsis">{{ track.name }}</div>
              <div class="item-artist text-ellipsis">
                {{ getArtist(track) }}
              </div>
            </div>
            <div class="item-duration">{{ formatDuration(track.dt) }}</div>
            <button
              class="item-remove"
              aria-label="从播放列表移除"
              @click.stop="removeTrack(index)"
            >
              <Trash2 :size="14" />
            </button>
          </div>

          <div v-if="playlist.length === 0" class="playlist-empty">
            播放列表为空
          </div>
        </div>
      </GlassSurface>
    </div>
  </transition>
</template>

<style scoped>
  .playlist-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
  }

  .playlist-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 360px;
    max-width: 90vw;
    height: 100vh;
    background: var(--color-modal-bg);
    border-left: 1px solid var(--color-border-light);
    box-shadow: var(--shadow-xl);
    display: flex;
    flex-direction: column;
    z-index: var(--z-modal);
  }

  .playlist-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-border-light);
  }

  .playlist-title {
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

  .playlist-count {
    padding: var(--spacing-sm) var(--spacing-lg);
    font-size: 12px;
    color: var(--color-text-muted);
    border-bottom: 1px solid var(--color-border-light);
  }

  .playlist-body {
    flex: 1;
    overflow-y: auto;
  }

  .playlist-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .playlist-item:hover {
    background: var(--color-secondary-bg-hover);
  }

  .playlist-item.active {
    background: var(--color-primary-bg);
  }

  .item-index {
    width: 24px;
    font-size: 12px;
    color: var(--color-text-muted);
    text-align: center;
    flex-shrink: 0;
  }

  .playing-icon {
    color: var(--color-primary);
  }

  .playing-icon {
    color: var(--color-primary);
  }

  .item-cover-wrapper {
    position: relative;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }
  .item-cover {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }
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
  .playlist-item:hover .cover-play-icon {
    opacity: 1;
  }
  .playlist-item .cover-equalizer {
    opacity: 1;
  }
  .cover-equalizer span {
    display: inline-block;
    width: 3px;
    height: 10px;
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
    height: 5px;
  }
  @keyframes equalize {
    0%,
    100% {
      height: 3px;
    }
    50% {
      height: 12px;
    }
  }

  .item-info {
    flex: 1;
    min-width: 0;
  }

  .item-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
  }

  .playlist-item.active .item-name {
    color: var(--color-primary);
  }

  .item-artist {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .item-duration {
    font-size: 12px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .item-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    opacity: 0;
    flex-shrink: 0;
    transition:
      opacity var(--transition-fast),
      color var(--transition-fast),
      background-color var(--transition-fast);
  }

  .playlist-item:hover .item-remove {
    opacity: 1;
  }

  .item-remove:hover {
    color: var(--color-error);
    background: var(--color-secondary-bg-hover);
  }

  .playlist-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .text-ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 从右侧滑入动画 */
  .slide-right-enter-active,
  .slide-right-leave-active {
    transition: opacity var(--transition-base);
  }

  .slide-right-enter-active .playlist-panel,
  .slide-right-leave-active .playlist-panel {
    transition: transform var(--transition-slow);
  }

  .slide-right-enter-from,
  .slide-right-leave-to {
    opacity: 0;
  }

  .slide-right-enter-from .playlist-panel,
  .slide-right-leave-to .playlist-panel {
    transform: translateX(100%);
  }
</style>
