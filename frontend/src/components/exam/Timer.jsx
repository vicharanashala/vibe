import { useEffect, useState } from 'react'

export function Timer({ initialSeconds, onExpire, className = '' }) {
  const [seconds, setSeconds] = useState(initialSeconds)

  useEffect(() => {
    if (seconds <= 0) {
      onExpire?.()
      return
    }
    const id = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(id)
          onExpire?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [seconds, onExpire])

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const isLow = seconds < 300

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-sm font-semibold ${
        isLow ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground'
      } ${className}`}
    >
      <span>Time Left:</span>
      <span>
        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  )
}
