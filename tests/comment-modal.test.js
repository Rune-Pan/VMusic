import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CommentModal from '@/components/CommentModal.vue'
import { getComments } from '@/api/comment'
import { useCommentSort } from '@/composables/useCommentSort'

vi.mock('@/api/comment', () => ({ getComments: vi.fn() }))
vi.mock('@/stores/ai', () => ({ useAiStore: () => ({ queue: vi.fn(), takePending: vi.fn() }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
let wrapper, observers
const row = id => ({
  commentId: id,
  content: `评论 ${id}`,
  user: { nickname: '测试用户' },
  time: 100,
  likedCount: 2
})
const page = (ids = [1, 2], hasMore = false, cursor = '') => ({
  comments: ids.map(row),
  hasMore,
  cursor
})
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
async function open(props = {}) {
  wrapper = mount(CommentModal, {
    props: { visible: true, id: 10, title: '测试歌曲', ...props },
    global: { stubs: { GlassSurface: { template: '<div><slot /></div>' } } }
  })
  await flushPromises()
}
async function intersect() {
  observers
    .filter(observer => !observer.disconnected)
    .forEach(observer => observer.callback([{ isIntersecting: true }]))
  await flushPromises()
}
beforeEach(() => {
  useCommentSort().setSort(3)
  localStorage.clear()
  getComments.mockReset().mockResolvedValue(page())
  observers = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback) {
        this.callback = callback
        this.disconnected = false
        observers.push(this)
      }
      observe() {}
      disconnect() {
        this.disconnected = true
      }
    }
  )
})
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
})

it.each(['track', 'playlist'])(
  '两个入口都有三种排序，初始可见立即加载：%s',
  async type => {
    await open({ type })
    expect(wrapper.get('.title-main').text()).toBe(
      type === 'track' ? '歌曲评论' : '歌单评论'
    )
    expect(
      wrapper.findAll('.comment-sort button[aria-pressed]').map(button => button.text())
    ).toEqual(['最新', '最热', '推荐'])
    expect(wrapper.get('.comment-sort button[aria-pressed]').attributes('aria-pressed')).toBe(
      'true'
    )
    expect(getComments).toHaveBeenCalledWith({
      type,
      id: 10,
      sortType: 3,
      pageNo: 1,
      pageSize: 20,
      cursor: ''
    })
    expect(wrapper.findAll('.comment-item')).toHaveLength(2)
  }
)

it('切换排序清空旧列表并回到顶部，保存偏好；重新打开与换资源都沿用', async () => {
  await open()
  wrapper.get('.comment-modal-body').element.scrollTop = 250
  getComments.mockResolvedValueOnce(page([30]))
  await wrapper.findAll('.comment-sort button[aria-pressed]')[1].trigger('click')
  await flushPromises()
  expect(wrapper.get('.comment-modal-body').element.scrollTop).toBe(0)
  expect(wrapper.findAll('.comment-item')).toHaveLength(1)
  expect(wrapper.text()).toContain('评论 30')
  expect(getComments.mock.lastCall[0]).toMatchObject({
    sortType: 2,
    pageNo: 1,
    cursor: ''
  })
  expect(localStorage.getItem('vmusic-comment-sort')).toBe('2')
  await wrapper.setProps({ visible: false })
  await wrapper.setProps({ visible: true, type: 'playlist' })
  await flushPromises()
  expect(getComments.mock.lastCall[0]).toMatchObject({
    type: 'playlist',
    sortType: 2,
    pageNo: 1
  })
  await wrapper.findAll('.comment-sort button[aria-pressed]')[2].trigger('click')
  await flushPromises()
  expect(getComments.mock.lastCall[0].sortType).toBe(99)
})

it.each([3, 25])(
  '按 hasMore 翻页，实际返回 %s 条仍续页，跨页及页内去重',
  async count => {
    getComments
      .mockResolvedValueOnce(
        page(
          Array.from({ length: count }, (_, index) => index + 1),
          true,
          '123'
        )
      )
      .mockResolvedValueOnce(page([1, count + 1, count + 1], false, '456'))
    await open()
    await intersect()
    expect(getComments.mock.lastCall[0]).toMatchObject({
      pageNo: 2,
      cursor: '123'
    })
    expect(wrapper.findAll('.comment-item')).toHaveLength(count + 1)
    expect(wrapper.text()).toContain('没有更多评论了')
    await intersect()
    expect(getComments).toHaveBeenCalledTimes(2)
  }
)

