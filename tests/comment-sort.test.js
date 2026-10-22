import { beforeEach, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@/constants'

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

async function preferences(saved) {
  if (saved !== undefined)
    localStorage.setItem(STORAGE_KEYS.COMMENT_SORT, saved)
  return (await import('@/composables/useCommentSort')).useCommentSort()
}

it('首次默认最新，读取不会写入偏好', async () => {
  expect((await preferences()).sortType.value).toBe(3)
  expect(localStorage.getItem(STORAGE_KEYS.COMMENT_SORT)).toBeNull()
})

it.each(['null', '{}', 'true', '1', '4', 'bad', '"2"'])(
  '非法偏好回退最新：%s',
  async saved => {
    expect((await preferences(saved)).sortType.value).toBe(3)
  }
)

it.each([3, 2, 99])('保存并恢复排序：%s', async value => {
  const first = await preferences()
  const second = (await import('@/composables/useCommentSort')).useCommentSort()
  first.setSort(value)
  expect(second.sortType.value).toBe(value)
  expect(localStorage.getItem(STORAGE_KEYS.COMMENT_SORT)).toBe(String(value))
  vi.resetModules()
  expect((await preferences()).sortType.value).toBe(value)
})

it('拒绝非法选择，保留其他本机设置', async () => {
  const prefs = await preferences('2')
  localStorage.setItem(STORAGE_KEYS.LYRIC_FONT_SIZE, '28')
  prefs.setSort(4)
  expect(prefs.sortType.value).toBe(2)
  expect(localStorage.getItem(STORAGE_KEYS.COMMENT_SORT)).toBe('2')
  expect(localStorage.getItem(STORAGE_KEYS.LYRIC_FONT_SIZE)).toBe('28')
})
