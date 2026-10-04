import type { SessionEngine } from '../application/sessionEngine'

/** Only the tracking owner creates prompts and resolves deadlines. */
export class PresenceCoordinator {
  private pending = false
  private error = ''
  private activity: {sessionId:string; generation:number; activityAt:number} | null = null
  constructor(private readonly engine: SessionEngine) {}
  getError(): string { return this.error }

  async tick(): Promise<void> {
    if (this.pending) return
    this.pending = true
    try {
      const state = await this.engine.observeClock()
      const {session, active, recovery} = state.records
      if (state.mode !== 'running' || !session || !active || !recovery) { this.activity = null; this.error = ''; return }
      const target = {sessionId:session.id,generation:active.generation}
      const prompt = recovery.pendingConfirmation
      if (prompt && Date.now() >= prompt.graceDeadlineAt) {
        await this.engine.dispatch({type:'answer',...target,promptId:prompt.promptId,answer:'timeout'})
      } else if (this.activity?.sessionId === session.id && this.activity.generation === active.generation && !prompt) {
        const activityAt = this.activity.activityAt
        this.activity = null
        await this.engine.dispatch({type:'activity',...target,activityAt})
        // Activity resets inactivity, but never postpones a periodic check.
        await this.engine.dispatch({type:'presence',...target})
      } else if (!prompt) {
        await this.engine.dispatch({type:'presence',...target})
      }
      this.error = ''
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Presence check could not be saved.'
    } finally { this.pending = false }
  }

  start(): () => void {
    const activity = (event: Event) => {
      if (!event.isTrusted || document.visibilityState === 'hidden') return
      const state = this.engine.getSnapshot()
      if (state.mode === 'running' && state.records.session && state.records.active && !state.records.recovery?.pendingConfirmation) {
        this.activity = {sessionId:state.records.session.id,generation:state.records.active.generation,activityAt:Date.now()}
      }
    }
    const events = ['pointerdown','pointermove','keydown','wheel','touchstart']
    for (const name of events) document.addEventListener(name, activity, {passive:true})
    const timer = window.setInterval(() => { void this.tick() }, 1000)
    return () => {
      window.clearInterval(timer)
      for (const name of events) document.removeEventListener(name, activity)
      this.activity = null
    }
  }
}
