import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import ProfileView from '@/views/ProfileView.vue'
import { STORAGE_KEYS } from '@/constants'
import { useShortcuts } from '@/composables/useShortcuts'
import { clearTrackSourceCache } from '@/utils/db'

const state = vi.hoisted(() => ({}))
vi.mock('@/stores/user', () => ({ useUserStore: () => state.user }))
vi.mock('@/stores/music', () => ({ useMusicStore: () => state.music }))
vi.mock('@/stores/player', () => ({ usePlayerStore: () => state.player }))
vi.mock('@/stores/ui', () => ({ useUiStore: () => state.ui }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/api/user', () => ({ userPlaylist: vi.fn(async () => ({ playlist: [] })) }))
vi.mock('@/utils/db', () => ({ clearTrackSourceCache: vi.fn(async () => {}) }))
vi.mock('@/composables/useTheme', () => ({ useTheme: () => state.theme }))
vi.mock('@/composables/usePreload', () => ({
  PRELOAD_ITEMS: [{ key: 'dailyRecommend', label: '每日推荐' }],
  usePreload: () => state.preload
}))
vi.mock('@/composables/useSidebarAutoHide', () => ({ useSidebarAutoHide: () => state.sidebar }))
vi.mock('@/composables/useSidebarCollapse', () => ({ useSidebarCollapse: () => state.collapse }))
vi.mock('@/composables/useCoverRotation', () => ({ useCoverRotation: () => state.rotation }))

let wrapper, shell, container
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(STORAGE_KEYS.PROFILE_ACTIVE_MENU, 'settings')
  useShortcuts().setEnabled(true)
  useShortcuts().resetAllShortcuts()
  state.user = reactive({
    userInfo: { id: 1, nickname: '测试用户', vipType: 0 },
    likedTracks: [], likedTracksLoading: false,
    fetchLikedTracks: vi.fn(), setShowVipBadge: vi.fn()
  })
  state.music = { serverPlayHistory: {}, fetchPlayHistory: vi.fn() }
  state.player = { playHistory: [], play: vi.fn(), togglePlay: vi.fn(), prev: vi.fn(), next: vi.fn() }
  state.ui = { showToast: vi.fn(), showConfirm: vi.fn() }
  state.collapse = { collapsed: ref(false), setCollapsed: vi.fn() }
  state.rotation = { enabled: ref(false), secondsPerTurn: ref(8), setEnabled: vi.fn(), setSecondsPerTurn: vi.fn() }
  state.theme = { theme: ref('dark'), themeColor: ref('blue'), setTheme: vi.fn(), setThemeColor: vi.fn() }
  state.preload = { config: ref({ enabled: false, items: { dailyRecommend: true } }), setEnabled: vi.fn(), setItem: vi.fn() }
  state.sidebar = { enabled: ref(false), triggerWidth: ref(16), hideDelay: ref(350), setEnabled: vi.fn(), setTriggerWidth: vi.fn(), setHideDelay: vi.fn() }
  shell = document.createElement('div')
  shell.className = 'desktop-shell'
  container = document.createElement('main')
  container.className = 'main-content'
  container.scrollTo = vi.fn()
  shell.append(container)
  document.body.append(shell)
  vi.clearAllMocks()
})
afterEach(() => {
  wrapper?.unmount()
  shell.remove()
  vi.unstubAllGlobals()
})
async function open(saved) {
  if (saved !== undefined) localStorage.setItem(STORAGE_KEYS.SETTINGS_SECTION, saved)
  wrapper = mount(ProfileView, {
    attachTo: container,
    global: { stubs: { PlaylistCard: true, TrackList: true, GlassSurface: { template: '<div><slot /></div>' } } }
  })
  await flushPromises()
}
const tab = key => wrapper.get(`#settings-tab-${key}`)
const visiblePanels = () => wrapper.findAll('[role="tabpanel"]').filter(panel => panel.isVisible())

it.each([undefined, '', 'unknown', '{bad'])('缺失或无效分类回到外观：%s', async saved => {
  await open(saved)
  expect(tab('appearance').attributes('aria-selected')).toBe('true')
  expect(visiblePanels().map(panel => panel.attributes('id'))).toEqual(['settings-panel-appearance'])
})

