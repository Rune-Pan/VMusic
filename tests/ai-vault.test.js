// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, basename, resolve } from 'node:path'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import {
  createVault,
  normalizeConfig,
  windowsCodec
} from '../server/ai/vault.js'

let folder, file, vault
const config = {
  baseUrl: 'https://example.test/v1/',
  protocol: 'chat-completions',
  model: 'test-model',
  apiKey: 'secret-fixture-never-public'
}
const codec = vi.fn(async (operation, value) =>
  operation === 'Protect'
    ? Buffer.from(value).toString('base64')
    : Buffer.from(value, 'base64').toString('utf8')
)
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'tingchao-ai-test-'))
  file = join(folder, 'settings.json')
  vault = createVault(file, codec)
})
afterEach(async () => {
  if (
    dirname(resolve(folder)) !== resolve(tmpdir()) ||
    !basename(folder).startsWith('tingchao-ai-test-')
  )
    throw new Error('拒绝清理测试目录以外的路径')
  await rm(folder, { recursive: true, force: true })
})

it('首次无Key；保存密文、重启恢复，公开配置不返回Key或密文', async () => {
  expect((await vault.publicSettings()).configured).toBe(false)
  await vault.save(config)
  expect(await readFile(file, 'utf8')).not.toContain(config.apiKey)
  const restored = createVault(file, codec)
  expect((await restored.credentials()).apiKey).toBe(config.apiKey)
  expect(await restored.publicSettings()).toMatchObject({
    configured: true,
    baseUrl: 'https://example.test/v1',
    capabilities: null
  })
  expect(JSON.stringify(await restored.publicSettings())).not.toContain(
    'apiKey'
  )
})

it('保存空Key保留同源密钥，异源目标必须重新输入；变更作废能力测试', async () => {
  await vault.save(config)
  const original = await vault.credentials()
  await vault.setCapabilities({ text: true, tools: true }, original.revision)
  await vault.save({ ...config, model: 'other', apiKey: '' })
  expect((await vault.credentials()).apiKey).toBe(config.apiKey)
  expect((await vault.publicSettings()).capabilities).toBeNull()
  await expect(
    vault.setCapabilities({ tools: true }, original.revision)
  ).rejects.toThrow('配置已变化')
  await expect(
    vault.save({ ...config, baseUrl: 'https://other.test/v1', apiKey: '' })
  ).rejects.toThrow('重新输入')
})

it('删除后无法调用；加密失败不保存明文，也不覆盖已有配置', async () => {
  await vault.save(config)
  const before = await readFile(file, 'utf8')
  const failing = createVault(file, async () => {
    throw new Error('加密失败')
  })
  await expect(
    failing.save({ ...config, apiKey: 'replacement' })
  ).rejects.toThrow('加密失败')
  expect(await readFile(file, 'utf8')).toBe(before)
  await vault.deleteKey()
  expect((await vault.publicSettings()).configured).toBe(false)
  await expect(vault.credentials()).rejects.toThrow('API Key')
})

it.each([
  'http://remote.test/v1',
  'https://user:pass@example.test/v1',
  'https://example.test/v1?api_key=abc',
  'javascript:alert(1)'
])('拒绝不安全或携带认证的地址：%s', baseUrl => {
  expect(() => normalizeConfig({ ...config, baseUrl })).toThrow()
})

it.skipIf(process.platform !== 'win32')(
  'Windows DPAPI真实往返，仅使用无权限的测试字符串',
  async () => {
    const encrypted = await windowsCodec('Protect', 'tingchao-fixture')
    expect(encrypted).not.toContain('tingchao-fixture')
    expect(await windowsCodec('Unprotect', encrypted)).toBe('tingchao-fixture')
  },
  25000
)
