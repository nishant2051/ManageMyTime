/** Alert failures never affect the persisted timer or answer deadline. */
export class PresenceAlerts {
  private audio: HTMLAudioElement | null = null
  private notification: Notification | null = null
  private sound = false

  async enableSound(): Promise<void> {
    if (!this.audio) {
      this.audio = new Audio(`${import.meta.env.BASE_URL}sounds/presence-chime.wav`)
      this.audio.preload = 'auto'
      this.audio.volume = 0.8
    }
    this.sound = true
    try { await this.chime() }
    catch (error) { this.sound = false; throw error }
  }
  mute(): void { this.sound = false; this.audio?.pause() }
  async chime(): Promise<void> {
    if (!this.sound) return
    if (!this.audio) throw new Error('Enable sound before playing the chime.')
    try {
      this.audio.currentTime = 0
      // Called directly from Enable/Test buttons to retain the browser user gesture.
      await this.audio.play()
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        throw new Error('The browser blocked sound. Click Enable sound or Test sound and allow audio for this site.', {cause:error})
      }
      throw new Error('The chime could not play. Check the tab is unmuted and your speaker output, then retry Test sound.', {cause:error})
    }
  }
  show(taskName: string, onError?: (message:string) => void): string {
    this.clear()
    void this.chime().catch(error => onError?.(error instanceof Error ? error.message : 'Sound unavailable. The in-app prompt is still active.'))
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return ''
    try {
      this.notification = new Notification('Are you still working?', {body:`${taskName}: return to ManageMyTime to confirm.`,tag:'manage-my-time-presence'})
      this.notification.onclick = () => { window.focus(); this.clear() }
      this.notification.onerror = () => { this.clear(); onError?.('System notification unavailable. The in-app prompt is still active.') }
      return ''
    } catch { return 'System notification unavailable. Use the in-app prompt or sound.' }
  }
  clear(): void {
    try { this.notification?.close() } catch { /* OS dismissal does not affect tracking. */ }
    this.notification = null
  }
}
