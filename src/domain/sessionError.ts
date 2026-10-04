export type SessionEngineErrorCode =
  | 'storageUnavailable' | 'invalidState' | 'recoveryRequired' | 'commandUnavailable'
  | 'invalidClock' | 'conflict' | 'staleCommand' | 'validation'

/** Shared domain-safe errors; persistence adapters do not depend on the engine. */
export class SessionEngineError extends Error {
  constructor(readonly code: SessionEngineErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SessionEngineError'
  }
}
