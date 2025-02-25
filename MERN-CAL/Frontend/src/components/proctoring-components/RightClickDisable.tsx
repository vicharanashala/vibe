import React, { useEffect } from 'react'

const RightClickDisabler = () => {
  useEffect(() => {
    // Disable right-click functionality
    const handleContextMenu = (e) => {
      e.preventDefault()
    }

    // Add event listener on mount
    document.addEventListener('contextmenu', handleContextMenu)

    // Cleanup event listener on unmount
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])

  return null // No UI is rendered by this component
}

export default RightClickDisabler
