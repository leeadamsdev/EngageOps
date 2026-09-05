import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '../../test/createTestQueryClient'
import { TestQueryClientProvider } from '../../test/TestQueryClientProvider'
import { WorkersPage } from './WorkersPage'
import { useWorkers } from './useWorkers'

const userId = '01990db2-4a3f-7d35-a2bd-6b69ac9c75bd'
const organisationId = '01990db2-4a3f-7d35-a2bd-6b69ac9c75be'

describe('WorkersPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows a loading state while workers are requested', () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockReturnValue(new Promise<Response>(() => undefined)),
    )

    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Loading workers…')
  })

  it('lists the selected organisations workers', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(organisationsResponse())
      .mockResolvedValueOnce(
        workerPageResponse(['Amelia Brooks', 'Zoe Carter']),
      )
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    expect(await screen.findByText('Amelia Brooks')).toBeInTheDocument()
    expect(screen.getByText('Zoe Carter')).toBeInTheDocument()
    expect(
      screen.getByText('Manage this organisation’s workers.'),
    ).toBeInTheDocument()
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(
      within(breadcrumb).getByRole('link', { name: 'Organisations' }),
    ).toHaveAttribute('href', '/organisations')
    expect(
      within(breadcrumb).getByText('Northstar Workforce'),
    ).toBeInTheDocument()
    expect(within(breadcrumb).getByText('Workers')).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.getByText('Northstar Workforce', { selector: 'p' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Workers' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/organisations/${organisationId}/workers?page=1&pageSize=20`,
      expect.objectContaining({
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      }),
    )
  })

  it('accepts canonical organisation identifiers for an uppercase route', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(organisationsResponse())
        .mockResolvedValueOnce(workerPageResponse(['Amelia Brooks'])),
    )

    renderPage(createTestQueryClient(), organisationId.toUpperCase())

    expect(await screen.findByText('Amelia Brooks')).toBeInTheDocument()
    expect(
      screen.queryByText('We couldn’t load this organisation’s workers'),
    ).not.toBeInTheDocument()
  })

  it('shows an empty state when the organisation has no workers', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(organisationsResponse())
        .mockResolvedValueOnce(workerPageResponse([])),
    )

    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'No workers yet' }),
    ).toBeInTheDocument()
  })

  it('returns focus to Add worker when creation is cancelled', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(organisationsResponse())
        .mockResolvedValueOnce(workerPageResponse([])),
    )

    renderPage()
    expect(
      await screen.findByRole('heading', { name: 'No workers yet' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add worker' }))
    expect(screen.getByLabelText('Worker name')).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(
      screen.queryByRole('form', { name: 'Add worker' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add worker' })).toHaveFocus()
  })

  it('adds a worker and refreshes the organisation worker list', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(organisationsResponse())
      .mockResolvedValueOnce(workerPageResponse([]))
      .mockResolvedValueOnce(Response.json({ token: 'antiforgery-token' }))
      .mockResolvedValueOnce(createdWorkerResponse('Alex Morgan'))
      .mockResolvedValueOnce(workerPageResponse(['Alex Morgan']))
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    expect(
      await screen.findByRole('heading', { name: 'No workers yet' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add worker' }))
    expect(screen.getByLabelText('Worker name')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Worker name'), {
      target: { value: '  Alex Morgan  ' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Add worker' }))

    expect(await screen.findByText('Alex Morgan was added.')).toBeVisible()
    expect(await screen.findByText('Alex Morgan')).toBeInTheDocument()
    expect(
      screen.queryByRole('form', { name: 'Add worker' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add worker' })).toHaveFocus()
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      `/api/organisations/${organisationId}/workers`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': 'antiforgery-token',
        },
        body: JSON.stringify({ name: 'Alex Morgan' }),
      },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      `/api/organisations/${organisationId}/workers?page=1&pageSize=20`,
      expect.any(Object),
    )
  })

  it('does not expose whether an unavailable organisation exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(organisationsResponse())
        .mockResolvedValueOnce(new Response(null, { status: 404 })),
    )

    renderPage()

    expect(
      await screen.findByRole('heading', {
        name: 'Organisation unavailable',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /may no longer exist, or your account may no longer have access/,
      ),
    ).toBeInTheDocument()
  })

  it('allows a failed request to be retried', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(organisationsResponse())
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(workerPageResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t load this organisation’s workers',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('heading', { name: 'No workers yet' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('requests the next server page without carrying over previous results', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(organisationsResponse())
      .mockResolvedValueOnce(workerPageResponse(['Amelia Brooks'], 1, 21))
      .mockResolvedValueOnce(workerPageResponse(['Zoe Carter'], 2, 21))
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    expect(await screen.findByText('Amelia Brooks')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Zoe Carter')).toBeInTheDocument()
    expect(screen.queryByText('Amelia Brooks')).not.toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/organisations/${organisationId}/workers?page=2&pageSize=20`,
      expect.any(Object),
    )
  })

  it('does not show cached workers when access is lost during a refetch', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(organisationsResponse())
      .mockResolvedValueOnce(workerPageResponse(['Amelia Brooks']))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    const queryClient = createTestQueryClient()

    renderPage(queryClient)
    expect(await screen.findByText('Amelia Brooks')).toBeInTheDocument()

    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ['workers', userId, organisationId, 1],
      })
    })

    expect(
      await screen.findByRole('heading', {
        name: 'Organisation unavailable',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Amelia Brooks')).not.toBeInTheDocument()
  })

  it('retains the displayed page during loading and blocks repeated navigation', async () => {
    let finishRequest: () => void = () => undefined
    const nextPage = new Promise<Response>((resolve) => {
      finishRequest = () => {
        resolve(workerPageResponse(['Zoe Carter'], 2, 41))
      }
    })
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(organisationsResponse())
      .mockResolvedValueOnce(workerPageResponse(['Amelia Brooks'], 1, 41))
      .mockReturnValueOnce(nextPage)
    vi.stubGlobal('fetch', fetchMock)
    renderPage()
    await screen.findByText('Amelia Brooks')
    const next = screen.getByRole('button', { name: 'Next' })
    fireEvent.click(next)
    expect(await screen.findByText('Loading page 2…')).toBeInTheDocument()
    expect(screen.getByText('Amelia Brooks')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Workers' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    expect(next).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(next)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    act(() => {
      finishRequest()
    })
    expect(await screen.findByText('Zoe Carter')).toBeInTheDocument()
    expect(screen.queryByText('Amelia Brooks')).not.toBeInTheDocument()
    expect(next).toHaveAttribute('aria-disabled', 'false')
  })

  it.each(['user', 'organisation'] as const)(
    'never carries placeholder workers across a changed %s',
    async (boundary) => {
      const client = createTestQueryClient()
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(workerPageResponse(['Private worker']))
          .mockReturnValue(new Promise<Response>(() => undefined)),
      )
      const { result, rerender } = renderHook(
        ({ user, organisation }) => useWorkers(user, organisation, 1),
        {
          initialProps: { user: userId, organisation: organisationId },
          wrapper: ({ children }) => (
            <TestQueryClientProvider client={client}>
              {children}
            </TestQueryClientProvider>
          ),
        },
      )
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
      rerender({
        user: boundary === 'user' ? 'another-user' : userId,
        organisation:
          boundary === 'organisation' ? 'another-organisation' : organisationId,
      })
      expect(result.current.isPending).toBe(true)
      expect(result.current.data).toBeUndefined()
    },
  )
  it.each([503, 401, 403, 404])(
    'preserves drafts only while organisation access remains available after a %s refetch',
    async (status) => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(organisationsResponse())
        .mockResolvedValueOnce(workerPageResponse([]))
        .mockResolvedValueOnce(new Response(null, { status }))
        .mockResolvedValueOnce(workerPageResponse([]))
      vi.stubGlobal('fetch', fetchMock)
      const client = createTestQueryClient()
      renderPage(client)
      fireEvent.click(await screen.findByRole('button', { name: 'Add worker' }))
      fireEvent.change(screen.getByLabelText('Worker name'), {
        target: { value: 'Unsaved draft' },
      })
      await act(async () => {
        await client.invalidateQueries({
          queryKey: ['workers', userId, organisationId],
        })
      })
      if (status !== 503) {
        await waitFor(() =>
          expect(
            screen.queryByRole('form', { name: 'Add worker' }),
          ).not.toBeInTheDocument(),
        )
        return
      }
      await screen.findByRole('alert')
      expect(screen.getByLabelText('Worker name')).toHaveValue('Unsaved draft')
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      await waitFor(() =>
        expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
      )
      expect(screen.getByRole('button', { name: 'Add worker' })).toHaveFocus()
    },
  )

  it('keeps pending creation and success feedback through a failed background refetch', async () => {
    let finishCreation: () => void = () => undefined
    const pending = new Promise<Response>((resolve) => {
      finishCreation = () => {
        resolve(createdWorkerResponse('Saved name'))
      }
    })
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(organisationsResponse())
      .mockResolvedValueOnce(workerPageResponse([]))
      .mockResolvedValueOnce(Response.json({ token: 'antiforgery-token' }))
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(workerPageResponse(['Saved name']))
    vi.stubGlobal('fetch', fetchMock)
    const client = createTestQueryClient()
    renderPage(client)
    fireEvent.click(await screen.findByRole('button', { name: 'Add worker' }))
    fireEvent.change(screen.getByLabelText('Worker name'), {
      target: { value: 'Saved name' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Add worker' }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })
    await act(async () => {
      await client.invalidateQueries({
        queryKey: ['workers', userId, organisationId],
      })
    })
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Worker name')).toHaveValue('Saved name')
    expect(screen.getByLabelText('Worker name')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    act(finishCreation)
    expect(await screen.findByText('Saved name was added.')).toBeVisible()
    expect(
      screen.queryByRole('form', { name: 'Add worker' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add worker' })).toHaveFocus()
    expect(screen.getByText('Saved name')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })
})

function renderPage(
  client = createTestQueryClient(),
  routeOrganisationId = organisationId,
) {
  return render(
    <TestQueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[`/organisations/${routeOrganisationId}/workers`]}
      >
        <Routes>
          <Route
            path="organisations/:organisationId/workers"
            element={<WorkersPage userId={userId} />}
          />
        </Routes>
      </MemoryRouter>
    </TestQueryClientProvider>,
  )
}

function workerPageResponse(
  names: string[],
  page = 1,
  totalCount = names.length,
) {
  return Response.json({
    items: names.map((name, index) => ({
      id: `01990db2-4a3f-7d35-a2bd-6b69ac9c7${(600 + index).toString()}`,
      organisationId,
      name,
    })),
    page,
    pageSize: 20,
    totalCount,
  })
}

function organisationsResponse() {
  return Response.json([
    {
      id: organisationId,
      name: 'Northstar Workforce',
    },
  ])
}

function createdWorkerResponse(name: string) {
  return Response.json(
    {
      id: '01990db2-4a3f-7d35-a2bd-6b69ac9c7601',
      organisationId,
      name,
    },
    { status: 201 },
  )
}