it('恢复有效分类，切换后本机保存并可重新挂载恢复', async () => {
  await open('shortcuts')
  expect(tab('shortcuts').attributes('tabindex')).toBe('0')
  await tab('preload').trigger('click')
  await flushPromises()
  expect(localStorage.getItem(STORAGE_KEYS.SETTINGS_SECTION)).toBe('preload')
  expect(document.activeElement).toBe(tab('preload').element)
  wrapper.unmount()
  await open()
  expect(visiblePanels()[0].attributes('id')).toBe('settings-panel-preload')
})

it('方向键循环、Home/End切换并保留正确焦点及ARIA关系', async () => {
  await open()
  for (const [from, key, to] of [
    ['appearance', 'ArrowLeft', 'preload'], ['preload', 'ArrowRight', 'appearance'],
    ['appearance', 'End', 'preload'], ['preload', 'Home', 'appearance'],
    ['appearance', 'ArrowRight', 'playback']
  ]) {
    await tab(from).trigger('keydown', { key })
    await flushPromises()
    expect(document.activeElement).toBe(tab(to).element)
    expect(tab(to).attributes('aria-selected')).toBe('true')
    expect(tab(to).attributes('aria-controls')).toBe(visiblePanels()[0].attributes('id'))
    expect(wrapper.findAll('[role="tab"][tabindex="0"]')).toHaveLength(1)
  }
  expect(state.player.togglePlay).not.toHaveBeenCalled()
  expect(state.player.prev).not.toHaveBeenCalled()
  expect(state.player.next).not.toHaveBeenCalled()
})

it('分类切换不会修改原有偏好或触发设置操作', async () => {
  await open()
  const saved = Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))
  for (const key of ['preload', 'shortcuts', 'playback', 'appearance']) {
    await tab(key).trigger('click')
  }
  await flushPromises()
  for (const [key, value] of Object.entries(saved)) expect(localStorage.getItem(key)).toBe(value)
  for (const operation of [state.preload.setEnabled, state.preload.setItem, state.theme.setTheme, state.sidebar.setEnabled, clearTrackSourceCache]) {
    expect(operation).not.toHaveBeenCalled()
  }
})

it('滚动深处切换分类回到设置起点，未到设置顶部时保持原位置', async () => {
  await open('shortcuts')
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: 82 })
  vi.spyOn(wrapper.get('.settings-form').element, 'getBoundingClientRect').mockReturnValue({ top: -118 })
  container.scrollTop = 500
  await tab('preload').trigger('click')
  await flushPromises()
  expect(container.scrollTo).toHaveBeenLastCalledWith({ top: 300, behavior: 'instant' })
  container.scrollTop = 0
  await tab('appearance').trigger('click')
  await flushPromises()
  expect(container.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
})

it('设置圆角裁切跟随吸顶位置，回到起点及窗口变化后同步恢复', async () => {
  await open()
  const form = wrapper.get('.settings-form').element
  const formRect = vi.spyOn(form, 'getBoundingClientRect').mockReturnValue({ top: -118 })
  vi.spyOn(wrapper.get('.settings-tabs').element, 'getBoundingClientRect').mockReturnValue({ top: 82 })
  container.dispatchEvent(new Event('scroll'))
  expect(form.style.getPropertyValue('--settings-clip-top')).toBe('200px')
  formRect.mockReturnValue({ top: 100 })
  window.dispatchEvent(new Event('resize'))
  expect(form.style.getPropertyValue('--settings-clip-top')).toBe('0px')
})

it('离开设置及卸载后清理圆角监听，重新进入时恢复', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  await open()
  const form = wrapper.get('.settings-form').element
  const measure = vi.spyOn(form, 'getBoundingClientRect')
  await wrapper.findAll('.menu-item').find(button => button.text().includes('喜欢的歌曲')).trigger('click')
  await flushPromises()
  measure.mockClear()
  container.dispatchEvent(new Event('scroll'))
  window.dispatchEvent(new Event('resize'))
  expect(measure).not.toHaveBeenCalled()
  await wrapper.findAll('.menu-item').find(button => button.text().includes('个人设置')).trigger('click')
  await flushPromises()
  const newForm = wrapper.get('.settings-form').element
  expect(newForm.style.getPropertyValue('--settings-clip-top')).toBe('0px')
  const newMeasure = vi.spyOn(newForm, 'getBoundingClientRect')
  wrapper.unmount()
  container.dispatchEvent(new Event('scroll'))
  window.dispatchEvent(new Event('resize'))
  expect(newMeasure).not.toHaveBeenCalled()
})

