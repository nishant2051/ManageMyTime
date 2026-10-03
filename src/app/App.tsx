import type { AppEnvironment } from './environment'
import { WelcomeScreen } from '../presentation/WelcomeScreen'

export function App({ environment }: { environment: AppEnvironment }) {
  return <WelcomeScreen appName={environment.appName} />
}
