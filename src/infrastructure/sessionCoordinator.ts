import type { SessionEngine } from '../application/sessionEngine'

export const sessionCheckpointIntervalMilliseconds = 15_000

/** Notifications are hints; IndexedDB transactions remain the ownership authority. */
export class SessionCoordinator {
  private stop: (() => void) | null = null
  private pending: Promise<void> | null = null
  private error: unknown = null

  constructor(private readonly engine: SessionEngine) {}

  getError(): unknown { return this.error }

  refresh(): Promise<void> {
    if (this.pending) return this.pending
    this.pending = (async () => {
      const snapshot = await this.engine.reconcile()
      if (snapshot.mode === 'running' && snapshot.records.session && snapshot.records.active) {
        await this.engine.dispatch({type:'checkpoint',sessionId:snapshot.records.session.id,generation:snapshot.records.active.generation})
      }
      this.error = null
    })().catch(error => { this.error = error }).finally(() => { this.pending = null })
    return this.pending
  }

  start(): () => void {
    if (this.stop) return this.stop
    let channel: BroadcastChannel | null = null
    try {
      if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel('manage-my-time-session')
    } catch { /* Polling remains available when channels are restricted. */ }
    const refresh = () => { void this.refresh() }
    // Receiving a hint reconciles only: it must not create a notification echo loop.
    const onMessage = (event: MessageEvent) => {
      if (event.data === 'changed') void this.engine.reconcile().catch(error => { this.error = error })
    }
    if (channel) channel.onmessage = onMessage
    const unsubscribe = this.engine.subscribeCommitted(() => channel?.postMessage('changed'))
    const timer = window.setInterval(refresh, sessionCheckpointIntervalMilliseconds)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('pageshow', refresh)
    window.addEventListener('focus', refresh)
    refresh()
    let stopped = false
    this.stop = () => {
      if (stopped) return
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('pageshow', refresh)
      window.removeEventListener('focus', refresh)
      unsubscribe()
      channel?.close()
      this.stop = null
    }
    return this.stop
  }
}
