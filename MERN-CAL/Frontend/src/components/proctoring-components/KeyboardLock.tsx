import { useEffect, useState } from 'react'

const KeyboardLock = () => {
  const [isLocked, setIsLocked] = useState(true) // Set initial state to true

  useEffect(() => {
    const disableKeyboard = (event: KeyboardEvent): void => {
      if (isLocked) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener('keydown', disableKeyboard, true)
    window.addEventListener('keyup', disableKeyboard, true)
    window.addEventListener('keypress', disableKeyboard, true)

    return () => {
      window.removeEventListener('keydown', disableKeyboard, true)
      window.removeEventListener('keyup', disableKeyboard, true)
      window.removeEventListener('keypress', disableKeyboard, true)
    }
  }, [isLocked])

  return <div className='keyboard-lock'></div>
}

export default KeyboardLock
