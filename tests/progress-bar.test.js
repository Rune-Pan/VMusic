import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressBar from '@/components/ProgressBar.vue'

it('进度使用可聚焦的原生 slider，保留毫秒 seek 接口和时间提示', async () => {
  const wrapper = mount(ProgressBar, {
    props: { current: 2000, total: 120000 }
  })
  const slider = wrapper.get('input[type="range"]')
  expect(slider.attributes('aria-label')).toBe('播放进度')
  expect(slider.attributes('aria-valuetext')).toBe('0:02 / 2:00')
  await slider.setValue('17000')
  expect(wrapper.emitted('seek')[0]).toEqual([17000])
  wrapper.unmount()
})

it('尚未加载时禁用滑块，不发出无效的 seek', async () => {
  const wrapper = mount(ProgressBar)
  const slider = wrapper.get('input')
  expect(slider.element.disabled).toBe(true)
  await slider.trigger('input')
  expect(wrapper.emitted('seek')).toBeUndefined()
  wrapper.unmount()
})
