<script setup>
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ArrowLeft } from '@/components/icons'
  import { useMusicStore } from '@/stores/music'
  import { usePlayerStore } from '@/stores/player'
  import { resizeImage, formatDuration } from '@/utils/common'
  import {
    IMAGE_SIZE_LARGE,
    STORAGE_KEYS,
    DEFAULT_LYRIC_FONT_SIZE
  } from '@/constants'
  import { getTrackDetail } from '@/api/track'
  import { useCoverRotation } from '@/composables/useCoverRotation'
  import { useLyricColors } from '@/composables/useLyricColors'
  import { useAiStore } from '@/stores/ai'

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
  const ai = useAiStore()
  async function interpretLyrics() {
    ai.queue('lyrics', { type: 'track', id: Number(route.params.id), title: track.value?.name || '当前歌曲' })
    try { await router.push('/ai') } catch { ai.takePending() }
  }
  const { enabled: coverRotationEnabled, secondsPerTurn } = useCoverRotation()
  const coverImage = ref(null)
  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const reducedMotion = ref(motionQuery?.matches ?? false)
  const shouldRotate = computed(() =>
    playerStore.playing && !playerStore.isLoading &&
    Number(playerStore.currentTrack?.id) === Number(route.params.id)
  )
  let coverAnimation = null

  function clearCoverAnimation() {
    coverAnimation?.cancel()
    coverAnimation = null
  }

  function syncCoverRotation() {
    if (!coverRotationEnabled.value || reducedMotion.value || !coverImage.value) {
      clearCoverAnimation()
      return
    }
    if (coverAnimation?.effect.target !== coverImage.value) {
      clearCoverAnimation()
      coverAnimation = coverImage.value.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        { duration: 1000, iterations: Infinity, easing: 'linear' }
      )
      coverAnimation.pause()
    }
    const rate = 1 / secondsPerTurn.value
    if (coverAnimation.playbackRate !== rate) coverAnimation.updatePlaybackRate(rate)
    if (shouldRotate.value) coverAnimation.play()
    else coverAnimation.pause()
  }

  function onMotionChange(event) {
    reducedMotion.value = event.matches
  }

  watch([coverRotationEnabled, secondsPerTurn, shouldRotate, coverImage, reducedMotion],
    syncCoverRotation, { flush: 'post' })

  // 歌词字号偏好（参考上游 YesPlayMusic lyricFontSize）
  const lyricFontSize =
    Number(localStorage.getItem(STORAGE_KEYS.LYRIC_FONT_SIZE)) ||
    DEFAULT_LYRIC_FONT_SIZE
  const { colorStyle } = useLyricColors()
  const lyricStyle = computed(() => ({
    ...colorStyle.value,
    '--lyric-font-size': `${lyricFontSize}px`
  }))

  const detailTrack = ref(null)
  const track = computed(() =>
    Number(playerStore.currentTrack?.id) === Number(route.params.id)
      ? playerStore.currentTrack
      : detailTrack.value
  )
  const lyrics = computed(() =>
    musicStore.currentLyricsTrackId === Number(route.params.id)
      ? musicStore.currentLyrics
      : []
  )
  const lyricListRef = ref(null)
  const highlightIndex = ref(-1)
  let loadGeneration = 0

  const artistName = computed(
    () => track.value?.ar?.map(a => a.name).join(', ') || '未知歌手'
  )
  const albumName = computed(() => track.value?.al?.name || '未知专辑')
  const coverUrl = computed(() =>
    resizeImage(track.value?.al?.picUrl, IMAGE_SIZE_LARGE)
  )

  // 参考 YesPlayMusic setLyricsInterval：用真实播放进度计算高亮行
  function updateHighlight(currentTime) {
    if (
      lyrics.value.length === 0 ||
      Number(playerStore.currentTrack?.id) !== Number(route.params.id)
    ) {
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
    if (index !== highlightIndex.value) return
    const el = lyricListRef.value?.children?.[index]
    if (el) {
      el.scrollIntoView({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')
          .matches
          ? 'instant'
          : 'smooth',
        block: 'center'
      })
    }
  }

  async function loadTrack() {
    const requestId = ++loadGeneration
    const id = Number(route.params.id)
    highlightIndex.value = -1
    detailTrack.value = musicStore.getTrackById(id)
    // 页面只加载展示信息；播放由播放器按钮/列表的显式操作发起。
    const lyricsRequest = musicStore.fetchLyrics(id)
    if (!track.value) {
      try {
        const data = await getTrackDetail(String(id))
        if (requestId === loadGeneration)
          detailTrack.value = data.songs?.[0] || null
      } catch {
        // 详情不可用不影响共享播放器。
      }
    }
    await lyricsRequest
  }

  async function seekToLyric(time) {
    const selectedTrack = track.value
    if (!selectedTrack) return
    if (Number(playerStore.currentTrack?.id) !== Number(selectedTrack.id)) {
      await playerStore.play(selectedTrack)
    }
    if (
      Number(route.params.id) === Number(selectedTrack.id) &&
      Number(playerStore.currentTrack?.id) === Number(selectedTrack.id)
    ) {
      playerStore.seek(time * 1000)
    }
  }

  onMounted(() => {
    motionQuery?.addEventListener('change', onMotionChange)
    // ESC 退出播放详情页（弹窗优先由 useEscClose 处理，栈空时才到这里）
    window.addEventListener('keydown', onKeydown)
  })

  watch(
    () => route.params.id,
    () => {
      loadTrack()
    },
    { immediate: true }
  )

  watch(
    [() => playerStore.progress, lyrics],
    () => {
      updateHighlight(playerStore.progress / 1000)
    },
    { immediate: true }
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
    clearCoverAnimation()
    motionQuery?.removeEventListener('change', onMotionChange)
    loadGeneration++
    musicStore.clearLyrics()
    window.removeEventListener('keydown', onKeydown)
  })

  // ESC 退出播放页：有历史则 back，否则回首页兜底
  function onKeydown(e) {
    if (e.key !== 'Escape') return
    leavePlayer()
  }

  function leavePlayer() {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push({ name: 'home' })
    }
  }
