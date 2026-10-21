import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, disposePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import request from '@/utils/request'
import { useMusicStore } from '@/stores/music'
import { requireApiSuccess } from '@/utils/apiResult'
import { getPlaylistDetail, addTracksToPlaylist, subscribePlaylist } from '@/api/playlist'
import { userPlaylist } from '@/api/user'
import { invalidatePlaylistDetail, invalidateUserPlaylists, cachePlaylistDetail } from '@/utils/db'
import AddToPlaylistModal from '@/components/AddToPlaylistModal.vue'
import PlaylistFormModal from '@/components/PlaylistFormModal.vue'
import PlaylistView from '@/views/PlaylistView.vue'
import { STORAGE_KEYS } from '@/constants'

const state = vi.hoisted(() => ({ user: null, route: null, toast: vi.fn(), confirm: vi.fn(), push: vi.fn(), setPlaylist: vi.fn() }))
vi.mock('@/utils/request', () => ({ default: vi.fn() }))
vi.mock('@/stores/user', () => ({ useUserStore: () => state.user }))
vi.mock('vue-router', () => ({ useRoute: () => state.route, useRouter: () => ({ push: state.push }) }))
vi.mock('@/stores/player', () => ({ usePlayerStore: () => ({ setPlaylist: state.setPlaylist }) }))
vi.mock('@/stores/ui', () => ({ useUiStore: () => ({ showToast: state.toast, showConfirm: state.confirm }) }))
let pinia, music, wrapper, playlists, detail, descFail
const song = id => ({ id, name: `歌曲${id}`, dt: 180000, ar: [], al: {} })
const stubs = { GlassSurface: { template: '<div><slot /></div>' }, CommentModal: true, TrackList: true }
beforeEach(async () => {
  vi.clearAllMocks()
  localStorage.clear()
  await invalidateUserPlaylists(10)
  await invalidatePlaylistDetail(8001)
  await invalidatePlaylistDetail(8002)
  pinia = createPinia()
  setActivePinia(pinia)
  state.user = reactive({ userInfo: { id: 10 }, isLoggedIn: true })
  state.route = reactive({ name: 'playlist', params: { id: '8001' }, meta: {} })
  state.confirm.mockResolvedValue(true)
  playlists = [{ id: 8001, name: '我的测试歌单', creator: { userId: 10 }, trackCount: 2 }]
  detail = { ...playlists[0], tracks: [song(81001), song(81002)], trackIds: [{ id: 81001 }, { id: 81002 }] }
  descFail = false
  request.mockImplementation(async ({ url, params }) => {
    if (url === '/user/playlist') return { code: 200, playlist: structuredClone(playlists) }
    if (url === '/playlist/detail') return { code: 200, playlist: structuredClone(detail), privileges: [] }
    if (url === '/playlist/create') { playlists.push({ id: 8002, name: params.name, creator: { userId: 10 } }); return { code: 200, id: 8002 } }
    if (url === '/playlist/desc/update') { if (descFail) return { code: 500, message: '简介服务暂不可用' }; return { code: 200 } }
    if (url === '/playlist/name/update') { detail.name = params.name; return { code: 200 } }
    if (url === '/playlist/delete') { playlists = playlists.filter(p => p.id !== params.id); return { code: 200 } }
    if (url === '/playlist/subscribe') return { code: 200 }
    if (url === '/playlist/tracks') {
      if (params.op === 'del') detail.tracks = detail.tracks.filter(t => !params.tracks.split(',').includes(String(t.id)))
      else detail.tracks.push(song(Number(params.tracks)))
      detail.trackIds = detail.tracks.map(t => ({ id: t.id }))
      detail.trackCount = detail.tracks.length
      return { status: 200, body: { code: 200 } }
    }
    throw new Error(`unexpected ${url}`)
  })
  music = useMusicStore()
  music.setAccount(10)
})
afterEach(() => { wrapper?.unmount(); wrapper = null; disposePinia(pinia) })

