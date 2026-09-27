import type {
  AlertRecord,
  AssistantResponse,
  CachedResponse,
  FarmAdvisory,
  Hillside,
  NdviReading,
  NotificationRecord,
  Page,
  PhotoClassification,
  Terrace,
  WeatherForecast,
} from './types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '')
const CACHE_PREFIX = 'umusaruro:api-cache:'
const CACHE_TTL = 1000 * 60 * 60 * 24

let currentToken: string | null = null

function normalizeAccessToken(token: string | null) {
  if (token === null) return null
  const normalized = token.trim().replace(/^(?:Bearer|Token)\s+/i, '').trim()
  if (/\s/.test(normalized)) {
    throw new Error('Token contains spaces. Paste the token value without extra text.')
  }
  return normalized || null
}

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(message: string, status: number, detail: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  token?: string | null
  signal?: AbortSignal
}

interface CachedEntry<T> {
  value: T
  cachedAt: number
}

export function getApiBaseUrl() {
  return API_BASE_URL
}

export function setAccessToken(token: string | null) {
  currentToken = normalizeAccessToken(token)
}

export function clearReadCache() {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index)
      if (key?.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(key)
    }
  } catch {
    // Storage can be unavailable in private browsing; network requests still work.
  }
}

function cacheKey(path: string, token: string | null): string | null {
  return token ? null : `${CACHE_PREFIX}public:${path}`
}

function readCache<T>(key: string): CachedEntry<T> | null {
  try {
    const stored = sessionStorage.getItem(key)
    if (!stored) return null
    const entry = JSON.parse(stored) as CachedEntry<T>
    if (Date.now() - entry.cachedAt > CACHE_TTL) {
      sessionStorage.removeItem(key)
      return null
    }
    return entry
  } catch {
    return null
  }
}

function writeCache<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ value, cachedAt: Date.now() }))
  } catch {
    // Storage can be unavailable or full; the live response remains usable.
  }
}

function apiUrl(path: string) {
  return `${API_BASE_URL}/${path.replace(/^\/+/, '')}`
}

function reportSync(stale: boolean, cachedAt: number) {
  window.dispatchEvent(new CustomEvent('umusaruro:sync', { detail: { stale, cachedAt } }))
}

function readableError(detail: unknown, fallback: string) {
  if (typeof detail === 'string') {
    return /<!doctype html|<html|traceback \(most recent call last\)|internal server error/i.test(detail)
      ? fallback
      : detail
  }
  if (detail && typeof detail === 'object') {
    const value = detail as Record<string, unknown>
    if (typeof value.detail === 'string') return readableError(value.detail, fallback)
    const messages = Object.entries(value).flatMap(([field, errors]) => {
      const parts = Array.isArray(errors) ? errors : [errors]
      return parts.map((error) => `${field}: ${String(error)}`)
    })
    if (messages.length) return messages.join(' ')
  }
  return fallback
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || ''
  const detail = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '')

  if (!response.ok) {
    if (response.status === 401 && currentToken) {
      currentToken = null
      window.dispatchEvent(new CustomEvent('umusaruro:auth-expired'))
    }

    const fallback = response.status === 401
      ? 'Your session has expired or the token is invalid. Connect again to continue.'
      : response.status === 403
        ? 'This action is not available to your account.'
        : response.status >= 500
          ? 'The service is temporarily unavailable. Please try again.'
          : `Request failed (${response.status}).`
    throw new ApiError(readableError(detail, fallback), response.status, detail)
  }
  return detail as T
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || 'GET'
  const token = options.token === undefined ? currentToken : options.token
  const headers = new Headers({ Accept: 'application/json' })
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }

  const key = method === 'GET' ? cacheKey(path, token) : null
  const previous = key ? readCache<T>(key) : null

  try {
    const response = await fetch(apiUrl(path), {
      method,
      headers,
      body,
      signal: options.signal,
    })
    const result = await parseResponse<T>(response)
    if (key) {
      writeCache(key, result)
      reportSync(false, Date.now())
    }
    return result
  } catch (error) {
    if (key && previous && (!(error instanceof ApiError) || error.status >= 500)) {
      reportSync(true, previous.cachedAt)
      return previous.value
    }
    if (error instanceof ApiError) throw error
    throw new ApiError('Unable to connect. Check your connection and retry.', 0, error)
  }
}

export async function requestCached<T>(path: string, signal?: AbortSignal): Promise<CachedResponse<T>> {
  const key = cacheKey(path, currentToken)
  const previous = key ? readCache<T>(key) : null
  try {
    const data = await request<T>(path, { signal })
    return { data, stale: false, cachedAt: Date.now() }
  } catch (error) {
    if (previous && (!(error instanceof ApiError) || error.status >= 500)) {
      return { data: previous.value, stale: true, cachedAt: previous.cachedAt }
    }
    throw error
  }
}

