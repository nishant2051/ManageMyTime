import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { AppEnvironment } from '../app/environment'
import type { WorkSession } from '../domain/workSession'

export function useSessionTracking(environment: AppEnvironment) {
  const snapshot = useSyncExternalStore(environment.sessions.subscribe, environment.sessions.getSnapshot)
  const [history, setHistory] = useState<WorkSession[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const sequence = useRef({value:0})
  const reload = useCallback(async () => {
    const request = ++sequence.current.value
    setLoading(true)
    try {
      const sessions = await environment.history.list()
      if (request === sequence.current.value) { setHistory(sessions); setError('') }
    } catch (cause) {
      if (request === sequence.current.value) setError(cause instanceof Error ? cause.message : 'Session history could not be loaded.')
    } finally { if (request === sequence.current.value) setLoading(false) }
  }, [environment])
  useEffect(() => {
    const counter = sequence.current
    let key = ''
    const refresh = () => {
      const state = environment.sessions.getSnapshot()
      const next = `${state.mode}:${state.records.session?.id ?? ''}`
      if (key !== next) { key = next; void reload() }
    }
    const unsubscribe = environment.sessions.subscribe(refresh)
    refresh()
    return () => { counter.value++; unsubscribe() }
  }, [environment, reload])


  useEffect(() => {
    if (snapshot.mode !== 'running' && snapshot.mode !== 'following') return
    const observe = () => {
      void environment.sessions.observeClock().then(() => {
        const failure = environment.coordination.getError() || environment.presence.getError()
        if (failure) setError(failure instanceof Error ? failure.message : typeof failure === 'string' ? failure : 'Tracking checkpoint could not be saved.')
      }).catch(cause => {
        setError(cause instanceof Error ? cause.message : 'Tracking state could not be checked.')
      })
    }
    const timer = window.setInterval(observe, 1000)
    return () => window.clearInterval(timer)
  }, [environment, snapshot.mode])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await environment.coordination.refresh()
      await environment.presence.tick()
      const failure = environment.coordination.getError() || environment.presence.getError()
      if (failure) setError(failure instanceof Error ? failure.message : String(failure))
      else await reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Tracking could not be refreshed.') }
    finally {setRefreshing(false)}
  }, [environment, reload])
  return {snapshot,history,loading,error,refreshing,reload,refresh}
}
