import { ref, computed, onScopeDispose } from 'vue'
import { defineStore } from 'pinia'
import { Howl, Howler } from 'howler'
import { getMP3, getTrackDetail, scrobble as scrobbleApi } from '@/api/track'
import { clearTrackSource } from '@/utils/db'
import { useUiStore } from '@/stores/ui'
import {
  STORAGE_KEYS,
  DEFAULT_VOLUME,
  PROGRESS_POLL_INTERVAL
} from '@/constants'

const HISTORY_MAX = 100
const SAVE_INTERVAL = 5000
const sameTrack = (a, b) => a != null && b != null && String(a) === String(b)
const validTrack = track =>
  track && Number.isSafeInteger(Number(track.id)) && Number(track.id) > 0
const nonnegative = value => (Number.isFinite(value) && value >= 0 ? value : 0)

export const usePlayerStore = defineStore('player', () => {
  const currentTrack = ref(null)
  const playing = ref(false)
  const progress = ref(0)
  const volume = ref(DEFAULT_VOLUME)
  const volumeBeforeMuted = ref(DEFAULT_VOLUME)
  const playlist = ref([])
  const currentIndex = ref(-1)
  const repeatMode = ref('off')
  const shuffleMode = ref(false)
  const isLoading = ref(false)
  const playHistory = ref([])
  const actualDuration = ref(0)
  const hasTrack = computed(() => currentTrack.value !== null)
  const duration = computed(() => actualDuration.value)
  const progressPercent = computed(() =>
    duration.value ? (progress.value / duration.value) * 100 : 0
  )

  let sound = null
  let progressTimer = null
  let generation = 0
  let activeRequest = null
  const wantsPlay = ref(false)
  let automaticRun = null
  let lastSavedAt = 0
  let restored = false

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.PLAYER,
        JSON.stringify({
          volume: volume.value,
          volumeBeforeMuted: volumeBeforeMuted.value,
          repeatMode: repeatMode.value,
          shuffleMode: shuffleMode.value,
          currentTrack: currentTrack.value,
          playlist: playlist.value,
          currentIndex: currentIndex.value,
          progressMs: progress.value,
          durationMs: actualDuration.value
        })
      )
      lastSavedAt = Date.now()
    } catch {
      // 浏览器存储不可用时，仍允许本次会话播放。
    }
  }

  function captureProgress() {
    // 暂停后的 seek 可能仍在原生音频队列中，保留已确认的用户选择。
    if (playing.value && sound?.state() === 'loaded') {
      progress.value = nonnegative(Number(sound.seek()) * 1000)
    }
  }

  function stopTimer() {
    clearInterval(progressTimer)
    progressTimer = null
  }

  function releaseSound() {
    stopTimer()
    const previous = sound
    sound = null
    previous?.off()
    previous?.unload()
  }

  function saveOnExit() {
    captureProgress()
    persist()
  }

  function persistHistory() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.PLAY_HISTORY,
        JSON.stringify(playHistory.value)
      )
    } catch {
      // 历史写入失败不影响音频。
    }
  }

  function recordHistory(track) {
    playHistory.value = playHistory.value.filter(
      item => !sameTrack(item.id, track.id)
    )
    playHistory.value.unshift({
      id: track.id,
      name: track.name,
      ar: track.ar,
      al: track.al,
      dt: track.dt,
      playedAt: Date.now()
    })
    playHistory.value = playHistory.value.slice(0, HISTORY_MAX)
    persistHistory()
  }

  function reportCurrent() {
    if (!activeRequest?.heard || !currentTrack.value) return
    captureProgress()
    scrobbleApi({
      id: currentTrack.value.id,
      sourceid: 0,
      time: Math.round(progress.value / 1000)
    }).catch(() => {})
  }

  function nextIndex(attempted = new Set()) {
    if (shuffleMode.value && playlist.value.length > 1) {
      const candidates = playlist.value
        .map((track, index) => ({ track, index }))
        .filter(
          ({ track, index }) =>
            index !== currentIndex.value && !attempted.has(String(track.id))
        )
      return candidates.length
        ? candidates[Math.floor(Math.random() * candidates.length)].index
        : -1
    }
    for (let offset = 1; offset <= playlist.value.length; offset++) {
      let index = currentIndex.value + offset
      if (index >= playlist.value.length) {
        if (repeatMode.value !== 'on') return -1
        index %= playlist.value.length
      }
      if (!attempted.has(String(playlist.value[index].id))) return index
    }
    return -1
  }

  function stopWithMessage(message) {
    wantsPlay.value = false
    automaticRun = null
    playing.value = false
    isLoading.value = false
    releaseSound()
    persist()
    if (message) useUiStore().showToast(message, 'warning')
  }

  async function advance(run) {
    if (!wantsPlay.value || automaticRun !== run) return
    const index = nextIndex(run.attempted)
    if (index === -1) {
      stopWithMessage(run.attempted.size ? '队列中没有可继续播放的歌曲' : '')
      return
    }
    await selectTrack(index, { run })
  }

  async function fail(request, message) {
    if (request.token !== generation) return
    playing.value = false
    isLoading.value = false
    releaseSound()
    persist()
    if (request.run && automaticRun === request.run && wantsPlay.value) {
      // 已知不可播项可能连续出现，让出调用栈再继续，避免递归溢出。
      await Promise.resolve()
      if (request.token === generation) await advance(request.run)
    } else {
      stopWithMessage(message)
    }
  }

  async function loadSource(request, forceRefresh = false) {
    const result = await getMP3(request.track.id, undefined, { forceRefresh })
    if (request.token !== generation) return
    const item = result.data?.[0]
    if (!item?.url) {
      await fail(request, '该歌曲没有可用音源')
      return
    }
    if (item.freeTrialInfo != null)
      useUiStore().showToast('当前为试听片段', 'warning')
    createSound(item.url.replace(/^http:/, 'https:'), request)
  }

  function createSound(source, request) {
    releaseSound()
    const instance = new Howl({
      src: [source],
      html5: true,
      preload: true,
      format: ['mp3', 'flac'],
      volume: volume.value,
      onload() {
        if (!isActive()) return
        isLoading.value = false
        actualDuration.value = nonnegative(instance.duration() * 1000)
        progress.value =
          actualDuration.value > request.startAt ? request.startAt : 0
        instance.seek(progress.value / 1000)
        persist()
        if (wantsPlay.value) instance.play()
      },
      onplay() {
        if (!isActive()) return
        if (!wantsPlay.value) {
          instance.pause()
          return
        }
        playing.value = true
        if (!request.heard) {
          request.heard = true
          recordHistory(request.track)
        }
        stopTimer()
        progressTimer = setInterval(() => {
          if (!isActive() || !instance.playing()) return
          captureProgress()
          if (Date.now() - lastSavedAt >= SAVE_INTERVAL) persist()
        }, PROGRESS_POLL_INTERVAL)
        persist()
      },
      onpause() {
        if (!isActive()) return
        playing.value = false
        stopTimer()
      },
      onloaderror() {
        if (isActive()) retrySource(request)
      },
      onplayerror() {
        if (!isActive()) return
        // 浏览器用户手势限制不能当作坏歌扫描整个队列。
        stopWithMessage('播放未能开始，请点击播放重试')
      },
      onend() {
        if (!isActive() || !wantsPlay.value) return
        stopTimer()
        playing.value = false
        progress.value = actualDuration.value
        persist()
        const run = { attempted: new Set() }
        automaticRun = run
        if (repeatMode.value === 'one') {
          run.attempted.add(String(request.track.id))
          request.run = run
          progress.value = 0
          instance.seek(0)
          instance.play()
        } else advance(run)
      }
    })
    sound = instance
    function isActive() {
      return request.token === generation && sound === instance
    }
  }

  async function retrySource(request) {
    if (request.retried) {
      await fail(request, '音源加载失败，请稍后重试')
      return
    }
    request.retried = true
    captureProgress()
    request.startAt = progress.value
    releaseSound()
    playing.value = false
    isLoading.value = true
    await clearTrackSource(request.track.id).catch(() => {})
    if (request.token !== generation) return
    try {
      await loadSource(request, true)
    } catch {
      await fail(request, '音源加载失败，请稍后重试')
    }
  }

  async function selectTrack(index, { run = null, startAt = 0 } = {}) {
    const track = playlist.value[index]
    if (!track) return
    reportCurrent()
    const request = {
      token: ++generation,
      track,
      run,
      startAt,
      heard: false,
      retried: false
    }
    activeRequest = request
    releaseSound()
    automaticRun = run
    wantsPlay.value = true
    currentIndex.value = index
    currentTrack.value = track
    progress.value = startAt
    actualDuration.value = 0
    playing.value = false
    isLoading.value = true
    run?.attempted.add(String(track.id))
    persist()
    if (track.playable === false) {
      await fail(request, track.reason || '该歌曲暂时无法播放')
      return
    }
    try {
      const data = await getTrackDetail(String(track.id))
      if (request.token !== generation) return
      const detail = data.songs?.[0]
      if (!detail || detail.playable === false) {
        await fail(request, detail?.reason || '该歌曲暂时无法播放')
        return
      }
      request.track = detail
      currentTrack.value = detail
      // 等待期间队列可能移动，按身份重新定位。
      currentIndex.value = playlist.value.findIndex(item =>
        sameTrack(item.id, detail.id)
      )
      playlist.value[currentIndex.value] = { ...track, ...detail }
      persist()
      await loadSource(request)
    } catch {
      await fail(request, '歌曲加载失败，请检查网络后重试')
    }
  }

  async function play(track, list = []) {
    if (!validTrack(track)) return
    const index = list.findIndex(item => sameTrack(item.id, track.id))
    playlist.value = index >= 0 ? [...list] : [track]
    await selectTrack(index >= 0 ? index : 0)
  }

  function pause() {
    wantsPlay.value = false
    automaticRun = null
    captureProgress()
    sound?.pause()
    playing.value = false
    stopTimer()
    persist()
  }

  function resume() {
    if (!currentTrack.value) return
    wantsPlay.value = true
    automaticRun = null
    if (sound?.state() === 'loaded') sound.play()
    else if (!isLoading.value)
      return selectTrack(currentIndex.value, { startAt: progress.value })
  }

  function togglePlay() {
    if (wantsPlay.value || playing.value) pause()
    else return resume()
  }

  function next() {
    if (!playlist.value.length) return
    const index = nextIndex()
    if (index < 0) {
      pause()
      return
    }
    return selectTrack(index)
  }

  function prev() {
    if (!playlist.value.length) return
    return selectTrack(
      currentIndex.value <= 0
        ? playlist.value.length - 1
        : currentIndex.value - 1
    )
  }

  function seek(time) {
    const position = nonnegative(time)
    progress.value = duration.value
      ? Math.min(position, duration.value)
      : position
    if (activeRequest) activeRequest.startAt = progress.value
    if (sound?.state() === 'loaded') sound.seek(progress.value / 1000)
    persist()
  }

  function setVolume(value) {
    volume.value = Math.max(0, Math.min(1, nonnegative(value)))
    Howler.volume(volume.value)
    persist()
  }

  function toggleMute() {
    if (volume.value > 0) {
      volumeBeforeMuted.value = volume.value
      setVolume(0)
    } else setVolume(volumeBeforeMuted.value)
  }

  async function setPlaylist(list, startIndex = 0) {
    if (!list.length) {
      generation++
      activeRequest = null
      playlist.value = []
      currentTrack.value = null
      currentIndex.value = -1
      progress.value = 0
      actualDuration.value = 0
      stopWithMessage('')
      return
    }
    playlist.value = [...list]
    await selectTrack(Math.max(0, Math.min(startIndex, list.length - 1)))
  }

  function playNext(track) {
    if (!validTrack(track) || sameTrack(track.id, currentTrack.value?.id))
      return
    const filtered = playlist.value.filter(
      item => !sameTrack(item.id, track.id)
    )
    const index = filtered.findIndex(item =>
      sameTrack(item.id, currentTrack.value?.id)
    )
    filtered.splice(index + 1, 0, track)
    playlist.value = filtered
    currentIndex.value = index
    persist()
  }

  async function removeFromPlaylist(index) {
    if (index < 0 || index >= playlist.value.length) return
    const wasCurrent = index === currentIndex.value
    playlist.value.splice(index, 1)
    if (!playlist.value.length) return setPlaylist([])
    if (wasCurrent)
      return selectTrack(Math.min(index, playlist.value.length - 1))
    currentIndex.value = playlist.value.findIndex(item =>
      sameTrack(item.id, currentTrack.value?.id)
    )
    persist()
  }

  function toggleRepeat() {
    const modes = ['off', 'on', 'one']
    repeatMode.value =
      modes[(modes.indexOf(repeatMode.value) + 1) % modes.length]
    persist()
  }

  function toggleShuffle() {
    shuffleMode.value = !shuffleMode.value
    persist()
  }

  function restore() {
    if (restored) return
    restored = true
    try {
      const data = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.PLAYER) || 'null'
      )
      if (data && typeof data === 'object') {
        volume.value = Number.isFinite(data.volume)
          ? Math.max(0, Math.min(1, data.volume))
          : DEFAULT_VOLUME
        volumeBeforeMuted.value =
          Number.isFinite(data.volumeBeforeMuted) && data.volumeBeforeMuted > 0
            ? Math.min(1, data.volumeBeforeMuted)
            : DEFAULT_VOLUME
        Howler.volume(volume.value)
        repeatMode.value = ['off', 'on', 'one'].includes(data.repeatMode)
          ? data.repeatMode
          : 'off'
        shuffleMode.value = data.shuffleMode === true
        playlist.value = Array.isArray(data.playlist)
          ? data.playlist.filter(validTrack)
          : []
        if (validTrack(data.currentTrack)) {
          currentIndex.value = playlist.value.findIndex(item =>
            sameTrack(item.id, data.currentTrack.id)
          )
          if (currentIndex.value < 0) {
            playlist.value.unshift(data.currentTrack)
            currentIndex.value = 0
          }
        } else if (playlist.value.length) {
          currentIndex.value = Number.isInteger(data.currentIndex)
            ? Math.max(
                0,
                Math.min(data.currentIndex, playlist.value.length - 1)
              )
            : 0
        }
        currentTrack.value = playlist.value[currentIndex.value] || null
        progress.value = currentTrack.value ? nonnegative(data.progressMs) : 0
        actualDuration.value = currentTrack.value
          ? nonnegative(data.durationMs)
          : 0
      }
    } catch {
      // 不删除损坏记录或其他个人数据，使用当前会话默认值。
    }
    try {
      const history = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.PLAY_HISTORY) || '[]'
      )
      if (Array.isArray(history))
        playHistory.value = history.filter(validTrack).slice(0, HISTORY_MAX)
    } catch {
      // 播放器记录损坏不应阻止独立恢复历史。
    }
  }

  function clearHistory() {
    playHistory.value = []
    persistHistory()
  }

  window.addEventListener('pagehide', saveOnExit)
  onScopeDispose(() => {
    saveOnExit()
    generation++
    wantsPlay.value = false
    releaseSound()
    window.removeEventListener('pagehide', saveOnExit)
  })

  return {
    currentTrack,
    playing,
    wantsPlay,
    progress,
    volume,
    playlist,
    currentIndex,
    repeatMode,
    shuffleMode,
    isLoading,
    playHistory,
    hasTrack,
    duration,
    progressPercent,
    play,
    pause,
    resume,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    setPlaylist,
    playNext,
    removeFromPlaylist,
    toggleRepeat,
    toggleShuffle,
    restore,
    clearHistory
  }
})
