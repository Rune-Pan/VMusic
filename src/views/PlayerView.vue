<script setup>
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useMusicStore } from '@/stores/music'
  import { usePlayerStore } from '@/stores/player'
  import { resizeImage, formatDuration } from '@/utils/common'
  import {
    IMAGE_SIZE_LARGE,
    LYRIC_POLL_INTERVAL,
    STORAGE_KEYS,
    DEFAULT_LYRIC_FONT_SIZE
  } from '@/constants'

  // 歌词翻译开关（参考上游 YesPlayMusic showLyricsTranslation）
  const showLyricsTranslation =
    localStorage.getItem(STORAGE_KEYS.SHOW_LYRICS_TRANSLATION) !== 'false'

  // 歌词时间显示开关（参考上游 YesPlayMusic showLyricsTime，默认关）
  const showLyricsTime =
    localStorage.getItem(STORAGE_KEYS.SHOW_LYRICS_TIME) === 'true'

  const route = useRoute()
  const router = useRouter()
  const musicStore = useMusicStore()
  const playerStore = usePlayerStore()

  // 歌词字号偏好（参考上游 YesPlayMusic lyricFontSize）
  const lyricFontSize =
    Number(localStorage.getItem(STORAGE_KEYS.LYRIC_FONT_SIZE)) ||
    DEFAULT_LYRIC_FONT_SIZE
  const lyricStyle = { '--lyric-font-size': `${lyricFontSize}px` }

  const track = ref(null)
  const lyrics = ref([])
  const lyricListRef = ref(null)
  const highlightIndex = ref(-1)
  // 参考 YesPlayMusic setLyricsInterval：使用 setInterval 轮询 playerStore.progress 更新歌词高亮
  let lyricsInterval = null

  const artistName = computed(
    () => track.value?.ar?.map(a => a.name).join(', ') || '未知歌手'
  )
  const albumName = computed(() => track.value?.al?.name || '未知专辑')
  const coverUrl = computed(() =>
    resizeImage(track.value?.al?.picUrl, IMAGE_SIZE_LARGE)
  )

  // 参考 YesPlayMusic setLyricsInterval：用真实播放进度计算高亮行
  function setLyricsInterval() {
    clearLyricsInterval()
    lyricsInterval = setInterval(() => {
      const currentTime = playerStore.progress / 1000 // 转换为秒
      updateHighlight(currentTime)
    }, LYRIC_POLL_INTERVAL)
  }

  function clearLyricsInterval() {
    if (lyricsInterval) {
      clearInterval(lyricsInterval)
      lyricsInterval = null
    }
  }

  function updateHighlight(currentTime) {
    if (lyrics.value.length === 0) {
      highlightIndex.value = -1
      return
    }
    let idx = -1
    for (let i = 0; i < lyrics.value.length; i++) {
      if (currentTime >= lyrics.value[i].time) {
        idx = i
      } else {
        break
      }
    }
    if (idx !== highlightIndex.value) {
      highlightIndex.value = idx
      scrollToLine(idx)
    }
  }

  async function scrollToLine(index) {
    await nextTick()
    const el = lyricListRef.value?.children?.[index]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  async function loadTrack() {
    const id = Number(route.params.id)
    track.value = musicStore.getTrackById(id)
    // 从 playerStore 获取当前轨道（真实 API 返回的完整 track 信息）
    if (!track.value && playerStore.currentTrack?.id === id) {
      track.value = playerStore.currentTrack
    }
    if (
      track.value &&
      (!playerStore.currentTrack ||
        playerStore.currentTrack.id !== track.value.id)
    ) {
      await playerStore.play(track.value, musicStore.recommendList)
    }
    lyrics.value = await musicStore.fetchLyrics(id)
    setLyricsInterval()
  }

  function seekToLyric(time) {
    playerStore.seek(time * 1000) // 转换为毫秒
  }

  onMounted(() => {
    loadTrack()
    // ESC 退出播放详情页（弹窗优先由 useEscClose 处理，栈空时才到这里）
    window.addEventListener('keydown', onKeydown)
  })

  watch(
    () => route.params.id,
    () => {
      loadTrack()
    }
  )

  // 当播放列表切换上一首/下一首时，更新播放页内容
  watch(
    () => playerStore.currentTrack?.id,
    newId => {
      if (newId && Number(route.params.id) !== newId) {
        router.replace({ name: 'player', params: { id: newId } })
      }
    }
  )

  onUnmounted(() => {
    clearLyricsInterval()
    window.removeEventListener('keydown', onKeydown)
  })

  // ESC 退出播放页：有历史则 back，否则回首页兜底
  function onKeydown(e) {
    if (e.key !== 'Escape') return
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push({ name: 'home' })
    }
  }