it('录制冲突后切换分类清除临时状态，已保存键位不变', async () => {
  await open('shortcuts')
  const keys = localStorage.getItem(STORAGE_KEYS.SHORTCUTS)
  const record = wrapper.findAll('.shortcut-key')[0]
  await record.trigger('click')
  await record.trigger('keydown', { key: 'ArrowLeft', altKey: true })
  expect(wrapper.find('.shortcut-conflict').text()).toContain('上一首')
  expect(state.player.prev).not.toHaveBeenCalled()
  await tab('appearance').trigger('click')
  await tab('shortcuts').trigger('click')
  expect(wrapper.find('.shortcut-conflict').exists()).toBe(false)
  expect(wrapper.find('.shortcut-key.recording').exists()).toBe(false)
  expect(localStorage.getItem(STORAGE_KEYS.SHORTCUTS)).toBe(keys)
})

it('非录制状态不拦截Tab，录制状态下Tab可退出并取消录制', async () => {
  await open('shortcuts')
  const record = wrapper.findAll('.shortcut-key')[0]
  const idleTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
  record.element.dispatchEvent(idleTab)
  expect(idleTab.defaultPrevented).toBe(false)
  await record.trigger('click')
  const recordingTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
  record.element.dispatchEvent(recordingTab)
  await flushPromises()
  expect(recordingTab.defaultPrevented).toBe(false)
  expect(wrapper.find('.shortcut-key.recording').exists()).toBe(false)
})

it('音质及歌词设置继续沿用原事件和本机存储', async () => {
  await open('playback')
  await wrapper.get('[aria-label="音质选择"]').findAll('button')[0].trigger('click')
  expect(localStorage.getItem(STORAGE_KEYS.MUSIC_QUALITY)).toBe('128000')
  expect(clearTrackSourceCache).toHaveBeenCalledOnce()
  await wrapper.get('#settings-lyrics-time').setValue(true)
  expect(localStorage.getItem(STORAGE_KEYS.SHOW_LYRICS_TIME)).toBe('true')
  expect(state.ui.showToast).toHaveBeenLastCalledWith('设置已更新，重新进入播放页生效', 'success')
})

it('VIP开关按身份显示，预加载子项只随总开关展示', async () => {
  await open()
  expect(wrapper.find('#settings-vip-badge').exists()).toBe(false)
  state.user.userInfo.vipType = 1
  await flushPromises()
  expect(wrapper.find('#settings-vip-badge').isVisible()).toBe(true)
  await tab('preload').trigger('click')
  expect(wrapper.find('.preload-items').exists()).toBe(false)
  state.preload.config.value.enabled = true
  await flushPromises()
  expect(wrapper.find('.preload-items').isVisible()).toBe(true)
})


it('折叠开关在自动隐藏开启后仍可用，且仅更新折叠偏好', async () => {
  await open()
  expect(wrapper.get('label[for="sidebar-collapsed"]').isVisible()).toBe(true)
  state.sidebar.enabled.value = true
  await flushPromises()
  await wrapper.get('#sidebar-collapsed').setValue(true)
  expect(state.collapse.setCollapsed).toHaveBeenCalledExactlyOnceWith(true)
  expect(state.sidebar.setEnabled).not.toHaveBeenCalled()
  expect(wrapper.get('#sidebar-collapsed').attributes('disabled')).toBeUndefined()
})

it('旋转设置位于播放分类，滑块仅开启时显示并使用原生范围控件', async () => {
  await open('playback')
  expect(wrapper.get('label[for="settings-cover-rotation"]').isVisible()).toBe(true)
  expect(wrapper.find('#settings-cover-seconds').exists()).toBe(false)
  await wrapper.get('#settings-cover-rotation').setValue(true)
  expect(state.rotation.setEnabled).toHaveBeenCalledExactlyOnceWith(true)
  state.rotation.enabled.value = true
  await flushPromises()
  const range = wrapper.get('#settings-cover-seconds')
  expect([range.attributes('min'), range.attributes('max'), range.attributes('step')]).toEqual(['5', '60', '1'])
  await range.setValue('20')
  expect(state.rotation.setSecondsPerTurn).toHaveBeenCalledExactlyOnceWith(20)
  state.rotation.enabled.value = false
  await flushPromises()
  expect(wrapper.find('#settings-cover-seconds').exists()).toBe(false)
  expect(state.player.play).not.toHaveBeenCalled()
  await tab('appearance').trigger('click')
  expect(wrapper.get('label[for="settings-cover-rotation"]').isVisible()).toBe(false)
})
