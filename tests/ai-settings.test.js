import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia, disposePinia } from 'pinia'
import AiSettings from '@/components/AiSettings.vue'
import {
  getAiSettings,
  saveAiSettings,
  testAiConnection,
  deleteAiKey
} from '@/api/ai'

vi.mock('@/api/ai', () => ({
  getAiSettings: vi.fn(),
  saveAiSettings: vi.fn(),
  testAiConnection: vi.fn(),
  deleteAiKey: vi.fn()
}))
let wrapper, pinia
const saved = {
  baseUrl: 'https://example.test/v1',
  model: 'test-model',
  protocol: 'responses',
  configured: true,
  capabilities: null
}
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  getAiSettings.mockResolvedValue({ ...saved, configured: false })
  saveAiSettings.mockResolvedValue(saved)
  testAiConnection.mockResolvedValue({
    ...saved,
    capabilities: { text: true, tools: false }
  })
  deleteAiKey.mockResolvedValue({ ...saved, configured: false })
  wrapper = mount(AiSettings)
})
afterEach(() => {
  wrapper.unmount()
  disposePinia(pinia)
})

it('打开设置只读取状态；保存不调用模型，成功后清空浏览器中的Key', async () => {
  await flushPromises()
  expect(testAiConnection).not.toHaveBeenCalled()
  await wrapper.get('#ai-key').setValue('fixture-key')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(saveAiSettings.mock.lastCall[0]).toMatchObject({
    apiKey: 'fixture-key',
    protocol: 'responses'
  })
  expect(wrapper.get('#ai-key').element.value).toBe('')
  expect(testAiConnection).not.toHaveBeenCalled()
})

it('主动测试连接后区分文本与工具能力，支持删除', async () => {
  await flushPromises()
  await wrapper.get('#ai-key').setValue('fixture-key')
  await wrapper
    .findAll('button')
    .find(button => button.text() === '保存并测试连接')
    .trigger('click')
  await flushPromises()
  expect(testAiConnection).toHaveBeenCalledOnce()
  expect(wrapper.text()).toContain('未通过工具测试')
  await wrapper
    .findAll('button')
    .find(button => button.text() === '删除 Key')
    .trigger('click')
  await flushPromises()
  expect(deleteAiKey).toHaveBeenCalledOnce()
  expect(wrapper.text()).toContain('已删除本机保存')
})
