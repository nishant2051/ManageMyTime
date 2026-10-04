import type { Clock, ClockSample } from '../domain/clock'

export class BrowserClock implements Clock {
  sample(): ClockSample {
    return { wallTime: Date.now(), monotonicTime: performance.now() }
  }
}
