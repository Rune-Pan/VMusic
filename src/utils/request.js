import axios from 'axios'
import { isSessionExpired } from './apiResult'

const baseURL = import.meta.env.VITE_NETEASE_API_URL || '/api'

const request = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000
})

function expireSession(response) {
  if (isSessionExpired(response?.data) && response.config?.url !== '/user/account') {
    window.dispatchEvent(new Event('vmusic:session-expired'))
  }
}

request.interceptors.response.use(
  response => {
    expireSession(response)
    return response.data
  },
  error => {
    expireSession(error.response)
    const data = error.response?.data
    const message = data?.message || data?.msg || data?.body?.message || data?.body?.msg
    if (typeof message === 'string') error.message = message
    return Promise.reject(error)
  }
)

export default request
