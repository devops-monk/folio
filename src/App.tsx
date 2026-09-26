import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { Home } from './pages/Home'
import { ToolPage } from './pages/ToolPage'
import { NotFound } from './pages/NotFound'

// HashRouter: GitHub Pages can't rewrite unknown paths to index.html,
// so deep links like #/sign-pdf must live in the hash.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path=":toolId" element={<ToolPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
