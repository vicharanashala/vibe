export function Keyboard({ onKey, type = 'integer' }) {
  const rows = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['0', '.', '-'],
    ['Backspace', 'Clear'],
  ]

  const handleClick = (key) => {
    if (key === '.' && type !== 'decimal') return
    onKey(key)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="grid grid-cols-3 gap-2">
        {rows.flat().map((key) => {
          const isAction = key === 'Backspace' || key === 'Clear'
          const disabled = key === '.' && type !== 'decimal'
          return (
            <button
              key={key}
              disabled={disabled}
              onClick={() => handleClick(key)}
              className={`min-h-[44px] rounded-md py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:min-h-0 sm:py-2 ${
                isAction
                  ? 'col-span-1 bg-secondary text-secondary-foreground hover:bg-accent'
                  : 'bg-muted text-muted-foreground hover:bg-accent disabled:opacity-40'
              }`}
            >
              {key === 'Backspace' ? '⌫' : key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
