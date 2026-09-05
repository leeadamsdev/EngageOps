import { useId, useState, type SyntheticEvent } from 'react'
import { FiAlertCircle } from 'react-icons/fi'

interface NameCreationFormProps {
  heading: string
  description: string
  label: string
  pendingLabel: string
  autoComplete: string
  maxLength: number
  isPending: boolean
  serverError: string | undefined
  requestError: string | null
  onChange: () => void
  onSubmit: (name: string) => void
  onCancel: () => void
}

export function NameCreationForm({
  heading,
  description,
  label,
  pendingLabel,
  autoComplete,
  maxLength,
  isPending,
  serverError,
  requestError,
  onChange,
  onSubmit,
  onCancel,
}: NameCreationFormProps) {
  const headingId = useId()
  const [name, setName] = useState('')
  const [submittedName, setSubmittedName] = useState('')
  const [clientError, setClientError] = useState<string>()
  const nameError =
    clientError ?? (name === submittedName ? serverError : undefined)

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault()
    if (isPending) return
    onChange()
    const form = event.currentTarget
    const nameValue = name.trim()
    if (!nameValue) {
      setClientError(`Enter a ${label.toLowerCase()}`)
      const input = form.elements.namedItem('name')
      if (input instanceof HTMLInputElement) input.focus()
      return
    }
    setClientError(undefined)
    setSubmittedName(name)
    onSubmit(nameValue)
  }

  function changeName(value: string) {
    setName(value)
    setClientError(undefined)
    onChange()
  }

  return (
    <div className="inline-form-enter rounded-panel border border-line bg-surface p-5 shadow-panel sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-ink" id={headingId}>
          {heading}
        </h2>
        <p className="mt-1 text-sm leading-6 wrap-anywhere text-muted">
          {description}
        </p>
      </div>

      <form
        aria-labelledby={headingId}
        className="mt-5"
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="block text-sm font-semibold text-ink" htmlFor="name">
          {label}
        </label>
        <input
          className="form-control mt-2 px-4"
          id="name"
          name="name"
          type="text"
          autoComplete={autoComplete}
          autoFocus
          disabled={isPending}
          maxLength={maxLength}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? 'name-error' : undefined}
          value={name}
          onChange={(event) => {
            changeName(event.target.value)
          }}
        />
        <div className="min-h-6 pt-1" aria-live="polite">
          {nameError && (
            <p
              className="field-error flex items-center gap-1.5 text-sm text-red-700"
              id="name-error"
            >
              <FiAlertCircle aria-hidden="true" className="size-4 shrink-0" />
              {nameError}
            </p>
          )}
        </div>

        {requestError && name === submittedName && (
          <p
            className="mt-2 flex items-start gap-2 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800"
            role="alert"
          >
            <FiAlertCircle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            {requestError}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors duration-200 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:text-muted"
            type="button"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="button-primary min-h-11 px-5"
            type="submit"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <span
                  aria-hidden="true"
                  className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
                />
                {pendingLabel}
              </>
            ) : (
              heading
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
