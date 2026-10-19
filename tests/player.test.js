import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, disposePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { usePlayerStore } from '@/stores/player'
import { getMP3, getTrackDetail, scrobble } from '@/api/track'
import { clearTrackSource } from '@/utils/db'
import { STORAGE_KEYS } from '@/constants'

const audio = vi.hoisted(() => ({ instances: [] }))
vi.mock('howler', () => ({
  Howler: { volume: vi.fn() },
  Howl: class {
    constructor(options) {
      this.options = options
      this.seconds = 0
      this.length = 180
      this.loaded = false
      this.audible = false
      this.play = vi.fn(() => {
        this.audible = true
        options.onplay()
      })
      this.pause = vi.fn(() => {
        this.audible = false
        options.onpause()
      })
      this.unload = vi.fn(() => {
        this.audible = false
      })
      this.off = vi.fn()
      audio.instances.push(this)
    }
    state() {
      return this.loaded ? 'loaded' : 'loading'
    }
    seek(value) {
      if (value !== undefined) this.seconds = value
      return this.seconds
    }
    duration() {
      return this.length
    }
    playing() {
      return this.audible
    }
    emit(event) {
      if (event === 'load') this.loaded = true
      if (event === 'end') {
        this.audible = false
        this.seconds = this.length
      }
      this.options[`on${event}`]()
    }
  }
}))
vi.mock('@/api/track', () => ({
  getMP3: vi.fn(),
  getTrackDetail: vi.fn(),
  scrobble: vi.fn()
}))
vi.mock('@/utils/db', () => ({ clearTrackSource: vi.fn() }))
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/stores/ui', () => ({ useUiStore: () => ({ showToast: toast }) }))

const track = id => ({ id, name: `Track ${id}`, dt: 180000, ar: [], al: {} })
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
let pinia, player
const latest = () => audio.instances.at(-1)
const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYER))
function expectProgressTimersStopped() {
  const timers = globalThis.setInterval.mock.results
  expect(timers.length).toBeGreaterThan(0)
  for (const timer of timers) {
    expect(globalThis.clearInterval).toHaveBeenCalledWith(timer.value)
  }
}
async function start(id = 1, list = [track(1), track(2), track(3)]) {
  await player.play(track(id), list)
  latest().emit('load')
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(globalThis, 'setInterval')
  vi.spyOn(globalThis, 'clearInterval')
  localStorage.clear()
  audio.instances.length = 0
  pinia = createPinia()
  setActivePinia(pinia)
  getTrackDetail.mockImplementation(async id => ({
    songs: [track(Number(id))]
  }))
  getMP3.mockImplementation(async id => ({
    data: [{ url: `https://audio/${id}`, freeTrialInfo: null }]
  }))
  clearTrackSource.mockResolvedValue()
  scrobble.mockResolvedValue({})
  player = usePlayerStore()
})
afterEach(() => disposePinia(pinia))

