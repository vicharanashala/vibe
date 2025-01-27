/**
 * Theme Provider Component
 *
 * This component provides theme management functionality with the following features:
 * - Supports dark, light and system theme modes
 * - Persists theme preference in localStorage
 * - Automatically syncs with system theme preferences
 * - Provides theme context to child components
 * - TypeScript support with proper type definitions
 *
 * Props:
 * - children: Child components that will have access to theme context
 * - defaultTheme: Initial theme preference (defaults to 'system')
 * - storageKey: Key used for localStorage (defaults to 'vite-ui-theme')
 *
 * Usage:
 * Wrap your app with ThemeProvider and use useTheme hook in children
 * to access and modify current theme.
 */

import React, { createContext, useContext, useEffect, useState } from 'react'

// Define available theme options
type Theme = 'dark' | 'light' | 'system'

// Props interface for ThemeProvider component
type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

// State interface for theme context
type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

// Initial context state
const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
}

// Create context for theme state
const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

// Main ThemeProvider component
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  // Initialize theme state from localStorage or default
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  // Effect to update document classes based on theme
  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  // Context value with theme state and setter
  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

// Custom hook to use theme context
export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
