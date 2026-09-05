import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TestQueryClientProvider } from '../../test/TestQueryClientProvider'
import { WorkerCreationForm } from './WorkerCreationForm'

const userId = '01990db2-4a3f-7d35-a2bd-6b69ac9c75bd'
const organisationId = '01990db2-4a3f-7d35-a2bd-6b69ac9c75be'

describe('WorkerCreationForm', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses accessible custom validation for a required worker name', () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    renderForm()
    const form = screen.getByRole('form', { name: 'Add worker' })
    fireEvent.submit(form)

    expect(form).toHaveAttribute('novalidate')
    expect(screen.getByText('Enter a worker name')).toBeInTheDocument()
    expect(screen.getByLabelText('Worker name')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByLabelText('Worker name')).toHaveAttribute(
      'aria-describedby',
      'name-error',
    )
    expect(screen.getByLabelText('Worker name')).toHaveFocus()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('associates server validation errors with the worker name', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ token: 'antiforgery-token' }))
        .mockResolvedValueOnce(
          Response.json(
            {
              errors: {
                name: ['Worker name must not contain control characters.'],
              },
            },
            { status: 400 },
          ),
        ),
    )

    renderForm()
    enterWorkerName('Taylor Reed')
    submitForm()

    expect(
      await screen.findByText(
        'Worker name must not contain control characters.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Worker name')).toHaveAttribute(
      'aria-invalid',
      'true',
    )

    fireEvent.change(screen.getByLabelText('Worker name'), {
      target: { value: 'Taylor Smith' },
    })
    expect(
      screen.queryByText('Worker name must not contain control characters.'),
    ).not.toBeInTheDocument()
  })

  it.each([
    [
      404,
      'We couldn’t add this worker because the organisation is no longer available.',
    ],
    [
      503,
      'We couldn’t add this worker right now. Check your connection and try again.',
    ],
  ])('shows a safe failure message for status %s', async (status, message) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ token: 'antiforgery-token' }))
        .mockResolvedValueOnce(new Response(null, { status })),
    )

    renderForm()
    enterWorkerName('Taylor Reed')
    submitForm()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })
})

function renderForm() {
  return render(
    <TestQueryClientProvider>
      <WorkerCreationForm
        organisationId={organisationId}
        organisationName="Northstar Workforce"
        userId={userId}
        onCancel={vi.fn()}
        onCreated={vi.fn()}
      />
    </TestQueryClientProvider>,
  )
}

function enterWorkerName(name: string) {
  fireEvent.change(screen.getByLabelText('Worker name'), {
    target: { value: name },
  })
}

function submitForm() {
  fireEvent.submit(screen.getByRole('form', { name: 'Add worker' }))
}
