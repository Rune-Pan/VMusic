import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, disposePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mount, flushPromises } from '@vue/test-utils'
import PlayerView from '@/views/PlayerView.vue'
import { usePlayerStore } from '@/stores/player'
import { useMusicStore } from '@/stores/music'
import { STORAGE_KEYS } from '@/constants'
import { useShortcuts } from '@/composables/useShortcuts'
import { useLyricColors } from '@/composables/useLyricColors'

vi.mock('howler', () => ({ Howler: { volume: vi.fn() }, Howl: vi.fn() }))
vi.mock('@/api/track', () => ({
  getTrackDetail: vi.fn(),
  getMP3: vi.fn(),
  scrobble: vi.fn(),
  getLyric: vi.fn()
}))

let pinia, wrapper, player, music
const track = id => ({ id, name: `Track ${id}`, ar: [], al: {} })
beforeEach(() => {
  localStorage.clear()
  useLyricColors().resetColors()
  pinia = createPinia()
  setActivePinia(pinia)
  player = usePlayerStore()
  music = useMusicStore()
  music.recommendList = [track(1), track(2)]
  vi.spyOn(music, 'fetchLyrics').mockImplementation(async id => {
    music.currentLyricsTrackId = Number(id)
    music.currentLyrics = [{ time: 1, content: `Lyric ${id}` }]
    return music.currentLyrics
  })
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  wrapper?.unmount()
  disposePinia(pinia)
})

async function open(id) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/player/:id', name: 'player', component: PlayerView },
      { path: '/', name: 'home', component: { template: '<div />' } }
    ]
  })
  await router.push(`/player/${id}`)
  await router.isReady()
  wrapper = mount(PlayerView, {
    attachTo: document.body,
    global: { plugins: [pinia, router] }
  })
  await flushPromises()
  return router
}

it('恢复后刷新播放器详情页不调用 play，并展示已保存的暂停进度', async () => {
  localStorage.setItem(
    STORAGE_KEYS.PLAYER,
    JSON.stringify({
      currentTrack: track(1),
      playlist: [track(1)],
      currentIndex: 0,
      progressMs: 15000
    })
  )
  player.restore()
  const play = vi.spyOn(player, 'play')
  await open(1)
  expect(play).not.toHaveBeenCalled()
  expect(player.playing).toBe(false)
  expect(player.progress).toBe(15000)
  expect(wrapper.find('h1').text()).toBe('Track 1')
})

it('页面订阅共享歌词，SWR 更新后直接显示；卸载后清理身份', async () => {
  await open(1)
  expect(wrapper.text()).toContain('Lyric 1')
  music.currentLyrics = [{ time: 1, content: 'Refreshed' }]
  await flushPromises()
  expect(wrapper.text()).toContain('Refreshed')
  wrapper.unmount()
  wrapper = null
  expect(music.currentLyricsTrackId).toBeNull()
})

it('同一曲目的详情晚于选歌返回时，页面跟随播放器更新元数据', async () => {
  player.currentTrack = track(1)
  await open(1)
  player.currentTrack = { ...track(1), name: 'Full detail' }
  await flushPromises()
  expect(wrapper.find('h1').text()).toBe('Full detail')
})

it('连续切换曲目路由不会隐式播放，歌词与路由保持匹配', async () => {
  const play = vi.spyOn(player, 'play')
  const router = await open(1)
  await router.push('/player/2')
  await flushPromises()
  expect(wrapper.find('h1').text()).toBe('Track 2')
  expect(wrapper.text()).toContain('Lyric 2')
  expect(play).not.toHaveBeenCalled()
})

it('浏览其它歌曲详情时不会用其歌词跳转正在播放的另一首歌', async () => {
  player.currentTrack = track(1)
  const play = vi.spyOn(player, 'play').mockImplementation(async selected => {
    player.currentTrack = selected
  })
  const seek = vi.spyOn(player, 'seek')
  await open(2)
  expect(wrapper.find('.lyric-line').classes()).not.toContain('active')
  await wrapper.find('.lyric-line').trigger('click')
  await flushPromises()
  expect(play).toHaveBeenCalledWith(track(2))
  expect(seek).toHaveBeenCalledWith(1000)
})

it('空格跳歌词不会再触发全局播放/暂停快捷键', async () => {
  useShortcuts().setEnabled(true)
  player.currentTrack = track(1)
  const togglePlay = vi.spyOn(player, 'togglePlay')
  const seek = vi.spyOn(player, 'seek')
  await open(1)
  await wrapper
    .find('.lyric-line')
    .trigger('keydown', { key: ' ', code: 'Space' })
  expect(seek).toHaveBeenCalledWith(1000)
  expect(togglePlay).not.toHaveBeenCalled()
})

it('歌词颜色实时更新及恢复，不触发播放、切歌、定位或音频重建', async () => {
  localStorage.setItem(STORAGE_KEYS.SHOW_LYRICS_TIME, 'true')
  player.currentTrack = track(1)
  const play = vi.spyOn(player, 'play')
  const seek = vi.spyOn(player, 'seek')
  const next = vi.spyOn(player, 'next')
  await open(1)
  music.currentLyrics = [{ time: 1, content: '原文', translation: 'Translation' }]
  const colors = useLyricColors()
  colors.setColor('active', '#123456')
  colors.setColor('normal', '#ABCDEF')
  await flushPromises()
  const view = wrapper.get('.player-view').element
  expect(view.style.getPropertyValue('--lyric-active-color')).toBe('#123456')
  expect(view.style.getPropertyValue('--lyric-normal-color')).toBe('#ABCDEF')
  expect(wrapper.find('.lyric-translation').exists()).toBe(true)
  expect(wrapper.find('.lyric-time').exists()).toBe(true)
  colors.resetColors()
  await flushPromises()
  expect(view.style.getPropertyValue('--lyric-active-color')).toBe('')
  expect(view.style.getPropertyValue('--lyric-normal-color')).toBe('')
  expect(play).not.toHaveBeenCalled()
  expect(seek).not.toHaveBeenCalled()
  expect(next).not.toHaveBeenCalled()
})
