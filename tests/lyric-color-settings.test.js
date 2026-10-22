import { beforeEach, afterEach, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LyricColorSettings from '@/components/LyricColorSettings.vue'
import { useLyricColors } from '@/composables/useLyricColors'
import { STORAGE_KEYS } from '@/constants'

let wrapper, colors
beforeEach(() => {
  localStorage.clear()
  colors = useLyricColors()
  colors.resetColors()
  wrapper = mount(LyricColorSettings)
})
afterEach(() => wrapper.unmount())

it('两个独立选色组默认跟随主题，示例包含原文、翻译与时间', () => {
  expect(wrapper.findAll('fieldset')).toHaveLength(2)
  for (const name of ['当前行', '普通行']) {
    expect(
      wrapper.get(`[aria-label="${name}跟随主题"]`).attributes('aria-pressed')
    ).toBe('true')
  }
  expect(wrapper.findAll('.preview-line')).toHaveLength(2)
  expect(wrapper.findAll('.preview-translation')).toHaveLength(2)
  expect(wrapper.findAll('.preview-time')).toHaveLength(2)
})

it('预设、取色器、色值输入即时保存并更新预览', async () => {
  await wrapper.get('[aria-label="当前行：蓝色"]').trigger('click')
  await wrapper.get('#lyric-normal-picker').setValue('#aabbcc')
  const preview = wrapper.get('.lyric-preview').element
  expect(preview.style.getPropertyValue('--lyric-active-color')).toBe('#60A5FA')
  expect(preview.style.getPropertyValue('--lyric-normal-color')).toBe('#AABBCC')
  await wrapper.get('#lyric-active-hex').setValue('#123abc')
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.LYRIC_COLORS))).toEqual({
    active: '#123ABC',
    normal: '#AABBCC'
  })
  expect(wrapper.get('#lyric-active-hex').element.value).toBe('#123ABC')
})

it('未完成或非法输入不改变颜色，错误有可访问说明，合法输入清除错误', async () => {
  await wrapper.get('[aria-label="当前行：紫色"]').trigger('click')
  for (const invalid of ['#12', '#12345678', 'red', '']) {
    await wrapper.get('#lyric-active-hex').setValue(invalid)
    expect(colors.active.value).toBe('#A78BFA')
    expect(wrapper.get('#lyric-active-hex').attributes('aria-invalid')).toBe(
      'true'
    )
    expect(wrapper.get('#lyric-active-error').text()).toContain(
      '当前颜色未更改'
    )
  }
  await wrapper.get('#lyric-active-hex').setValue('#112233')
  expect(wrapper.find('#lyric-active-error').exists()).toBe(false)
  expect(colors.active.value).toBe('#112233')
})

it('逐项恢复保留另一项，全部恢复同时清理无效草稿', async () => {
  await wrapper.get('[aria-label="当前行：绿色"]').trigger('click')
  await wrapper.get('[aria-label="普通行：玫红"]').trigger('click')
  await wrapper.get('[aria-label="当前行跟随主题"]').trigger('click')
  expect([colors.active.value, colors.normal.value]).toEqual([null, '#FB7185'])
  await wrapper.get('#lyric-active-hex').setValue('#bad')
  await wrapper.get('.reset-colors').trigger('click')
  expect(wrapper.get('#lyric-active-hex').element.value).toBe('')
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
  expect(
    wrapper
      .get('.lyric-preview')
      .element.style.getPropertyValue('--lyric-active-color')
  ).toBe('')
  expect([colors.active.value, colors.normal.value]).toEqual([null, null])
})

it('重新挂载恢复选色，其他消费者的更新同步到控件', async () => {
  colors.setColor('active', '#123456')
  await flushPromises()
  expect(wrapper.get('#lyric-active-hex').element.value).toBe('#123456')
  wrapper.unmount()
  wrapper = mount(LyricColorSettings)
  expect(wrapper.get('#lyric-active-hex').element.value).toBe('#123456')
  expect(
    wrapper.get('[aria-label="当前行跟随主题"]').attributes('aria-pressed')
  ).toBe('false')
})
