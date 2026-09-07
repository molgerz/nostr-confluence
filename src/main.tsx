import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from './theme/theme'
import { SessionProvider } from './session/session'
import { router } from './routes/router'
import './index.css'

async function bootstrap(): Promise<void> {
  // Wegwerf-Signer für die Entwicklung, siehe src/dev/fake-nip07.ts
  if (import.meta.env.DEV) {
    const param = new URLSearchParams(window.location.search).get('devsigner')
    if (param !== null) {
      const { installFakeNip07 } = await import('./dev/fake-nip07')
      installFakeNip07(param)
    }
  }

  const root = document.getElementById('root')
  if (!root) throw new Error('#root fehlt in index.html')

  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}

void bootstrap()
