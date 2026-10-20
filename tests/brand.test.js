import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import BrandMark from '@/components/BrandMark.vue'

it.each([22, 40])(
  '品牌在 %ipx 保持已选定 B 母形、继承颜色且不重复朗读',
  size => {
    const wrapper = mount(BrandMark, { props: { size } })
    const approved = readFileSync('docs/brand-kit/brand-mark.svg', 'utf8')
    const path = approved.match(/<path d="([^"]+)"/)[1]
    expect(wrapper.get('path').attributes('d')).toBe(path)
    expect(wrapper.attributes()).toMatchObject({
      width: String(size),
      height: String(size),
      viewBox: '0 0 32 32',
      stroke: 'currentColor',
      'aria-hidden': 'true',
      focusable: 'false'
    })
    wrapper.unmount()
  }
)

it('网站 favicon 使用已校验的 B 多尺寸 ICO，并刷新旧缓存地址', () => {
  expect(readFileSync('public/favicon.ico')).toEqual(
    readFileSync('docs/brand-kit/favicon.ico')
  )
  expect(readFileSync('index.html', 'utf8')).toContain('/favicon.ico?v=tide-b')
})
