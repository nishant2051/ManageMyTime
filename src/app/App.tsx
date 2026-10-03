import type { AppEnvironment } from './environment'
import { TasksScreen } from '../presentation/TasksScreen'

export function App({ environment }: { environment: AppEnvironment }) {
  return <TasksScreen environment={environment} />
}
