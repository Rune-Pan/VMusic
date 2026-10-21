import { beforeEach, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@/constants'

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})
async function preferences(saved) {
  if (saved !== undefined) localStorage.setItem(STORAGE_KEYS.COVER_ROTATION, saved)
  return (await import('@/composables/useCoverRotation')).useCoverRotation()
}

it('默认关闭、8秒一圈，读取时不写入存储', async () => {
  const p = await preferences()
  expect([p.enabled.value, p.secondsPerTurn.value]).toEqual([false, 8])
  expect(localStorage.getItem(STORAGE_KEYS.COVER_ROTATION)).toBeNull()
})

it.each(['{bad', 'null', '[]', 'true', '"on"', '{}'])('无效或缺失字段使用默认值：%s', async saved => {
  const p = await preferences(saved)
  expect([p.enabled.value, p.secondsPerTurn.value]).toEqual([false, 8])
})

it.each([4, 61, 8.5, '20', null])('无效周期回默认且保留有效开关：%s', async secondsPerTurn => {
  const p = await preferences(JSON.stringify({ enabled: true, secondsPerTurn }))
  expect([p.enabled.value, p.secondsPerTurn.value]).toEqual([true, 8])
})

it.each([5, 8, 60])('恢复有效周期：%s', async secondsPerTurn => {
  const p = await preferences(JSON.stringify({ enabled: false, secondsPerTurn }))
  expect(p.secondsPerTurn.value).toBe(secondsPerTurn)
})

it('多个消费者同步、关闭保留周期，重新加载恢复且不影响其他偏好', async () => {
  localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, 'true')
  const first = await preferences()
  const second = (await import('@/composables/useCoverRotation')).useCoverRotation()
  first.setEnabled(true)
  second.setSecondsPerTurn(20)
  expect([first.enabled.value, first.secondsPerTurn.value]).toEqual([true, 20])
  first.setEnabled(false)
  expect(second.secondsPerTurn.value).toBe(20)
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.COVER_ROTATION)))
    .toEqual({ enabled: false, secondsPerTurn: 20 })
  vi.resetModules()
  const restored = await preferences()
  expect([restored.enabled.value, restored.secondsPerTurn.value]).toEqual([false, 20])
  expect(localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED)).toBe('true')
})