describe('最新选择和真实音频事件', () => {
  it('详情乱序时，只有最后选择可以获取音源和写入当前状态', async () => {
    const a = deferred()
    getTrackDetail.mockImplementation(id =>
      id === '1' ? a.promise : Promise.resolve({ songs: [track(2)] })
    )
    const first = player.play(track(1))
    await player.play(track(2))
    latest().emit('load')
    a.resolve({ songs: [track(1)] })
    await first
    expect(player.currentTrack.id).toBe(2)
    expect(getMP3).toHaveBeenCalledTimes(1)
    expect(player.playHistory.map(t => t.id)).toEqual([2])
  })

  it('音源乱序时，旧音源不能创建音频实例', async () => {
    const a = deferred()
    getMP3.mockImplementation(id =>
      id === 1
        ? a.promise
        : Promise.resolve({ data: [{ url: 'https://audio/2' }] })
    )
    const first = player.play(track(1))
    await flushPromises()
    await player.play(track(2))
    a.resolve({ data: [{ url: 'https://audio/1' }] })
    await first
    expect(audio.instances).toHaveLength(1)
    expect(latest().options.src).toEqual(['https://audio/2'])
  })

  it('手动切歌立即停止旧声音，旧实例回调不能修改新状态', async () => {
    await start()
    const old = latest()
    await player.next()
    expect(old.unload).toHaveBeenCalledTimes(1)
    expect(player.playing).toBe(false)
    old.emit('loaderror')
    old.emit('end')
    old.emit('playerror')
    expect(clearTrackSource).not.toHaveBeenCalled()
    expect(player.currentTrack.id).toBe(2)
    latest().emit('load')
    expect(player.playing).toBe(true)
  })

  it('播放状态等待 onplay；加载中点击暂停不会随后出声', async () => {
    await player.play(track(1))
    expect(player.playing).toBe(false)
    expect(player.wantsPlay).toBe(true)
    player.togglePlay()
    latest().emit('load')
    expect(latest().play).not.toHaveBeenCalled()
    expect(player.playing).toBe(false)
    player.resume()
    expect(player.playing).toBe(true)
  })

  it('详情请求尚未完成时暂停也能保持暂停', async () => {
    const response = deferred()
    getTrackDetail.mockReturnValueOnce(response.promise)
    const pending = player.play(track(1))
    player.pause()
    response.resolve({ songs: [track(1)] })
    await pending
    latest().emit('load')
    expect(latest().play).not.toHaveBeenCalled()
  })
})

describe('队列身份和边界', () => {
  it('把当前项前面的歌移动到下一首，保持当前项身份和正确顺序', async () => {
    await start(3, [1, 2, 3, 4].map(track))
    player.playNext(track(1))
    expect(player.playlist.map(t => t.id)).toEqual([2, 3, 1, 4])
    expect(player.currentIndex).toBe(1)
    player.playNext(track(4))
    expect(player.playlist.map(t => t.id)).toEqual([2, 3, 4, 1])
    player.playNext(track(3))
    expect(player.playlist.map(t => t.id)).toEqual([2, 3, 4, 1])
    expect(player.currentTrack.id).toBe(3)
  })

  it('无列表或列表不包含目标时建立单曲队列', async () => {
    await player.play(track(2))
    expect(player.playlist.map(t => t.id)).toEqual([2])
    await player.play(track(3), [track(1)])
    expect(player.playlist.map(t => t.id)).toEqual([3])
    expect(player.currentIndex).toBe(0)
  })

  it('删除当前项前面的歌曲或当前项后，索引仍指向当前曲目', async () => {
    await start(2)
    await player.removeFromPlaylist(0)
    expect(player.currentIndex).toBe(0)
    expect(player.currentTrack.id).toBe(2)
    await player.removeFromPlaylist(0)
    expect(player.currentTrack.id).toBe(3)
    expect(player.currentIndex).toBe(0)
  })

  it('删除最后一项释放音频和计时器，不能再恢复旧歌', async () => {
    await start(1, [track(1)])
    const old = latest()
    await player.removeFromPlaylist(0)
    player.togglePlay()
    old.emit('load')
    expect(player.currentTrack).toBeNull()
    expect(player.currentIndex).toBe(-1)
    expect(player.playing).toBe(false)
    expect(old.unload).toHaveBeenCalled()
    expectProgressTimersStopped()
  })

  it('清空队列作废尚未返回的请求', async () => {
    const pending = deferred()
    getTrackDetail.mockReturnValueOnce(pending.promise)
    const operation = player.play(track(1))
    await player.setPlaylist([])
    pending.resolve({ songs: [track(1)] })
    await operation
    expect(audio.instances).toHaveLength(0)
    expect(player.currentTrack).toBeNull()
  })
})

