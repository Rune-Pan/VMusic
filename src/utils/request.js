import axios from 'axios'

const baseURL = import.meta.env.VITE_NETEASE_API_URL || '/api'

const request = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000
})

request.interceptors.response.use(
  response => response.data,
  error => {
    if (
      error.response?.data?.code === 301 &&
      error.response?.data?.msg === '需要登录'
    ) {
      console.warn('登录已过期，请重新登录')
    }
    return Promise.reject(error)
  }
)

export default request
