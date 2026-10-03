// Compose repositories and services here as their feature slices are implemented.
export interface AppEnvironment {
  readonly appName: string
}

export function createAppEnvironment(): AppEnvironment {
  return Object.freeze({ appName: 'ManageMyTime' })
}
