import { useState } from 'react'

export function Calculator({ className = '' }) {
  const [input, setInput] = useState('')

  const handleClick = (value) => {
    if (value === 'C') {
      setInput('')
    } else if (value === '⌫') {
      setInput((prev) => prev.slice(0, -1))
    } else if (value === '=') {
      try {
        const sanitized = input
          .replace(/×/g, '*')
          .replace(/÷/g, '/')
          .replace(/\^/g, '**')
          .replace(/√\(/g, 'Math.sqrt(')
          .replace(/sin\(/g, 'Math.sin(')
          .replace(/cos\(/g, 'Math.cos(')
          .replace(/tan\(/g, 'Math.tan(')
          .replace(/log\(/g, 'Math.log10(')
          .replace(/ln\(/g, 'Math.log(')
          .replace(/π/g, 'Math.PI')
          .replace(/e/g, 'Math.E')
        const result = new Function(`return (${sanitized})`)()
        const formatted = Number(result).toFixed(6).replace(/\.?0+$/, '')
        setInput(String(formatted))
      } catch {
        setInput('Error')
      }
    } else {
      if (input === 'Error') setInput(value)
      else setInput((prev) => prev + value)
    }
  }

  const buttons = [
    ['C', '⌫', '(', ')'],
    ['√', '^', 'π', 'e'],
    ['sin', 'cos', 'tan', 'log'],
    ['7', '8', '9', '÷'],
    ['4', '5', '6', '×'],
    ['1', '2', '3', '-'],
    ['0', '.', '=', '+'],
  ]

  return (
    <div className={`rounded-lg border border-border bg-card p-3 ${className}`}>
      <div className="mb-2 rounded-md bg-muted p-3 text-right font-mono text-lg text-foreground">
        {input || '0'}
      </div>
      <div className="grid gap-1.5">
        {buttons.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-4 gap-1.5">
            {row.map((btn) => (
              <button
                key={btn}
                onClick={() => handleClick(btn)}
                className={`min-h-[44px] rounded-md py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:min-h-0 sm:py-2 ${
                  ['=', 'C', '⌫'].includes(btn)
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : ['÷', '×', '-', '+', '^', '√'].includes(btn)
                      ? 'bg-secondary text-secondary-foreground hover:bg-accent'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {btn}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
