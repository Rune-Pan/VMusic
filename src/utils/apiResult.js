// playlist/tracks 等端点可能将业务响应放在 body 中，HTTP 200 不代表写入成功。
export function requireApiSuccess(response, fallback = '操作失败') {
  let result = response
  let succeeded = false
  while (result && typeof result === 'object') {
    if (result.code !== undefined) {
      if (Number(result.code) !== 200) {
        const error = new Error(result.message || result.msg || fallback)
        error.code = Number(result.code)
        throw error
      }
      succeeded = true
    }
    if (!result.body || typeof result.body !== 'object') break
    result = result.body
  }
  if (!succeeded) throw new Error(fallback)
  return result
}

export function isSessionExpired(data) {
  return Number(data?.code) === 301 || Number(data?.body?.code) === 301
}
