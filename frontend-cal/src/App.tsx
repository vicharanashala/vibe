import { Outlet } from 'react-router-dom'
import { ThemeProvider } from './components/theme-provider'

function App() {
  return (
    <ThemeProvider defaultTheme='dark' storageKey='vite-ui-theme'>
      <main>
        <Outlet />
      </main>
    </ThemeProvider>
  )
}

export default App
