import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { spawn } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'

export function normalizeConfig(input) {
  const url = new URL(String(input.baseUrl || '').trim())
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === 'https:' ||
      (url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    )
  )
    throw new Error(
      '接口地址须为 HTTPS，或本机 HTTP 地址，且不能包含密钥或查询参数'
    )
  if (!['chat-completions', 'responses'].includes(input.protocol))
    throw new Error('请选择接口协议')
  const model = String(input.model || '').trim()
  if (!model || model.length > 200) throw new Error('请填写有效的模型名称')
  return {
    baseUrl: url.href.replace(/\/+$/, ''),
    model,
    protocol: input.protocol
  }
}

// 密钥通过 stdin 传输，不放进进程参数或日志。DPAPI 密文只可由当前 Windows 用户解密。
export function windowsCodec(operation, value) {
  const script = `Add-Type -AssemblyName System.Security; try { $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $r=[Security.Cryptography.ProtectedData]::${operation}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r)) } catch { exit 1 }`
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64')
      ],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
    )
    let output = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('本机密钥加密服务超时'))
    }, 10000)
    child.stdout.on('data', chunk => {
      output += chunk
    })
    child.stderr.resume()
    child.on('error', () => {
      clearTimeout(timer)
      reject(new Error('无法启动 Windows 密钥加密服务'))
    })
    child.on('close', code => {
      clearTimeout(timer)
      if (code !== 0 || !output.trim())
        return reject(new Error('密钥加解密失败，请重新输入 Key；不会保存明文'))
      resolve(
        operation === 'Protect'
          ? output.trim()
          : Buffer.from(output.trim(), 'base64').toString('utf8')
      )
    })
    child.stdin.on('error', () => {})
    child.stdin.end(
      operation === 'Protect'
        ? Buffer.from(value, 'utf8').toString('base64')
        : value
    )
  })
}

export function createVault(file, codec = windowsCodec) {
  let queue = Promise.resolve()
  async function read() {
    try {
      const data = JSON.parse(await readFile(file, 'utf8'))
      return { ...data, config: normalizeConfig(data.config) }
    } catch (error) {
      if (error.code === 'ENOENT')
        return {
          config: { baseUrl: '', model: '', protocol: 'chat-completions' },
          key: '',
          capabilities: null
        }
      throw new Error('本机 AI 配置损坏，请重新保存配置', { cause: error })
    }
  }
  async function write(data) {
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file + '.tmp', JSON.stringify(data), { mode: 0o600 })
    await rename(file + '.tmp', file)
  }
  function mutate(fn) {
    const result = queue.then(fn)
    queue = result.catch(() => {})
    return result
  }
  return {
    async publicSettings() {
      const data = await read()
      if (data.key) await codec('Unprotect', data.key)
      return {
        ...data.config,
        configured: !!data.key,
        capabilities: data.capabilities || null,
        revision: data.revision || ''
      }
    },
    async credentials() {
      const data = await read()
      if (!data.key) throw new Error('请先在个人设置中保存 API Key')
      return {
        ...data.config,
        apiKey: await codec('Unprotect', data.key),
        capabilities: data.capabilities,
        revision: data.revision
      }
    },
    save(input) {
      return mutate(async () => {
        const config = normalizeConfig(input)
        let previous
        try {
          previous = await read()
        } catch {
          previous = {}
        }
        const apiKey = String(input.apiKey || '').trim()
        if (apiKey.length > 8192) throw new Error('API Key 长度超出限制')
        if (
          !apiKey &&
          (!previous.key ||
            new URL(config.baseUrl).origin !==
              new URL(previous.config.baseUrl).origin)
        )
          throw new Error('请为该接口重新输入 API Key')
        await write({
          config,
          key: apiKey ? await codec('Protect', apiKey) : previous.key,
          capabilities: null,
          revision: randomUUID()
        })
      })
    },
    deleteKey() {
      return mutate(async () => {
        const data = await read()
        if (data.config.baseUrl)
          await write({
            ...data,
            key: '',
            capabilities: null,
            revision: randomUUID()
          })
      })
    },
    setCapabilities(capabilities, revision) {
      return mutate(async () => {
        const data = await read()
        if (data.revision !== revision)
          throw new Error('配置已变化，请重新测试')
        await write({ ...data, capabilities })
      })
    }
  }
}
