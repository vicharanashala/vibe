/**
 * ModeToggle Component
 *
 * This component provides a button interface for toggling between light and dark themes.
 * It uses the useTheme hook from a theme provider to manage theme state and transitions.
 *
 * Features:
 * - Toggles between light and dark themes with a single button click
 * - Animated icon transitions between sun and moon based on current theme
 * - Accessible design with screen reader support
 * - Styled with Tailwind CSS for smooth animations and transitions
 * - Responsive icon sizing and positioning
 *
 * Visual Elements:
 * - Sun icon: Visible and rotated in light theme, hidden in dark theme
 * - Moon icon: Visible and rotated in dark theme, hidden in light theme
 * - Button: Outlined style with icon sizing
 *
 * Accessibility:
 * - Includes sr-only text for screen readers
 * - Maintains keyboard navigation support through button element
 */

// Import sun and moon icons from Lucide
import { Moon, Sun } from 'lucide-react'

// Import custom button component and theme hook
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-provider'

// Component for toggling between light and dark themes
export function ModeToggle() {
  // Get current theme and setter function from theme context
  const { theme, setTheme } = useTheme()

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    // Button that triggers theme toggle
    <Button variant='outline' size='icon' onClick={toggleTheme}>
      {/* Sun icon that rotates and scales based on theme */}
      <Sun className='size-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0' />
      {/* Moon icon that rotates and scales based on theme */}
      <Moon className='absolute size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100' />
      {/* Screen reader text for accessibility */}
      <span className='sr-only'>Toggle theme</span>
    </Button>
  )
}
