import { useCallback, useEffect, useRef, useState } from 'react'
import { apiError } from './api'

// Simple stale-while-revalidate cache shared across the app. Pages read their
// last result from this module-level store on mount, so navigating back to a
// page renders instantly (no loading flash) while it refreshes in the
// background. Data survives route unmount/remount but not a full page reload.

interface Entry { data: any; ts: number }

const store = new Map<string, Entry>()
const inflight = new Map<string, Promise<any>>()

/** Seed the cache manually (e.g. after a mutation returns fresh data). */
export function primeCache(key: string, data: any): void {
  store.set(key, { data, ts: Date.now() })
}

/** Drop cached entries. No prefix clears everything; a prefix clears matches. */
export function invalidateCache(prefix?: string): void {
  if (!prefix) { store.clear(); return }
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}

export interface QueryResult<T> {
  data: T | undefined
  loading: boolean
  error: string
  refetch: () => void
  setData: (d: T) => void
}

/**
 * Cached data fetch. `key` identifies the resource (include query params in it
 * so different filters/pages cache separately). While cached data exists it is
 * shown immediately; a background refresh runs unless the entry is newer than
 * `staleTime` ms. Concurrent callers for the same key share one request.
 */
export function useQuery<T = any>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { enabled?: boolean; staleTime?: number } = {},
): QueryResult<T> {
  const { enabled = true, staleTime = 20000 } = opts
  const [data, setDataState] = useState<T | undefined>(() => store.get(key)?.data)
  const [loading, setLoading] = useState<boolean>(() => enabled && !store.get(key))
  const [error, setError] = useState('')

  // Keep the latest fetcher without making it a dependency (it's a new closure
  // each render); the key is the real identity of the request.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(async (force: boolean) => {
    if (!enabled) return
    const entry = store.get(key)
    if (entry) { setDataState(entry.data); setLoading(false) }
    else setLoading(true)

    if (!force && entry && Date.now() - entry.ts < staleTime) return

    let p = inflight.get(key)
    if (!p) {
      p = fetcherRef.current()
      inflight.set(key, p)
      p.then((res) => store.set(key, { data: res, ts: Date.now() }))
        .catch(() => {})
        .finally(() => inflight.delete(key))
    }
    try {
      setDataState(await p)
      setError('')
    } catch (e) {
      setError(apiError(e))
    } finally {
      setLoading(false)
    }
  }, [key, enabled, staleTime])

  useEffect(() => { run(false) }, [run])

  const setData = useCallback((d: T) => {
    store.set(key, { data: d, ts: Date.now() })
    setDataState(d)
  }, [key])

  return { data, loading, error, refetch: () => run(true), setData }
}
