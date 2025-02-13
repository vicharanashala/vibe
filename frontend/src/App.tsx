import { Outlet } from 'react-router-dom'
import { RefreshProvider } from './contextApi/refreshContext'

function App() {
  return (
    <main>
      <RefreshProvider>
        <Outlet />
      </RefreshProvider>
    </main>
  )
}

export default App
