import { useEffect, useRef } from 'react'
import { Keyboard } from './Keyboard.jsx'
import { RichText } from '@/components/exam/RichText'

// Exam paper is always a light sheet, so colors here are explicit (not theme
// tokens) — otherwise the dark app theme makes text/options render white-on-white.
const INK = '#111827'
const MUTED = '#6b7280'

// Black/white is the primary palette; orange is used only as a small accent
// (radio/checkbox accent color + a thin left stripe on the selected option),
// not as a background wash.
const ACCENT = '#F0A93B'

// Some AI-generated questions bake their own "A)"/"B."/"C:" prefix into the
// option TEXT itself, on top of the letter this component already renders
// from `option.label`/index — producing a visible "A. A) ..." double-label
// (same fix applied to the PDF export in ResultPage.jsx). Deliberately
// narrow (A-D only, must be followed by whitespace) to avoid stripping
// genuine option content that happens to start with a lone letter.
const LEADING_OPTION_LABEL_RE = /^[A-Da-d][).:]\s+/
function stripLeadingOptionLabel(text) {
  if (!text) return text
  return text.replace(LEADING_OPTION_LABEL_RE, '')
}

export function QuestionRenderer({ question, response, onChange }) {
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    startTimeRef.current = Date.now()
  }, [question.id])

  const handleOptionChange = (optionId) => {
    if (question.type === 'MCQ') {
      onChange({ selectedOptions: [optionId], isAnswered: true })
    } else if (question.type === 'MSQ') {
      const current = response?.selectedOptions || []
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
      onChange({ selectedOptions: next, isAnswered: next.length > 0 })
    }
  }

  const handleNatChange = (value) => {
    onChange({ natAnswer: value, isAnswered: value.trim() !== '' })
  }

  const handleKeyboardInput = (key) => {
    if (key === 'Backspace') {
      handleNatChange((response?.natAnswer || '').slice(0, -1))
    } else if (key === 'Clear') {
      handleNatChange('')
    } else if (key === '-') {
      const current = response?.natAnswer || ''
      handleNatChange(current.startsWith('-') ? current.slice(1) : `-${current}`)
    } else {
      handleNatChange((response?.natAnswer || '') + key)
    }
  }

  return (
    <div className="space-y-6" style={{ color: INK }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 text-base font-medium leading-relaxed" style={{ color: INK }}>
          <span className="mr-2" style={{ color: MUTED }}>Q.</span>
          <RichText text={question.questionText} />
          {question.questionImage && (
            <div className="mt-3">
              <img
                src={question.questionImage}
                alt="Question"
                className="max-h-[420px] w-auto max-w-full rounded-md object-contain"
                style={{ border: '1px solid #e5e7eb' }}
              />
            </div>
          )}
        </div>
      </div>

      {(question.type === 'MCQ' || question.type === 'MSQ') && question.options && (
        <div
          className="grid gap-3 sm:grid-cols-2"
          role={question.type === 'MCQ' ? 'radiogroup' : 'group'}
          aria-label={question.type === 'MCQ' ? 'Answer options, select one' : 'Answer options, select all that apply'}
        >
          {question.options.map((option) => {
            const isSelected = response?.selectedOptions?.includes(option.id)
            const inputType = question.type === 'MCQ' ? 'radio' : 'checkbox'
            const inputId = `q-${question.id}-opt-${option.id}`
            return (
              <label
                key={option.id}
                htmlFor={inputId}
                style={{
                  backgroundColor: isSelected ? '#F9FAFB' : '#ffffff',
                  borderColor: isSelected ? INK : '#e5e7eb',
                  borderLeft: isSelected ? `3px solid ${ACCENT}` : '1px solid #e5e7eb',
                  color: INK,
                }}
                // min-height keeps the whole tappable row comfortably above
                // the ~44px touch-target guideline even when option text is
                // short and would otherwise let padding alone shrink it.
                className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-gray-50"
              >
                <input
                  id={inputId}
                  type={inputType}
                  name={question.id}
                  value={option.id}
                  checked={!!isSelected}
                  onChange={() => handleOptionChange(option.id)}
                  className="mt-1 h-5 w-5 flex-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  style={{ accentColor: ACCENT }}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold uppercase" style={{ color: MUTED }}>
                      {option.label || option.id}.
                    </span>
                    {option.text && <RichText text={stripLeadingOptionLabel(option.text)} />}
                  </div>
                  {option.image && (
                    <div
                      className="flex h-32 w-full items-center justify-center rounded p-1"
                      style={{ border: '1px solid #e5e7eb', background: '#fff' }}
                    >
                      <img
                        src={option.image}
                        alt={`Option ${option.id}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </label>
            )
          })}
        </div>
      )}

      {question.type === 'NAT' && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: INK }}>
              Enter your answer ({question.natAnswerType === 'decimal' ? 'decimal' : 'integer'})
            </label>
            <input
              type="text"
              inputMode={question.natAnswerType === 'decimal' ? 'decimal' : 'numeric'}
              value={response?.natAnswer || ''}
              onChange={(e) => handleNatChange(e.target.value)}
              placeholder={question.natAnswerType === 'decimal' ? 'e.g. 3.14' : 'e.g. 42'}
              className="w-full rounded-md px-4 py-2 focus:outline-none focus:ring-2"
              style={{ border: '1px solid #d1d5db', background: '#fff', color: INK, '--tw-ring-color': ACCENT }}
            />
          </div>
          <Keyboard onKey={handleKeyboardInput} type={question.natAnswerType} />
        </div>
      )}
    </div>
  )
}