import { useEffect, useEffectEvent, useState } from 'react'
import { ApiError } from './api/client'

export interface ResourceState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useResource<T>(key: string, loader: () => Promise<T>): ResourceState<T> {
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean; error: string | null }>(() => ({
    key,
    data: null,
    loading: true,
    error: null,
  }))
  const [revision, setRevision] = useState(0)
  const load = useEffectEvent(loader)

  useEffect(() => {
    let active = true
    load()
      .then((data) => {
        if (active) setState({ key, data, loading: false, error: null })
      })
      .catch((reason: unknown) => {
        if (active) setState({
          key,
          data: null,
          loading: false,
          error: reason instanceof ApiError ? reason.message : 'Unable to load this information.',
        })
      })
    return () => { active = false }
  }, [key, revision])

  const isCurrent = state.key === key
  return {
    data: isCurrent ? state.data : null,
    loading: !isCurrent || state.loading,
    error: isCurrent ? state.error : null,
    reload: () => setRevision((current) => current + 1),
  }
}

export function useNetworkState() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}