it.each([{ code: 401, message: '无操作权限' }, { status: 200, body: { code: 401, message: '无操作权限' } }, { code: 200, body: { code: 401, message: '无操作权限' } }])('HTTP200内的业务错误必须失败：%j', result => {
  expect(() => requireApiSuccess(result)).toThrow('无操作权限')
})
it('支持嵌套成功响应，缺少业务结果不能当成功', () => {
  expect(requireApiSuccess({ status: 200, body: { code: 200, id: 8 } }).id).toBe(8)
  expect(() => requireApiSuccess({ status: 200 })).toThrow()
})

it('写入失败和重复添加不提示成功、不关闭弹窗，并隐藏他人和系统歌单', async () => {
  playlists.push({ id: 9000, name: '他人的收藏', creator: { userId: 20 } }, { id: 9001, name: '喜欢的音乐', creator: { userId: 10 }, specialType: 5 })
  wrapper = mount(AddToPlaylistModal, { props: { visible: true, track: song(81003) }, global: { stubs } })
  await vi.waitFor(() => expect(wrapper.find('.atp-item').exists()).toBe(true))
  expect(wrapper.text()).not.toContain('他人的收藏')
  expect(wrapper.text()).not.toContain('喜欢的音乐')
  const original = request.getMockImplementation()
  request.mockImplementation(config => config.url === '/playlist/tracks' ? Promise.resolve({ body: { code: 502, message: '歌曲已存在' } }) : original(config))
  await wrapper.get('.atp-item').trigger('click')
  await vi.waitFor(() => expect(state.toast).toHaveBeenCalledWith('歌曲已存在', 'error'))
  expect(wrapper.emitted('close')).toBeUndefined()
  expect(state.toast.mock.calls.some(([, type]) => type === 'success')).toBe(false)
})

it('添加和移除后使字符串和数值ID详情失效，再进入得到云端实际曲目', async () => {
  await getPlaylistDetail('8001')
  await music.changePlaylistTracks(8001, [81003], 'add')
  expect((await getPlaylistDetail('8001')).playlist.tracks.map(t => t.id)).toEqual([81001, 81002, 81003])
  await music.changePlaylistTracks(8001, [81001], 'del')
  expect((await getPlaylistDetail(8001)).playlist.tracks.map(t => t.id)).toEqual([81002, 81003])
})

it('缓存不一致的旧记录以单独保存的tracks为准', async () => {
  await cachePlaylistDetail(8001, detail, [song(81002)], false)
  expect((await getPlaylistDetail('8001')).playlist.tracks.map(t => t.id)).toEqual([81002])
})

it('新建云歌单后列表立即更新，强制刷新兼容原查询且不新增本地副本', async () => {
  await music.fetchUserPlaylists(10)
  await music.createPlaylist('新私密歌单', '测试简介')
  expect(music.serverPlaylists.map(p => p.id)).toEqual([8001, 8002])
  expect(music.userPlaylists).toEqual([])
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: '/playlist/create', params: expect.objectContaining({ privacy: 10 }) }))
  playlists.push({ id: 8003 })
  expect((await userPlaylist({ uid: 10 })).playlist).toHaveLength(2)
  expect((await userPlaylist({ uid: 10 }, { forceRefresh: true })).playlist).toHaveLength(3)
})

it('新建后简介失败保留输入，重试只编辑已经创建的歌单', async () => {
  descFail = true
  wrapper = mount(PlaylistFormModal, { props: { visible: true }, global: { stubs } })
  await wrapper.get('#playlist-name').setValue('保留的歌单')
  await wrapper.get('#playlist-description').setValue('需要重试的简介')
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
  expect(wrapper.get('[role="alert"]').text()).toContain('歌单已创建')
  expect(wrapper.emitted('close')).toBeUndefined()
  expect(music.serverPlaylists.some(p => p.id === 8002)).toBe(true)
  descFail = false
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.emitted('saved')).toBeTruthy())
  expect(request.mock.calls.filter(([c]) => c.url === '/playlist/create')).toHaveLength(1)
  expect(wrapper.emitted('saved')[0][0].id).toBe(8002)
})