</script>

<template>
  <div class="player-view" :style="lyricStyle">
    <div class="player-content">
      <div class="left-section">
        <div class="cover-wrapper">
          <img :src="coverUrl" :alt="track?.name" class="cover" />
          <div
            class="cover-glow"
            :style="{ backgroundImage: `url(${coverUrl})` }"
          ></div>
        </div>
      </div>

      <div class="right-section">
        <div class="track-meta">
          <h1 class="track-name">{{ track?.name || '未知歌曲' }}</h1>
          <div class="track-artist">{{ artistName }}</div>
          <div class="track-album">{{ albumName }}</div>
        </div>
        <div ref="lyricListRef" class="lyric-list">
          <div
            v-for="(line, index) in lyrics"
            :key="index"
            class="lyric-line"
            :class="{ active: index === highlightIndex }"
            @click="seekToLyric(line.time)"
          >
            <span
              v-if="showLyricsTime"
              class="lyric-time"
              @click.stop="seekToLyric(line.time)"
            >
              {{ formatDuration(line.time * 1000) }}
            </span>
            <div class="lyric-original">{{ line.content }}</div>
            <div
              v-if="line.translation && showLyricsTranslation"
              class="lyric-translation"
            >
              {{ line.translation }}
            </div>
          </div>
          <div v-if="lyrics.length === 0" class="no-lyric">暂无歌词</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .player-view {
    position: fixed;
    inset: 0;
    z-index: 1;
  }
  .player-content {
    display: grid;
    grid-template-columns: 40% 60%;
    gap: var(--spacing-2xl);
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: var(--spacing-2xl) var(--spacing-xl);
    height: 100%;
  }
  .left-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .cover-wrapper {
    position: relative;
    width: 280px;
    height: 280px;
    margin-bottom: var(--spacing-xl);
  }
  .cover {
    width: 100%;
    height: 100%;
    border-radius: var(--radius-xl);
    object-fit: cover;
    box-shadow: var(--shadow-xl);
    position: relative;
    z-index: 1;
  }
  .cover-glow {
    position: absolute;
    inset: 20px;
    border-radius: var(--radius-xl);
    filter: blur(40px);
    opacity: 0.4;
    z-index: 0;
  }
  .track-meta {
    text-align: center;
    padding-top: var(--spacing-lg);
    margin-bottom: var(--spacing-md);
  }
  .track-name {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: var(--spacing-xs);
  }
  .track-artist {
    font-size: 16px;
    color: var(--color-text-secondary);
    margin-bottom: 4px;
  }
  .track-album {
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .right-section {
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .lyric-list {
    flex: 1;
    width: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    padding: var(--spacing-md) var(--spacing-md) 120px;
    scroll-behavior: smooth;
  }
  .lyric-line {
    position: relative;
    padding: var(--spacing-sm) 0;
    text-align: center;
    cursor: pointer;
    transition: all var(--transition-base);
    line-height: 1.8;
  }
  .lyric-time {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    font-size: calc(var(--lyric-font-size) - 4px);
    font-variant-numeric: tabular-nums;
    color: var(--color-text-muted);
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  .lyric-line:hover .lyric-time {
    opacity: 1;
  }
  .lyric-original {
    font-size: var(--lyric-font-size);
    color: var(--color-text-muted);
    transition: all var(--transition-base);
  }
  .lyric-line:hover .lyric-original {
    color: var(--color-text-secondary);
  }
  .lyric-line.active .lyric-original {
    color: var(--color-text);
    font-size: calc(var(--lyric-font-size) * 1.125);
    font-weight: 600;
  }
  .lyric-translation {
    font-size: calc(var(--lyric-font-size) - 3px);
    color: var(--color-text-muted);
    margin-top: 2px;
    opacity: 0.7;
  }
  .lyric-line.active .lyric-translation {
    color: var(--color-text-secondary);
    opacity: 1;
  }
  .no-lyric {
    text-align: center;
    color: var(--color-text-muted);
    padding: var(--spacing-3xl);
  }
</style>