it('合法空列表显示暂无评论，不再自动加载', async () => {
  getComments.mockResolvedValueOnce(page([]))
  await open()
  expect(wrapper.text()).toContain('暂无评论')
  await intersect()
  expect(getComments).toHaveBeenCalledTimes(1)
})

it('首屏失败可重试同一页', async () => {
  getComments.mockRejectedValueOnce(new Error('网络暂不可用'))
  await open()
  expect(wrapper.text()).toContain('网络暂不可用')
  await wrapper.get('.comment-empty button').trigger('click')
  await flushPromises()
  expect(getComments.mock.lastCall[0].pageNo).toBe(1)
  expect(wrapper.findAll('.comment-item')).toHaveLength(2)
})

it('分页失败保留列表，暂停自动请求，重试保留页号和游标', async () => {
  getComments
    .mockResolvedValueOnce(page([1], true, '123'))
    .mockRejectedValueOnce(new Error('加载失败'))
    .mockResolvedValueOnce(page([2]))
  await open()
  await intersect()
  expect(wrapper.findAll('.comment-item')).toHaveLength(1)
  expect(wrapper.get('.comment-retry').text()).toContain('加载失败')
  await intersect()
  expect(getComments).toHaveBeenCalledTimes(2)
  await wrapper.get('.comment-retry button').trigger('click')
  await flushPromises()
  expect(getComments.mock.lastCall[0]).toMatchObject({
    pageNo: 2,
    cursor: '123'
  })
  expect(wrapper.findAll('.comment-item')).toHaveLength(2)
})

it.each([
  page([], true, '456'),
  page([1], true, '456'),
  page([2], true, '123'),
  page([2], true, '')
])('空页、重复页或游标停滞停止自动请求，可重试：%j', async next => {
  getComments
    .mockResolvedValueOnce(page([1], true, '123'))
    .mockResolvedValueOnce(next)
    .mockResolvedValueOnce(page([2]))
  await open()
  await intersect()
  expect(wrapper.findAll('.comment-item')).toHaveLength(1)
  expect(wrapper.get('.comment-retry').text()).toContain('请重试')
  await intersect()
  expect(getComments).toHaveBeenCalledTimes(2)
  await wrapper.get('.comment-retry button').trigger('click')
  await flushPromises()
  expect(getComments.mock.lastCall[0]).toMatchObject({
    pageNo: 2,
    cursor: '123'
  })
  expect(wrapper.findAll('.comment-item')).toHaveLength(2)
})

it('加载途中可换排序，旧请求 finally 不影响新加载，迟到内容不混入', async () => {
  const old = deferred(),
    current = deferred()
  getComments
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(current.promise)
  await open()
  await wrapper.findAll('.comment-sort button[aria-pressed]')[1].trigger('click')
  await flushPromises()
  expect(getComments).toHaveBeenCalledTimes(2)
  old.resolve(page([99]))
  await flushPromises()
  expect(wrapper.get('.comment-modal-body').attributes('aria-busy')).toBe(
    'true'
  )
  expect(wrapper.findAll('.comment-item')).toHaveLength(0)
  current.resolve(page([20]))
  await flushPromises()
  expect(wrapper.text()).toContain('评论 20')
  expect(wrapper.text()).not.toContain('评论 99')
})

it('快速换 ID 或相同 ID 的资源类型时，只有当前请求写入', async () => {
  const old = deferred(),
    middle = deferred(),
    current = deferred()
  getComments
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(middle.promise)
    .mockReturnValueOnce(current.promise)
  await open()
  await wrapper.setProps({ id: 11 })
  await wrapper.setProps({ type: 'playlist' })
  current.resolve(page([30]))
  await flushPromises()
  old.resolve(page([10]))
  middle.reject(new Error('旧请求失败'))
  await flushPromises()
  expect(wrapper.findAll('.comment-item')).toHaveLength(1)
  expect(wrapper.text()).toContain('评论 30')
  expect(wrapper.text()).not.toContain('旧请求失败')
})

it.each(['close', 'unmount'])('关闭或卸载后丢弃迟到响应：%s', async action => {
  const old = deferred()
  getComments.mockReturnValueOnce(old.promise)
  await open()
  if (action === 'close') {
    await wrapper.get('.close-btn').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.setProps({ visible: false })
  } else wrapper.unmount()
  old.resolve(page([99], true, '123'))
  await flushPromises()
  expect(observers.filter(observer => !observer.disconnected)).toHaveLength(0)
  if (action === 'close') {
    await wrapper.setProps({ visible: true })
    await flushPromises()
    expect(wrapper.text()).not.toContain('评论 99')
  }
})
