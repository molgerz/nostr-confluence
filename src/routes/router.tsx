import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../ui/layout/AppShell'
import { SpaceChooser } from './SpaceChooser'
import { SpaceOverview } from './SpaceOverview'
import { PageView } from './PageView'
import { EditorView } from './EditorView'
import { NewPageView } from './NewPageView'
import { HistoryView } from './HistoryView'
import { BlameView } from './BlameView'
import { Login } from './Login'
import { NotFound } from './NotFound'

/**
 * Routen nach docs/06-ui-information-architecture.md. Der :group-Parameter
 * enthält die vollständige NIP-29-Adresse (host'gruppe), url-kodiert, damit
 * ein Link ohne Zusatzwissen funktioniert.
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <SpaceChooser /> },
      { path: '/login', element: <Login /> },
      { path: '/s/:group', element: <SpaceOverview /> },
      { path: '/s/:group/new', element: <NewPageView /> },
      { path: '/s/:group/:slug', element: <PageView /> },
      { path: '/s/:group/:slug/edit', element: <EditorView /> },
      { path: '/s/:group/:slug/history', element: <HistoryView /> },
      { path: '/s/:group/:slug/blame', element: <BlameView /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