export async function listAll<T>(path: string): Promise<T[]> {
  const first = await requestCached<Page<T>>(path)
  const items = [...first.data.results]
  let next = first.data.next
  let pages = 1

  while (next && pages < 20 && !first.stale) {
    const nextUrl = new URL(next, window.location.origin)
    const apiBase = new URL(API_BASE_URL, window.location.origin)
    const basePath = apiBase.pathname.replace(/\/+$/, '')
    if (API_BASE_URL.startsWith('http') && nextUrl.origin !== apiBase.origin) break
    if (!nextUrl.pathname.startsWith(`${basePath}/`)) break
    const relativePath = `${nextUrl.pathname.slice(basePath.length)}${nextUrl.search}`
    const page = await request<Page<T>>(relativePath)
    items.push(...page.results)
    next = page.next
    pages += 1
  }
  return items
}

export const api = {
  hillsides: () => listAll<Hillside>('hillsides/'),
  hillside: (id: number) => request<Hillside>(`hillsides/${id}/`),
  terraces: (hillsideId?: number) => listAll<Terrace>(
    `terraces/${hillsideId ? `?hillside_id=${hillsideId}` : ''}`,
  ),
  ndvi: (hillsideId?: number, terraceId?: number) => {
    const params = new URLSearchParams()
    if (hillsideId) params.set('hillside_id', String(hillsideId))
    if (terraceId) params.set('terrace_id', String(terraceId))
    return listAll<NdviReading>(`ndvi-readings/${params.size ? `?${params}` : ''}`)
  },
  alerts: (hillsideId?: number) => listAll<AlertRecord>(
    `alerts/${hillsideId ? `?hillside_id=${hillsideId}` : ''}`,
  ),
  notifications: () => listAll<NotificationRecord>('notifications/'),
  weather: (hillsideId: number) => requestCached<WeatherForecast>(
    `weather/forecast/?hillside_id=${hillsideId}`,
  ),
  advisories: (hillsideId?: number) => listAll<FarmAdvisory>(
    `advisories/${hillsideId ? `?hillside_id=${hillsideId}` : ''}`,
  ),
  reviewAlert: (id: number, status: 'confirmed' | 'dismissed', farmerAdvice?: string) =>
    request<AlertRecord>(`alerts/${id}/review/`, {
      method: 'PATCH',
      body: { status, ...(farmerAdvice ? { farmer_advice: farmerAdvice } : {}) },
    }),
  createAdvisory: (advisory: Pick<FarmAdvisory, 'title' | 'message' | 'crop'> & {
    hillside: number | null
    valid_until: string | null
  }) => request<FarmAdvisory>('advisories/', { method: 'POST', body: advisory }),
  updateAdvisory: (id: number, advisory: Partial<FarmAdvisory>) =>
    request<FarmAdvisory>(`advisories/${id}/`, { method: 'PATCH', body: advisory }),
  deleteAdvisory: (id: number) => request<void>(`advisories/${id}/`, { method: 'DELETE' }),
  publishAdvisory: (id: number) => request<FarmAdvisory>(`advisories/${id}/publish/`, { method: 'POST' }),
  withdrawAdvisory: (id: number) => request<FarmAdvisory>(`advisories/${id}/withdraw/`, { method: 'POST' }),
  classifyPhoto: (photo: File, terraceId: number) => {
    const form = new FormData()
    form.set('photo', photo)
    form.set('terrace_id', String(terraceId))
    return request<PhotoClassification>('alerts/classify-photo/', { method: 'POST', body: form })
  },
  askAssistant: (question: string) => request<AssistantResponse>('assistant/ask/', {
    method: 'POST',
    body: { question },
  }),
  login: (payload: { username?: string; email?: string; password: string }) => request<{ access: string; refresh: string; user: { id: number; username: string; email: string; role: string; first_name: string; last_name: string } }>('auth/login/', {
    method: 'POST',
    body: payload,
  }),
  register: (payload: { first_name?: string; last_name?: string; email: string; password: string; username?: string }) => request<{ access: string; refresh: string; user: { id: number; username: string; email: string; role: string; first_name: string; last_name: string } }>('auth/register/', {
    method: 'POST',
    body: payload,
  }),
  googleLogin: (credential: string) => request<{ access: string; refresh: string; user: { id: number; username: string; email: string; role: string; first_name: string; last_name: string } }>('auth/google/', {
    method: 'POST',
    body: { credential },
  }),
  me: () => request<{ id: number; username: string; email: string; role: string; first_name: string; last_name: string; is_staff: boolean; is_superuser: boolean }>('auth/me/'),
}

export async function verifyToken(candidate: string) {
  const token = normalizeAccessToken(candidate)
  if (!token) throw new Error('Enter an API token to connect.')
  const profile = await request<{ role: string; email: string; username: string }>('auth/me/', { token })
  clearReadCache()
  currentToken = token
  return { isTrainer: profile.role === 'trainer' || profile.role === 'agronomist' }
}