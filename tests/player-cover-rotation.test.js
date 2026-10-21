import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, disposePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mount, flushPromises } from '@vue/test-utils'
import PlayerView from '@/views/PlayerView.vue'
import { usePlayerStore } from '@/stores/player'
import { useMusicStore } from '@/stores/music'
import { useCoverRotation } from '@/composables/useCoverRotation'

vi.mock('howler', () => ({ Howler: { volume: vi.fn() }, Howl: vi.fn() }))
vi.mock('@/api/track', () => ({ getTrackDetail: vi.fn(async () => ({ songs: [] })), getMP3: vi.fn(), scrobble: vi.fn(), getLyric: vi.fn() }))
let pinia, player, wrapper, media, animate, originalAnimate
const preferences = useCoverRotation()
const track = id => ({ id, name: `Track ${id}`, ar: [], al: {} })

beforeEach(() => {
  preferences.setEnabled(false)
  preferences.setSecondsPerTurn(8)
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  player = usePlayerStore()
  const music = useMusicStore()
  music.recommendList = [track(1), track(2)]
  vi.spyOn(music, 'fetchLyrics').mockImplementation(async id => {
    music.currentLyricsTrackId = Number(id)
    music.currentLyrics = [{ time: 0, content: 'Lyric' }]
  })
  media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.stubGlobal('matchMedia', vi.fn(() => media))
  Element.prototype.scrollIntoView = vi.fn()
  originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate')
  animate = vi.fn(function () {
    return { effect: { target: this }, playbackRate: 1, currentTime: 0,
      pause: vi.fn(), play: vi.fn(), cancel: vi.fn(),
      updatePlaybackRate: vi.fn(function (rate) { this.playbackRate = rate }) }
  })
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  disposePinia(pinia)
  if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate)
  else delete Element.prototype.animate
  vi.unstubAllGlobals()
})
async function open(id = 1) {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/player/:id', name: 'player', component: PlayerView },
    { path: '/', name: 'home', component: { template: '<div />' } }
  ] })
  await router.push(`/player/${id}`)
  await router.isReady()
  wrapper = mount(PlayerView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return router
}
const animation = () => animate.mock.results.at(-1).value

it('默认方形且不创建动画，也不触发播放', async () => {
  const play = vi.spyOn(player, 'play')
  await open()
  expect(wrapper.get('.cover-wrapper').classes()).not.toContain('rotation-enabled')
  expect(animate).not.toHaveBeenCalled()
  expect(play).not.toHaveBeenCalled()
})

it('使用实际播放而非播放意图，暂停续转和调速不重建动画', async () => {
  preferences.setEnabled(true)
  player.currentTrack = track(1)
  player.wantsPlay = true
  await open()
  const a = animation()
  expect(a.play).not.toHaveBeenCalled()
  player.playing = true
  await flushPromises()
  expect(a.play).toHaveBeenCalled()
  a.currentTime = 125
  player.playing = false
  await flushPromises()
  expect(a.pause).toHaveBeenCalled()
  expect(a.currentTime).toBe(125)
  preferences.setSecondsPerTurn(20)
  await flushPromises()
  expect(a.updatePlaybackRate).toHaveBeenLastCalledWith(1 / 20)
  expect(a.currentTime).toBe(125)
  player.playing = true
  await flushPromises()
  expect(animate).toHaveBeenCalledTimes(1)
  expect(a.cancel).not.toHaveBeenCalled()
  player.isLoading = true
  await flushPromises()
  expect(a.pause).toHaveBeenCalled()
})

it('浏览其他歌曲时不跟随正在播放的歌曲旋转', async () => {
  preferences.setEnabled(true)
  player.currentTrack = track(1)
  player.playing = true
  await open(2)
  expect(animation().play).not.toHaveBeenCalled()
})

it('切歌重新创建正向动画；关闭恢复方形，重开与重新挂载重置', async () => {
  preferences.setEnabled(true)
  player.currentTrack = track(1)
  player.playing = true
  const router = await open()
  const first = animation()
  first.currentTime = 500
  await router.push('/player/2')
  await flushPromises()
  expect(first.cancel).toHaveBeenCalled()
  expect(animation().currentTime).toBe(0)
  expect(animate).toHaveBeenCalledTimes(2)
  const second = animation()
  preferences.setEnabled(false)
  await flushPromises()
  expect(second.cancel).toHaveBeenCalled()
  expect(wrapper.get('.cover-wrapper').classes()).not.toContain('rotation-enabled')
  preferences.setEnabled(true)
  await flushPromises()
  expect(animation().currentTime).toBe(0)
  const third = animation()
  wrapper.unmount()
  wrapper = null
  expect(third.cancel).toHaveBeenCalled()
  await open()
  expect(animation().currentTime).toBe(0)
})

it('减少动态效果保持圆形静止，实时变化清理动画且不改偏好', async () => {
  preferences.setEnabled(true)
  media.matches = true
  player.currentTrack = track(1)
  player.playing = true
  await open()
  expect(wrapper.get('.cover-wrapper').classes()).toContain('rotation-enabled')
  expect(animate).not.toHaveBeenCalled()
  const handler = media.addEventListener.mock.calls[0][1]
  handler({ matches: false })
  await flushPromises()
  const a = animation()
  expect(a.play).toHaveBeenCalled()
  handler({ matches: true })
  await flushPromises()
  expect(a.cancel).toHaveBeenCalled()
  expect(preferences.enabled.value).toBe(true)
  wrapper.unmount()
  wrapper = null
  expect(media.removeEventListener).toHaveBeenCalledExactlyOnceWith('change', handler)
})
