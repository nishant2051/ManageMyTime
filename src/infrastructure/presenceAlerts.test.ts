import { afterEach, describe, expect, it, vi } from 'vitest'
import { PresenceAlerts } from './presenceAlerts'

afterEach(() => vi.unstubAllGlobals())

function audioSetup() {
  const media = {preload:'',volume:0,currentTime:7,pause:vi.fn(),play:vi.fn().mockResolvedValue(undefined)}
  const Audio = vi.fn(function() {return media})
  vi.stubGlobal('Audio',Audio)
  return {alerts:new PresenceAlerts(),media,Audio}
}

describe('presence audio playback', () => {
  it('loads the chime, plays on enable/test, and actually stops on mute', async () => {
    const {alerts,media,Audio} = audioSetup()
    await alerts.enableSound()
    expect(Audio).toHaveBeenCalledWith('/sounds/presence-chime.wav')
    expect(media.volume).toBe(0.8)
    expect(media.currentTime).toBe(0)
    await alerts.chime()
    expect(media.play).toHaveBeenCalledTimes(2)
    alerts.mute()
    expect(media.pause).toHaveBeenCalledOnce()
    await alerts.chime()
    expect(media.play).toHaveBeenCalledTimes(2)
  })
  it('reports denied playback and leaves sound off if enabling fails', async () => {
    const {alerts,media} = audioSetup()
    media.play.mockRejectedValue(new DOMException('Permission denied','NotAllowedError'))
    await expect(alerts.enableSound()).rejects.toThrow('browser blocked sound')
    await alerts.chime()
    expect(media.play).toHaveBeenCalledOnce()
    media.play.mockResolvedValue(undefined)
    await alerts.enableSound()
    expect(media.play).toHaveBeenCalledTimes(2)
  })
  it('reports a later playback interruption instead of silently skipping a prompt sound', async () => {
    const {alerts,media} = audioSetup()
    vi.stubGlobal('Notification',undefined)
    await alerts.enableSound()
    media.play.mockRejectedValue(new DOMException('Interrupted','NotAllowedError'))
    const onError = vi.fn()
    alerts.show('Study',onError)
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining('browser blocked sound')))
  })
})
