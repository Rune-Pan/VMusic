import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useAmbientCover } from '@/composables/useAmbientCover'

let scope
let requests
beforeEach(() => {
  requests = []
  vi.stubGlobal(
    'Image',
    class {
      constructor() {
        requests.push(this)
      }
    }
  )
  scope = effectScope()
})
afterEach(() => {
  scope.stop()
  vi.unstubAllGlobals()
})

function openCover(url) {
  const source = ref(url)
  const displayed = scope.run(() => useAmbientCover(source))
  return { source, displayed }
}

it('封面完成加载才切换，连续切歌的旧响应不能覆盖新歌曲', async () => {
  const { source, displayed } = openCover('a.jpg')
  const staleLoad = requests[0].onload
  source.value = 'b.jpg'
  await nextTick()
  expect(displayed.value).toBe('')
  requests[1].onload()
  expect(displayed.value).toBe('b.jpg')
  staleLoad()
  expect(displayed.value).toBe('b.jpg')
})

it('等待新封面时保留现有背景，加载失败回到冷调背景', async () => {
  const { source, displayed } = openCover('a.jpg')
  requests[0].onload()
  source.value = 'broken.jpg'
  await nextTick()
  expect(displayed.value).toBe('a.jpg')
  requests[1].onerror()
  expect(displayed.value).toBe('')
})

it('清空曲目后迟到的图片不能恢复背景', async () => {
  const { source, displayed } = openCover('a.jpg')
  const staleLoad = requests[0].onload
  source.value = ''
  await nextTick()
  staleLoad()
  expect(displayed.value).toBe('')
})

it('卸载时解除图片回调并忽略迟到结果', () => {
  const { displayed } = openCover('a.jpg')
  const staleLoad = requests[0].onload
  scope.stop()
  expect(requests[0].onload).toBeNull()
  staleLoad()
  expect(displayed.value).toBe('')
})
