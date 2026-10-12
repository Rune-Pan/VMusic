import request from '@/utils/request'

export function loginWithPhone(params) {
  return request({ url: '/login/cellphone', method: 'post', params })
}

// 发送手机验证码（参考 NeteaseCloudMusicApi captcha_sent）
export function captchaSent(params) {
  return request({
    url: '/captcha/sent',
    method: 'get',
    params: { ...params, timestamp: Date.now() }
  })
}

// 手机号 + 验证码登录（login/cellphone 传 captcha 走验证码登录，不传 password）
export function loginWithCaptcha(params) {
  return request({ url: '/login/cellphone', method: 'post', params })
}

export function loginQrCodeKey() {
  return request({
    url: '/login/qr/key',
    method: 'get',
    params: { timestamp: Date.now() }
  })
}

export function loginQrCodeCheck(key) {
  return request({
    url: '/login/qr/check',
    method: 'get',
    params: { key, timestamp: Date.now() }
  })
}

export function logout() {
  return request({ url: '/logout', method: 'post' })
}
