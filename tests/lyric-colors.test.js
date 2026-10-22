import { beforeEach, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@/constants'

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

async function preferences(saved) {
  if (saved !== undefined)
    localStorage.setItem(STORAGE_KEYS.LYRIC_COLORS, saved)
  return (await import('@/composables/useLyricColors')).useLyricColors()
}

it('缺省跟随主题，读取不写入本机存储或固定主题颜色', async () => {
  const colors = await preferences()
  expect([colors.active.value, colors.normal.value]).toEqual([null, null])
  expect(colors.colorStyle.value).toEqual({
    '--lyric-active-color': undefined,
    '--lyric-normal-color': undefined
  })
  expect(localStorage.getItem(STORAGE_KEYS.LYRIC_COLORS)).toBeNull()
})

it.each(['{bad', 'null', '[]', 'true', '"blue"', '{}'])(
  '损坏或无效记录回退主题：%s',
  async saved => {
    const colors = await preferences(saved)
    expect([colors.active.value, colors.normal.value]).toEqual([null, null])
  }
)

it('分别恢复有效字段，规范化大小写，仅非法字段回退', async () => {
  const colors = await preferences(
    JSON.stringify({ active: ' #aabbcc ', normal: 'red' })
  )
  expect([colors.active.value, colors.normal.value]).toEqual(['#AABBCC', null])
})

it('多个消费者同步，逐项及全部恢复，重新加载仍保留偏好', async () => {
  localStorage.setItem(STORAGE_KEYS.LYRIC_FONT_SIZE, '28')
  const first = await preferences()
  const second = (await import('@/composables/useLyricColors')).useLyricColors()
  expect(first.setColor('active', '#123abc')).toBe(true)
  second.setColor('normal', '#aabbcc')
  expect([first.active.value, second.normal.value]).toEqual([
    '#123ABC',
    '#AABBCC'
  ])
  vi.resetModules()
  const restored = await preferences()
  expect([restored.active.value, restored.normal.value]).toEqual([
    '#123ABC',
    '#AABBCC'
  ])
  restored.setColor('active', null)
  expect(restored.normal.value).toBe('#AABBCC')
  restored.resetColors()
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.LYRIC_COLORS))).toEqual({
    active: null,
    normal: null
  })
  expect(localStorage.getItem(STORAGE_KEYS.LYRIC_FONT_SIZE)).toBe('28')
})

it.each(['', '#123', '#abcdef00', '#ZZZZZZ', 'transparent', 123, undefined])(
  '非法输入保留上一有效色与存储：%s',
  async value => {
    const colors = await preferences()
    colors.setColor('active', '#123456')
    expect(colors.setColor('active', value)).toBe(false)
    expect(colors.active.value).toBe('#123456')
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.LYRIC_COLORS)).active
    ).toBe('#123456')
  }
)
