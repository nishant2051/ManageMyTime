import { useEffect } from 'react'
import type { AppEnvironment } from './environment'
import { TasksScreen } from '../presentation/TasksScreen'

export function App({ environment }: { environment: AppEnvironment }) {
  useEffect(() => environment.coordination.start(), [environment])
  return <TasksScreen environment={environment} />
}
