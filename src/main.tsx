import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createAppEnvironment } from './app/environment'
import { App } from './app/App'
import './presentation/styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Application root is missing')

createRoot(root).render(
  <StrictMode>
    <App environment={createAppEnvironment()} />
  </StrictMode>,
)
