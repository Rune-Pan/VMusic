// 参考 YesPlayMusic src/utils/Player.js
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { Howl, Howler } from 'howler'
import { getMP3, getTrackDetail, scrobble as scrobbleApi } from '@/api/track'
import { clearTrackSource } from '@/utils/db'
import { useUiStore } from '@/stores/ui'
import {
  STORAGE_KEYS,
  DEFAULT_VOLUME,
  PROGRESS_POLL_INTERVAL,
  PERSIST_DEBOUNCE_MS
} from '@/constants'

const HISTORY_MAX = 100

export const usePlayerStore = defineStore('player', () => {
  // State
  const currentTrack = ref(null)
  const playing = ref(false)
  const progress = ref(0)
  const volume = ref(DEFAULT_VOLUME)
  const volumeBeforeMuted = ref(DEFAULT_VOLUME) // 参考 YesPlayMusic: 保存静音前的音量
  const playlist = ref([])
  const currentIndex = ref(-1)
  const repeatMode = ref('off') // 'off' | 'on' | 'one'
  const shuffleMode = ref(false)
  const isLoading = ref(false)
  // 本地播放历史（参考 YesPlayMusic playHistory，但用 localStorage 存储）
  const playHistory = ref([])

  // 参考 YesPlayMusic: 内部 Howl 实例
  let _howler = null
  let _progressInterval = null
  let _lastListenDuration = 0 // 上一首歌的听歌时长（秒），用于 scrobble

  // Computed
  const hasTrack = computed(() => currentTrack.value !== null)
  // Howler 真实时长（试听片段可能短于 track.dt），onload 后写入
  // 未加载时返回 0，避免先显示假完整时长再跳变
  const actualDuration = ref(0)
  const duration = computed(() => actualDuration.value)
  const progressPercent = computed(() => {
    if (!duration.value) return 0
    return (progress.value / duration.value) * 100
  })

  // ========== 音频源获取 ==========
  // 参考 YesPlayMusic _getAudioSourceFromNetease
  async function _getAudioSource(track) {
    try {
      const result = await getMP3(track.id)
      if (!result.data?.[0]?.url) return null
      // 试听片段（非 VIP 拿到的 url 即片段）：可播，仅提示用户
      if (result.data[0].freeTrialInfo !== null) {
        useUiStore().showToast('当前为试听片段', 'warning')
      }
      // 参考 YesPlayMusic: 强制 https
      return result.data[0].url.replace(/^http:/, 'https:')
    } catch (e) {
      console.error('Failed to get audio source:', e)
      return null
    }
  }

  // 参考 YesPlayMusic _replaceCurrentTrack
  async function _replaceCurrentTrack(id, autoplay = true) {
    // 切歌前，上报上一首的听歌时长
    if (currentTrack.value) {
      _scrobble(currentTrack.value)
    }
    isLoading.value = true
    actualDuration.value = 0
    try {
      const data = await getTrackDetail(String(id))
      const track = data.songs?.[0]
      if (!track) {
        isLoading.value = false
        return
      }
      currentTrack.value = track
      // 记录到本地播放历史（参考 YesPlayMusic _scrobble 触发时机：切歌时记录）
      _recordHistory(track)
      _lastListenDuration = 0 // 新歌开始，重置听歌时长
      const source = await _getAudioSource(track)
      if (source) {
        _playAudioSource(source, autoplay, track)
      } else {
        playing.value = false
        isLoading.value = false
      }
    } catch (e) {
      console.error('Failed to replace track:', e)
      playing.value = false
      isLoading.value = false
    }
  }

  // 参考 YesPlayMusic _scrobble：记录播放历史
  function _recordHistory(track) {
    if (!track?.id) return
    // 移除已存在的同一首歌（去重）
    const existing = playHistory.value.findIndex(t => t.id === track.id)
    if (existing !== -1) {
      playHistory.value.splice(existing, 1)
    }
    // 添加到头部
    playHistory.value.unshift({
      id: track.id,
      name: track.name,
      ar: track.ar,
      al: track.al,
      dt: track.dt,
      playedAt: Date.now()
    })
    // 限制最大数量
    if (playHistory.value.length > HISTORY_MAX) {
      playHistory.value = playHistory.value.slice(0, HISTORY_MAX)
    }
    _persistHistory()
  }

  // 参考 YesPlayMusic _scrobble：上报到网易云服务端
  function _scrobble(track) {
    if (!track?.id) return
    try {
      scrobbleApi({
        id: track.id,
        sourceid: 0,
        time: Math.round(_lastListenDuration)
      })
    } catch {
      // 上报失败不影响播放
    }
  }

  function _persistHistory() {
    localStorage.setItem(
      STORAGE_KEYS.PLAY_HISTORY,
      JSON.stringify(playHistory.value)
    )
  }

  function _restoreHistory() {
    const saved = localStorage.getItem(STORAGE_KEYS.PLAY_HISTORY)
    if (!saved) return
    try {
      playHistory.value = JSON.parse(saved)
    } catch (e) {
      console.error('Failed to restore play history:', e)
    }
  }

  // 参考 YesPlayMusic _playAudioSource
  // track + retry 用于 url 失效时清缓存重拉一次
  function _playAudioSource(
    source,
    autoplay = true,
    track = null,
    retry = false
  ) {
    _stopProgressTimer()
    Howler.unload()
    _howler = new Howl({
      src: [source],
      html5: true,
      preload: true,
      format: ['mp3', 'flac'],
      volume: volume.value,
      onload: () => {
        isLoading.value = false
        // 试听片段实际时长可能短于元数据 dt，用 Howler 真实值
        actualDuration.value = (_howler.duration() || 0) * 1000
        if (autoplay) {
          _howler.play()
          playing.value = true
          _startProgressTimer()
        }
      },
      onloaderror: async (_id, errCode) => {
        console.error('Audio load error:', errCode)
        // url 可能已失效，清缓存重拉一次（仅重试一次防死循环）
        if (track && !retry) {
          clearTrackSource(track.id).catch(() => {})
          try {
            const newSource = await _getAudioSource(track)
            if (newSource) {
              _playAudioSource(newSource, autoplay, track, true)
              return
            }
          } catch (e) {
            console.error('Retry failed:', e)
          }
        }
        isLoading.value = false
        playing.value = false
      },
      onplayerror: (_id, errCode) => {
        console.error('Audio play error:', errCode)
        isLoading.value = false
        playing.value = false
      },
      onend: () => {
        _nextTrackCallback()
      }
    })
  }

  // 参考 YesPlayMusic _nextTrackCallback
  function _nextTrackCallback() {
    if (repeatMode.value === 'one') {
      // 单曲循环：重新播放当前曲目
      _howler?.seek(0)
      _howler?.play()
      playing.value = true
      progress.value = 0
    } else {
      // 歌曲自然播放结束，记录完整时长用于 scrobble
      _lastListenDuration = (currentTrack.value?.dt || 0) / 1000
      _playNextTrack()
    }
  }

  function _startProgressTimer() {
    _stopProgressTimer()
    _progressInterval = setInterval(() => {
      if (_howler?.playing()) {
        progress.value = (_howler.seek() || 0) * 1000 // Howler seek 返回秒
      }
    }, PROGRESS_POLL_INTERVAL)
  }

  function _stopProgressTimer() {
    if (_progressInterval) {
      clearInterval(_progressInterval)
      _progressInterval = null
    }
  }

  function _playNextTrack() {
    if (shuffleMode.value && playlist.value.length > 1) {
      let nextIndex = Math.floor(Math.random() * playlist.value.length)
      while (nextIndex === currentIndex.value) {
        nextIndex = Math.floor(Math.random() * playlist.value.length)
      }
      _playTrackAtIndex(nextIndex)
      return
    }
    const nextIndex = currentIndex.value + 1
    if (nextIndex >= playlist.value.length) {
      if (repeatMode.value === 'on') {
        // 列表循环
        _playTrackAtIndex(0)
      } else {
        playing.value = false
        progress.value = 0
      }
    } else {
      _playTrackAtIndex(nextIndex)
    }
  }

  async function _playTrackAtIndex(index) {
    const track = playlist.value[index]
    if (!track) return
    // 检查歌曲是否可播放
    if (track.playable === false) {
      const uiStore = useUiStore()
      uiStore.showToast(track.reason || '该歌曲暂时无法播放', 'warning')
      return
    }
    currentIndex.value = index
    await _replaceCurrentTrack(track.id, true)
  }

  // ========== 公开 API ==========

  async function play(track, list = []) {
    // 检查歌曲是否可播放
    if (track.playable === false) {
      const uiStore = useUiStore()
      uiStore.showToast(track.reason || '该歌曲暂时无法播放', 'warning')
      return
    }
    _lastListenDuration = _howler?.seek() || 0
    if (list.length > 0) {
      // 浅拷贝断开引用：避免外部数组（如 likedTracks）被 splice 联动修改
      playlist.value = [...list]
      currentIndex.value = list.findIndex(t => t.id === track.id)
    }
    progress.value = 0
    await _replaceCurrentTrack(track.id, true)
    persist()
  }

  function pause() {
    _howler?.pause()
    playing.value = false
    _stopProgressTimer()
  }

  function resume() {
    _howler?.play()
    playing.value = true
    _startProgressTimer()
  }

  function togglePlay() {
    if (playing.value) {
      pause()
    } else {
      if (_howler) {
        resume()
      } else if (currentTrack.value) {
        _replaceCurrentTrack(currentTrack.value.id, true)
      }
    }
  }

  function next() {
    if (playlist.value.length === 0) return
    _lastListenDuration = _howler?.seek() || 0
    _playNextTrack()
    persist()
  }

  function prev() {
    if (playlist.value.length === 0) return
    _lastListenDuration = _howler?.seek() || 0
    const prevIndex =
      currentIndex.value <= 0
        ? playlist.value.length - 1
        : currentIndex.value - 1
    _playTrackAtIndex(prevIndex)
    persist()
  }

  function seek(time) {
    // time 为毫秒
    const seconds = time / 1000
    if (_howler) {
      _howler.seek(seconds)
    }
    progress.value = time
  }

  function setVolume(val) {
    const v = Math.max(0, Math.min(1, val))
    volume.value = v
    Howler.volume(v)
    persist()
  }

  // 参考 YesPlayMusic: 静音/取消静音，保存和恢复静音前的音量
  function toggleMute() {
    if (volume.value > 0) {
      volumeBeforeMuted.value = volume.value
      setVolume(0)
    } else {
      setVolume(volumeBeforeMuted.value)
    }
  }

  async function setPlaylist(list, startIndex = 0) {
    // 浅拷贝断开引用：避免外部数组被 splice 联动修改
    playlist.value = [...list]
    currentIndex.value = startIndex
    const track = list[startIndex]
    if (track) {
      progress.value = 0
      await _replaceCurrentTrack(track.id, true)
    }
    persist()
  }

  // 下一首播放：把曲目插到当前播放曲目之后，不立即切歌
  function playNext(track) {
    if (!track) return
    // 已在列表中则先移除，保证唯一
    const filtered = playlist.value.filter(t => t.id !== track.id)
    const insertIndex = currentIndex.value + 1
    filtered.splice(insertIndex, 0, track)
    playlist.value = filtered
    // 若移除的是当前曲目前面的歌，索引不变；这里插在后面，currentIndex 无需调整
    persist()
  }

  // 从播放列表移除指定 index 的曲目
  // 删的是当前播放：列表非空则播同 index 的新曲目（越界回退最后一首）；空列表则停止
  async function removeFromPlaylist(index) {
    if (index < 0 || index >= playlist.value.length) return
    const wasCurrent = index === currentIndex.value
    playlist.value.splice(index, 1)
    if (playlist.value.length === 0) {
      // 列表空：停止 Howler + 计时器，仅改 playing 标记会导致音频继续播
      currentIndex.value = -1
      _howler?.pause()
      _stopProgressTimer()
      playing.value = false
      progress.value = 0
      persist()
      return
    }
    if (wasCurrent) {
      // 删当前：index 保持，指向原下一首；越界则回退最后一首
      currentIndex.value = Math.min(index, playlist.value.length - 1)
      progress.value = 0
      await _replaceCurrentTrack(playlist.value[currentIndex.value].id, true)
    } else if (index < currentIndex.value) {
      // 删在当前之前：后面的整体前移，索引减 1
      currentIndex.value -= 1
    }
    persist()
  }

  function toggleRepeat() {
    const modes = ['off', 'on', 'one']
    const idx = modes.indexOf(repeatMode.value)
    repeatMode.value = modes[(idx + 1) % modes.length]
    persist()
  }

  function toggleShuffle() {
    shuffleMode.value = !shuffleMode.value
    persist()
  }

  // 轻量持久化：仅保存设置项（音量、循环、随机），不含播放列表
  function _persistSettings() {
    localStorage.setItem(
      STORAGE_KEYS.PLAYER,
      JSON.stringify({
        volume: volume.value,
        volumeBeforeMuted: volumeBeforeMuted.value,
        repeatMode: repeatMode.value,
        shuffleMode: shuffleMode.value,
        currentTrack: currentTrack.value,
        playlist: playlist.value,
        currentIndex: currentIndex.value
      })
    )
  }

  let _persistTimer = null
  function persist() {
    if (_persistTimer) clearTimeout(_persistTimer)
    _persistTimer = setTimeout(_persistSettings, PERSIST_DEBOUNCE_MS)
  }

  function restore() {
    const saved = localStorage.getItem(STORAGE_KEYS.PLAYER)
    if (!saved) return
    try {
      const data = JSON.parse(saved)
      volume.value = data.volume ?? DEFAULT_VOLUME
      Howler.volume(volume.value)
      volumeBeforeMuted.value = data.volumeBeforeMuted ?? DEFAULT_VOLUME
      repeatMode.value = data.repeatMode ?? 'off'
      shuffleMode.value = data.shuffleMode ?? false
      // 恢复播放状态（不自动播放）
      if (data.currentTrack) {
        currentTrack.value = data.currentTrack
      }
      if (data.playlist && Array.isArray(data.playlist)) {
        playlist.value = data.playlist
      }
      if (data.currentIndex !== undefined && data.currentIndex >= 0) {
        currentIndex.value = data.currentIndex
      }
    } catch (e) {
      console.error('Failed to restore player state:', e)
    }
    _restoreHistory()
  }

  function clearHistory() {
    playHistory.value = []
    _persistHistory()
  }

  return {
    currentTrack,
    playing,
    progress,
    volume,
    playlist,
    currentIndex,
    repeatMode,
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
    shuffleMode,
    toggleShuffle,
    restore,
    clearHistory
  }
})