describe('失败与有限重试', () => {
  it('等待删除缓存再强制刷新音源，每曲最多刷新一次', async () => {
    await start()
    const cleared = deferred()
    clearTrackSource.mockReturnValueOnce(cleared.promise)
    latest().emit('loaderror')
    await flushPromises()
    expect(getMP3).toHaveBeenCalledTimes(1)
    cleared.resolve()
    await flushPromises()
    expect(getMP3).toHaveBeenLastCalledWith(1, undefined, {
      forceRefresh: true
    })
    latest().emit('loaderror')
    await flushPromises()
    expect(getMP3).toHaveBeenCalledTimes(2)
    expect(player.playing).toBe(false)
    expect(player.isLoading).toBe(false)
    expect(toast).toHaveBeenCalledTimes(1)
  })

  it('旧歌清缓存期间切歌，旧重试不能获取或卸载新音源', async () => {
    await start()
    const cleared = deferred()
    clearTrackSource.mockReturnValueOnce(cleared.promise)
    latest().emit('loaderror')
    await player.next()
    const current = latest()
    current.emit('load')
    cleared.resolve()
    await flushPromises()
    expect(current.unload).not.toHaveBeenCalled()
    expect(player.currentTrack.id).toBe(2)
    expect(getMP3).toHaveBeenCalledTimes(2)
  })

  it('手动下一首失败停在所选曲目，不自动找第三首', async () => {
    await start()
    getMP3.mockResolvedValueOnce({ data: [] })
    await player.next()
    expect(player.currentTrack.id).toBe(2)
    expect(player.playing).toBe(false)
    expect(getMP3).toHaveBeenCalledTimes(2)
    expect(player.currentIndex).toBe(1)
  })

  it('自动连播跳过无音源歌曲，继续下一首', async () => {
    await start()
    getMP3.mockImplementation(async id => ({
      data: id === 2 ? [] : [{ url: `https://audio/${id}` }]
    }))
    latest().emit('end')
    await flushPromises()
    expect(player.currentTrack.id).toBe(3)
    latest().emit('load')
    expect(player.playing).toBe(true)
  })

  it.each(['loop', 'shuffle'])(
    '%s 整队失败后停止，每首只尝试一次',
    async mode => {
      await start()
      if (mode === 'loop') player.toggleRepeat()
      else player.toggleShuffle()
      getMP3.mockResolvedValue({ data: [] })
      getMP3.mockClear()
      latest().emit('end')
      await flushPromises()
      expect(player.playing).toBe(false)
      expect(player.isLoading).toBe(false)
      const ids = getMP3.mock.calls.map(([id]) => id)
      expect(ids).toHaveLength(new Set(ids).size)
      expect(ids).toHaveLength(3)
      expect(toast).toHaveBeenCalledTimes(1)
      expectProgressTimersStopped()
    }
  )

  it('自动跳过等待请求时暂停，失败返回也不继续扫描', async () => {
    await start()
    const response = deferred()
    getMP3.mockReturnValueOnce(response.promise)
    latest().emit('end')
    await flushPromises()
    player.pause()
    response.resolve({ data: [] })
    await flushPromises()
    expect(player.currentTrack.id).toBe(2)
    expect(getMP3).toHaveBeenCalledTimes(2)
  })

  it('浏览器播放权限失败等待用户，不自动跳过', async () => {
    await start()
    latest().emit('playerror')
    await flushPromises()
    expect(player.playing).toBe(false)
    expect(player.currentTrack.id).toBe(1)
    expect(getMP3).toHaveBeenCalledTimes(1)
  })

  it('单曲正常循环复用音频，加载失败后有界重试并跳过', async () => {
    await start()
    player.toggleRepeat()
    player.toggleRepeat()
    const first = latest()
    first.emit('end')
    expect(first.play).toHaveBeenCalledTimes(2)
    expect(getMP3).toHaveBeenCalledTimes(1)
    first.emit('loaderror')
    await flushPromises()
    latest().emit('loaderror')
    await flushPromises()
    expect(player.currentTrack.id).toBe(2)
    expect(player.repeatMode).toBe('one')
    expect(getMP3.mock.calls.map(([id]) => id)).toEqual([1, 1, 2])
  })

  it('手动上一首遇已知不可播项会停住，而不是保留旧声音', async () => {
    await start(2, [{ ...track(1), playable: false }, track(2), track(3)])
    const old = latest()
    await player.prev()
    expect(old.unload).toHaveBeenCalled()
    expect(player.currentTrack.id).toBe(1)
    expect(player.playing).toBe(false)
    expect(getMP3).toHaveBeenCalledTimes(1)
  })
})

