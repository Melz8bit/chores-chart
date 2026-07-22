import { useState } from 'react'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace']

export function PinKeypad({
  onComplete,
  error,
  length = 4,
}: {
  onComplete: (pin: string) => void
  error?: string | null
  length?: number
}) {
  const [digits, setDigits] = useState('')

  function pressDigit(digit: string) {
    if (digits.length >= length) return
    const next = digits + digit
    setDigits(next)
    if (next.length === length) {
      onComplete(next)
      setDigits('')
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-3">
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 border-indigo-600 ${
              i < digits.length ? 'bg-indigo-600' : 'bg-transparent'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, i) => {
          if (key === '') return <div key={i} />
          if (key === 'backspace') {
            return (
              <button
                key={i}
                type="button"
                onClick={() => setDigits((d) => d.slice(0, -1))}
                aria-label="Backspace"
                className="h-16 w-16 rounded-full bg-slate-100 text-xl font-medium text-slate-600 active:scale-95"
              >
                ⌫
              </button>
            )
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => pressDigit(key)}
              className="h-16 w-16 rounded-full bg-slate-100 text-2xl font-semibold text-slate-800 active:scale-95"
            >
              {key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
