import { afterEach, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import * as icons from '@/components/icons'

const wrappers = []
function render(Icon, props = {}) {
  const wrapper = mount(Icon, { props })
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

it('全部 46 个图标与已确认预览的矢量几何保持一致', () => {
  const approved = Object.entries(
    JSON.parse(readFileSync('tests/fixtures/approved-icons.json', 'utf8'))
  )
  expect(Object.keys(icons)).toHaveLength(46)
  expect(approved).toHaveLength(46)
  for (const [name, markup] of approved) {
    const expected = new DOMParser().parseFromString(
      `<svg>${markup.replaceAll(' data-heart', '')}</svg>`,
      'image/svg+xml'
    )
    const actual = render(icons[name])
    const shapes = node =>
      [...node.children].map(child => ({
        tag: child.tagName,
        attributes: Object.fromEntries(
          [...child.attributes]
            .filter(attribute => attribute.name !== 'data-heart')
            .map(attribute => [attribute.name, attribute.value])
        )
      }))
    expect(shapes(actual.element)).toEqual(shapes(expected.documentElement))
    expect(actual.attributes('viewBox')).toBe('0 0 24 24')
    expect(actual.attributes('stroke-width')).toBe('1.75')
    expect(actual.attributes('aria-hidden')).toBe('true')
    expect(actual.element.style.color).toBe('')
  }
})

it('尺寸、颜色、样式、描边和点击事件继续传递到根 SVG', async () => {
  const onClick = vi.fn()
  const icon = render(icons.Search, {
    size: 19,
    color: 'var(--color-text)',
    class: 'custom-icon',
    style: { opacity: '0.5' },
    'stroke-width': 1.7,
    onClick
  })
  expect(icon.attributes('width')).toBe('19')
  expect(icon.attributes('height')).toBe('19')
  expect(icon.attributes('stroke-width')).toBe('1.7')
  expect(icon.classes()).toContain('custom-icon')
  expect(icon.element.style.color).toBe('var(--color-text)')
  expect(icon.element.style.opacity).toBe('0.5')
  await icon.trigger('click')
  expect(onClick).toHaveBeenCalledOnce()
})

it('喜欢状态可响应填充切换，播放和暂停保留实心形状', async () => {
  const heart = render(icons.Heart, { fill: 'none' })
  expect(heart.attributes('fill')).toBe('none')
  expect(heart.find('path').attributes('fill')).toBeUndefined()
  await heart.setProps({ fill: 'currentColor', color: '#fb7185' })
  expect(heart.attributes('fill')).toBe('currentColor')
  expect(heart.element.style.color).toBe('rgb(251, 113, 133)')
  await heart.setProps({ fill: 'none' })
  expect(heart.attributes('fill')).toBe('none')
  for (const name of ['Play', 'Pause']) {
    expect(render(icons[name]).find('path').attributes('fill')).toBe(
      'currentColor'
    )
  }
})

it('显式可访问名称不会被默认装饰图标语义隐藏', () => {
  const icon = render(icons.CheckCircle, {
    'aria-label': '操作成功',
    role: 'img'
  })
  expect(icon.attributes('aria-label')).toBe('操作成功')
  expect(icon.attributes('role')).toBe('img')
  expect(icon.attributes('aria-hidden')).toBeUndefined()
})
