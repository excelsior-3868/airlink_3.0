import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

// Attach the bearer token on every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('airlink_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Kick to login on 401.
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && !location.pathname.includes('/login')) {
      localStorage.removeItem('airlink_token')
      location.href = '/login'
    }
    return Promise.reject(error)
  },
)

/** Pull a human message out of our {success,message,errors} envelope. */
export function apiError(e: any): string {
  const d = e?.response?.data
  if (d?.errors) return Object.values(d.errors).flat()[0] as string
  return d?.message || e?.message || 'Something went wrong.'
}

export const API_BASE = API_URL
