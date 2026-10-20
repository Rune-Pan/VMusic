import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useDialogFocus } from '@/composables/useDialogFocus'

const wrappers = []
const Dialog = defineComponent({
  setup() {
    const element = ref(null)
    useDialogFocus(element, () => true)
    return () =>
      h('div', { ref: element, tabindex: -1 }, [
        h('button', 'First'),
        h('button', 'Last')
      ])
  }
})
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}])
})
afterEach(() => {
  wrappers.reverse().forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
  document.body.innerHTML = ''
})
async function open() {
  const wrapper = mount(Dialog, { attachTo: document.body })
  wrappers.push(wrapper)
  await nextTick()
  return wrapper
}

it('打开时移入焦点，Tab 在弹窗边界循环，关闭后返回触发按钮', async () => {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  trigger.focus()
  const wrapper = await open()
  const [first, last] = wrapper.findAll('button')
  expect(document.activeElement).toBe(first.element)
  await first.trigger('keydown', { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(last.element)
  await last.trigger('keydown', { key: 'Tab' })
  expect(document.activeElement).toBe(first.element)
  wrapper.unmount()
  wrappers.pop()
  expect(document.activeElement).toBe(trigger)
})

it('嵌套弹窗只由栈顶约束焦点，关闭后回到下层弹窗', async () => {
  const outer = await open()
  const inner = await open()
  const last = inner.findAll('button')[1]
  last.element.focus()
  await last.trigger('keydown', { key: 'Tab' })
  expect(document.activeElement).toBe(inner.find('button').element)
  inner.unmount()
  wrappers.pop()
  expect(document.activeElement).toBe(outer.find('button').element)
})
