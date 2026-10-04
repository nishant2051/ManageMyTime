/** Monotonic values are valid only in the current runtime; never persist them. */
export interface ClockSample {
  readonly wallTime: number
  readonly monotonicTime: number
}
export interface Clock {
  sample(): ClockSample
}