it('编辑部分失败不会清空简介或标签，删除成功后刷新列表', async () => {
  descFail = true
  await expect(music.updatePlaylist(8001, { name: '已更名', description: '新简介' })).rejects.toThrow('名称已保存')
  expect(request.mock.calls.some(([c]) => c.url === '/playlist/tags/update')).toBe(false)
  await music.deletePlaylist(8001)
  expect(music.serverPlaylists).toEqual([])
})

it('收藏失败必须保留业务错误，成功的收藏和取消传递明确参数', async () => {
  await subscribePlaylist(8001, true)
  expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ params: expect.objectContaining({ t: 1 }) }))
  await subscribePlaylist(8001, false)
  expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ params: expect.objectContaining({ t: 2 }) }))
  request.mockResolvedValueOnce({ code: 405, message: '收藏服务不可用' })
  await expect(subscribePlaylist(8001, true)).rejects.toThrow('收藏服务不可用')
})

it('取消移除不发请求；确认后同步云端并重载详情', async () => {
  wrapper = mount(PlaylistView, { global: { stubs } })
  await vi.waitFor(() => expect(wrapper.findComponent({ name: 'TrackList' }).exists()).toBe(true))
  state.confirm.mockResolvedValueOnce(false)
  await wrapper.findComponent({ name: 'TrackList' }).vm.$emit('remove', song(81001))
  await flushPromises()
  expect(request.mock.calls.some(([c]) => c.url === '/playlist/tracks')).toBe(false)
  wrapper.findComponent({ name: 'TrackList' }).vm.$emit('remove', song(81001))
  await vi.waitFor(() => expect(wrapper.findComponent({ name: 'TrackList' }).exists() && wrapper.findComponent({ name: 'TrackList' }).props('tracks').length === 1).toBe(true))
  expect(wrapper.findComponent({ name: 'TrackList' }).props('tracks').map(t => t.id)).toEqual([81002])
})

it('本机历史只读详情不请求云歌单、不改原始记录，仍可播放', async () => {
  const legacy = [{ id: 8001, name: '历史本地歌单', tracks: [song(81001)] }]
  localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(legacy))
  music.restorePlaylists()
  state.route.name = 'local-playlist'
  state.route.meta.localPlaylist = true
  wrapper = mount(PlaylistView, { global: { stubs } })
  await flushPromises()
  expect(wrapper.text()).toContain('只读')
  expect(wrapper.text()).not.toContain('删除歌单')
  expect(wrapper.findComponent({ name: 'TrackList' }).props('showRemove')).toBe(false)
  await wrapper.get('.play-all-btn').trigger('click')
  expect(state.setPlaylist).toHaveBeenCalled()
  expect(request).not.toHaveBeenCalled()
  expect(localStorage.getItem(STORAGE_KEYS.PLAYLISTS)).toBe(JSON.stringify(legacy))
})

it('底层歌曲写入也拒绝HTTP200中的权限错误', async () => {
  request.mockResolvedValueOnce({ status: 200, body: { code: 401, message: '无操作权限' } })
  await expect(addTracksToPlaylist({ op: 'add', pid: 8001, tracks: '81001' })).rejects.toThrow('无操作权限')
})

it('从播放栏添加后，已经打开的同一歌单详情也即时更新', async () => {
  wrapper = mount(PlaylistView, { global: { stubs } })
  await vi.waitFor(() => expect(wrapper.findComponent({ name: 'TrackList' }).exists()).toBe(true))
  await music.changePlaylistTracks(8001, [81003], 'add')
  await vi.waitFor(() => expect(wrapper.findComponent({ name: 'TrackList' }).exists() && wrapper.findComponent({ name: 'TrackList' }).props('tracks').length === 3).toBe(true))
})

it('写入前的迟到详情不得覆盖写入后缓存', async () => {
  let resolve
  request.mockReturnValueOnce(new Promise(yes => { resolve = yes }))
  const old = getPlaylistDetail(8001, true)
  await music.changePlaylistTracks(8001, [81003], 'add')
  await getPlaylistDetail(8001, true)
  resolve({ code: 200, playlist: { ...detail, tracks: [song(81001)] }, privileges: [] })
  await old
  expect((await getPlaylistDetail('8001')).playlist.tracks).toHaveLength(3)
})
