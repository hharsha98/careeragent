import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import Shell from './components/Shell'
import Landing from './pages/Landing'
import Chat from './pages/Chat'
import Tracker from './pages/Tracker'
import Insights from './pages/Insights'

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  {
    element: <Shell />,
    children: [
      { path: '/chat', element: <Chat /> },
      { path: '/tracker', element: <Tracker /> },
      { path: '/insights', element: <Insights /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