describe('持久化与恢复', () => {
  it('每五秒保存，暂停、拖动和 pagehide 立即保存实际进度', async () => {
    await start()
    latest().seconds = 12
    await vi.advanceTimersByTimeAsync(5000)
    expect(saved().progressMs).toBe(12000)
    latest().seconds = 14
    player.pause()
    expect(saved().progressMs).toBe(14000)
    player.seek(18000)
    expect(saved().progressMs).toBe(18000)
    player.resume()
    latest().seconds = 21
    window.dispatchEvent(new Event('pagehide'))
    expect(saved().progressMs).toBe(21000)
  })

  it('自动换曲后立即保存同一曲目和索引', async () => {
    await start()
    latest().emit('end')
    await flushPromises()
    expect(saved().currentTrack.id).toBe(2)
    expect(saved().playlist[saved().currentIndex].id).toBe(2)
  })

  it('暂停后 seek 尚未应用到原生音频时，pagehide 保留用户选定位置', async () => {
    await start()
    player.pause()
    vi.spyOn(latest(), 'seek').mockReturnValue(0)
    player.seek(18000)
    window.dispatchEvent(new Event('pagehide'))
    expect(saved().progressMs).toBe(18000)
  })

  it.each([15000, 90000])(
    '恢复 %i ms 默认暂停，实际试听时长决定续播位置',
    async position => {
      localStorage.setItem(
        STORAGE_KEYS.PLAYER,
        JSON.stringify({
          currentTrack: track(1),
          playlist: [track(1)],
          currentIndex: 7,
          progressMs: position,
          durationMs: 180000
        })
      )
      player.restore()
      expect(player.playing).toBe(false)
      expect(audio.instances).toHaveLength(0)
      expect(player.currentIndex).toBe(0)
      await player.resume()
      latest().length = 30
      latest().emit('load')
      expect(latest().seconds).toBe(position === 15000 ? 15 : 0)
    }
  )

  it('旧记录不带进度也能恢复；独立历史不依赖播放器记录存在', () => {
    localStorage.setItem(STORAGE_KEYS.PLAY_HISTORY, JSON.stringify([track(3)]))
    player.restore()
    expect(player.playHistory.map(t => t.id)).toEqual([3])
  })

  it('损坏 JSON 不删除其他个人数据，仍能恢复历史', () => {
    localStorage.setItem(STORAGE_KEYS.PLAYER, '{broken')
    localStorage.setItem(STORAGE_KEYS.PLAY_HISTORY, JSON.stringify([track(3)]))
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, 'keep')
    player.restore()
    expect(player.currentTrack).toBeNull()
    expect(player.playHistory).toHaveLength(1)
    expect(localStorage.getItem(STORAGE_KEYS.PLAYLISTS)).toBe('keep')
  })

  it('旧记录缺进度、索引越界、设置非法时校正且保持暂停', () => {
    localStorage.setItem(
      STORAGE_KEYS.PLAYER,
      JSON.stringify({
        playlist: [track(1), track(2)],
        currentIndex: 99,
        volume: 9,
        repeatMode: 'invalid',
        shuffleMode: 'true'
      })
    )
    player.restore()
    expect(player.currentIndex).toBe(1)
    expect(player.currentTrack.id).toBe(2)
    expect(player.progress).toBe(0)
    expect(player.volume).toBe(1)
    expect(player.repeatMode).toBe('off')
    expect(player.shuffleMode).toBe(false)
    expect(player.playing).toBe(false)
  })

  it('localStorage 写入拒绝时照常播放', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    await start()
    expect(player.playing).toBe(true)
  })

  it('销毁 store 作废回调并清理定时器', async () => {
    await start()
    const old = latest()
    player.$dispose()
    old.emit('load')
    expect(old.unload).toHaveBeenCalled()
    expectProgressTimersStopped()
  })
})