</script>

<template>
  <div class="player-view" :style="lyricStyle">
    <button class="stage-back" @click="leavePlayer">
      <ArrowLeft :size="18" />
      返回浏览
    </button>
    <div class="player-content">
      <div class="left-section">
        <div class="cover-wrapper" :class="{ 'rotation-enabled': coverRotationEnabled }">
          <img :key="route.params.id" ref="coverImage" :src="coverUrl" :alt="track?.name" class="cover" />
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
          <button class="lyric-ai-link" type="button" @click="interpretLyrics">AI 解读歌词</button>
        </div>
        <div ref="lyricListRef" class="lyric-list">
          <div
            v-for="(line, index) in lyrics"
            :key="index"
            class="lyric-line"
            role="button"
            tabindex="0"
            @keydown.enter.stop="seekToLyric(line.time)"
            @keydown.space.stop.prevent="seekToLyric(line.time)"
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
  .lyric-ai-link { margin-top: 14px; padding: 8px 16px; border-radius: var(--radius-full); color: var(--color-accent-ink); background: var(--color-primary-bg); font-size: 13px; }
  .player-view {
    position: fixed;
    inset: 0;
    z-index: 1;
  }
  .stage-back {
    position: absolute;
    top: 26px;
    left: 36px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-text-secondary);
    padding: 9px 14px;
    border-radius: var(--radius-full);
    background: var(--surface-content);
  }
  .player-content {
    --player-content-max-width: 1240px;
    display: grid;
    grid-template-columns: minmax(240px, 0.9fr) minmax(0, 1.1fr);
    gap: 70px;
    max-width: var(--player-content-max-width);
    height: 100%;
    margin: auto;
    padding: 86px 72px calc(var(--player-height) + 48px);
  }
  .left-section {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }
  .cover-wrapper {
    position: relative;
    width: min(100%, 380px);
    aspect-ratio: 1;
  }
  .cover {
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
    border-radius: 24px;
    object-fit: cover;
    box-shadow: 0 28px 60px rgb(8 18 35 / 0.25);
    position: relative;
    z-index: 1;
  }
  .cover-wrapper.rotation-enabled {
    overflow: hidden;
    border-radius: 50%;
    box-shadow: 0 28px 60px rgb(8 18 35 / 0.25);
  }
  .rotation-enabled .cover {
    border-radius: 0;
    box-shadow: none;
  }
  .cover-glow {
    display: none;
  }
  .right-section {
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-width: 0;
    text-align: center;
    transform: translateX(max(0px, calc((100vw - var(--player-content-max-width)) * 0.2)));
  }
  .track-meta {
    flex: 0 0 auto;
    margin: 0 0 32px;
    padding-top: 12px;
  }
  .track-name {
    font-size: clamp(26px, 2.8vw, 38px);
    line-height: 1.25;
    letter-spacing: -0.03em;
    margin-bottom: 10px;
    overflow-wrap: anywhere;
  }
  .track-artist {
    font-size: 15px;
    color: var(--color-text-secondary);
  }
  .track-album {
    margin-top: 5px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }
  .lyric-list {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 16px 20px 45%;
    scrollbar-gutter: stable both-edges;
    scroll-padding: 64px;
  }
  .lyric-list::-webkit-scrollbar-corner {
    background: transparent;
  }
  .lyric-line {
    padding: 12px 0;
    overflow-wrap: anywhere;
    color: var(--lyric-normal-color, var(--color-text-secondary));
    cursor: pointer;
    transition:
      color 220ms ease,
      transform 220ms ease;
    transform-origin: center center;
  }
  .lyric-original {
    font-size: var(--lyric-font-size, 24px);
    font-weight: 600;
    line-height: 1.65;
  }
  .lyric-translation {
    font-size: 14px;
    margin-top: 3px;
    font-weight: 400;
  }
  .lyric-time {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .lyric-line.active {
    color: var(--lyric-active-color, var(--color-text));
    transform: scale(1.025);
  }
  .lyric-line:hover {
    color: var(--lyric-normal-color, var(--color-primary));
  }
  .lyric-line.active:hover {
    color: var(--lyric-active-color, var(--color-primary));
  }
  .no-lyric {
    padding-block: 48px;
    color: var(--color-text-secondary);
    font-size: 15px;
  }
  @media (max-width: 1199px) {
    .player-content {
      padding-inline: 44px;
      gap: 40px;
      grid-template-columns: minmax(240px, 0.9fr) minmax(0, 1.1fr);
    }
    .track-meta {
      margin-bottom: 18px;
    }
  }
</style>
