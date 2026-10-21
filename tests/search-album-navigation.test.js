import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia, disposePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SearchResultsOverlay from '@/components/SearchResultsOverlay.vue'
import { useMusicStore } from '@/stores/music'
import { search as searchApi } from '@/api/others'

vi.mock('@/api/others', () => ({
  search: vi.fn(),
  SEARCH_TYPES: { tracks: 1, albums: 10, artists: 100, playlists: 1000 }
}))
let wrapper, router, history, pinia, music
const albums = Array.from({ length: 16 }, (_, i) => ({
  id: i + 1,
  name: `专辑${i + 1}`,
  artist: { name: '歌手' }
}))
beforeEach(async () => {
  window.history.replaceState(null, '', '/')
  history = createWebHistory()
  router = createRouter({
    history,
    routes: [
      { path: '/', name: 'home' },
      { path: '/album/:id', name: 'album' },
      { path: '/artist/:id', name: 'artist' },
      { path: '/playlist/:id', name: 'playlist' }
    ].map(route => ({ ...route, component: { template: '<div />' } }))
  })
  await router.push('/')
  await router.isReady()
  pinia = createPinia()
  setActivePinia(pinia)
  music = useMusicStore()
  searchApi.mockImplementation(async ({ type, offset }) => ({
    result:
      type === 10
        ? {
            albums: offset ? [{ id: 17, name: '专辑17' }] : albums,
            albumCount: 17
          }
        : {}
  }))
  wrapper = mount(SearchResultsOverlay, {
    attachTo: document.body,
    global: {
      plugins: [router, pinia],
      stubs: {
        GlassSurface: { template: '<div><slot /></div>' },
        TrackList: true,
        MusicCard: true
      }
    }
  })
  await music.search('测试')
  music.setSearchType('albums')
  await flushPromises()
})
afterEach(() => {
  wrapper.unmount()
  history.destroy()
  disposePinia(pinia)
})
async function pop(direction, position) {
  router.go(direction)
  await vi.waitFor(() => expect(history.state.position).toBe(position))
  await flushPromises()
}

it('搜索进入专辑保留分页，后退恢复、前进隐藏，支持重复往返', async () => {
  await music.loadMoreSearch('albums')
  await flushPromises()
  wrapper.get('.panel').element.scrollTop = 320
  const origin = history.state.position
  await wrapper.get('[data-album-id="17"]').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/album/17')
  expect(wrapper.find('.overlay').exists()).toBe(false)
  expect(music.searchResultsByType.albums).toHaveLength(17)
  const requests = searchApi.mock.calls.length
  await pop(-1, origin)
  expect(wrapper.find('.overlay').exists()).toBe(true)
  await wrapper.vm.restoreSearchPosition()
  expect(wrapper.get('.panel').element.scrollTop).toBe(320)
  expect(document.activeElement.dataset.albumId).toBe('17')
  expect(music.searchType).toBe('albums')
  expect(searchApi).toHaveBeenCalledTimes(requests)
  await pop(1, origin + 1)
  expect(wrapper.find('.overlay').exists()).toBe(false)
  await pop(-1, origin)
  expect(wrapper.find('.overlay').exists()).toBe(true)
})

it('同路径的新导航不会恢复搜索；清空后后退也不复活', async () => {
  const origin = history.state.position
  await wrapper.get('[data-album-id="1"]').trigger('click')
  await flushPromises()
  await router.push('/')
  expect(music.searchVisible).toBe(false)
  music.clearSearch()
  await pop(-2, origin)
  expect(wrapper.find('.overlay').exists()).toBe(false)
})

it('选择当前专辑也新增历史项，后退恢复搜索', async () => {
  await router.push('/album/1')
  await music.search('同专辑')
  music.setSearchType('albums')
  await flushPromises()
  const origin = history.state.position
  await wrapper.get('[data-album-id="1"]').trigger('click')
  await flushPromises()
  expect(history.state.position).toBe(origin + 1)
  await pop(-1, origin)
  expect(music.searchVisible).toBe(true)
})

it('守卫阻止导航时恢复原搜索现场', async () => {
  router.beforeEach(to => (to.name === 'album' ? false : undefined))
  await wrapper.get('[data-album-id="1"]').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/')
  expect(wrapper.find('.overlay').exists()).toBe(true)
  expect(music.searchKeyword).toBe('测试')
})

it.each(['new-search', 'account'])(
  '新搜索或账号变化后旧历史不会恢复：%s',
  async change => {
    const origin = history.state.position
    await wrapper.get('[data-album-id="1"]').trigger('click')
    await flushPromises()
    if (change === 'account') music.setAccount(42)
    else {
      await music.search('新词')
    }
    await pop(-1, origin)
    expect(wrapper.find('.overlay').exists()).toBe(false)
    expect(music.searchReturnContext).toBe(null)
  }
)

it('隐藏期间的搜索请求可以完成，但不能重新打开浮层', async () => {
  let resolve
  searchApi.mockReturnValueOnce(
    new Promise(yes => {
      resolve = yes
    })
  )
  const loading = music.loadMoreSearch('albums')
  await wrapper.get('[data-album-id="1"]').trigger('click')
  await flushPromises()
  resolve({ result: { albums: [{ id: 17 }], albumCount: 17 } })
  await loading
  expect(music.searchResultsByType.albums).toHaveLength(17)
  expect(music.searchPageByType.albums.loading).toBe(false)
  expect(music.searchVisible).toBe(false)
})
