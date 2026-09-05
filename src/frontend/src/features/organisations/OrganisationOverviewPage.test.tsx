import { act, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '../../test/createTestQueryClient'
import { TestQueryClientProvider } from '../../test/TestQueryClientProvider'
import { OrganisationOverviewPage } from './OrganisationOverviewPage'

const organisationId = '01990db2-4a3f-7d35-a2bd-6b69ac9c75be'
const otherId = '01990db2-4a3f-7d35-a2bd-6b69ac9c75bf'
const userId = 'overview-user'
const organisations = [
  { id: organisationId, name: 'Northstar Workforce' },
  { id: otherId, name: 'Cedar Workforce' },
]

describe('OrganisationOverviewPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('waits for membership before requesting totals', () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValue(new Promise<Response>(() => undefined))
    vi.stubGlobal('fetch', fetchMock)
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Loading workspace')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows API totals rather than the number of returned rows', async () => {
    mockRequests()
    renderPage()
    expect(
      await screen.findByRole('link', { name: 'View clients, 45 total' }),
    ).toHaveAttribute('href', `/organisations/${organisationId}/clients`)
    expect(
      screen.getByRole('link', { name: 'View workers, 3 total' }),
    ).toHaveAttribute('href', `/organisations/${organisationId}/workers`)
    expect(
      screen.getByRole('heading', { name: 'Northstar Workforce' }),
    ).toBeVisible()
  })

  it('provides useful empty summaries', async () => {
    mockRequests(0, 0)
    renderPage()
    expect(
      await screen.findByText('Add your first client to get started.'),
    ).toBeVisible()
    expect(
      screen.getByText('Add your first worker to get started.'),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'View workers, 0 total' }),
    ).toBeVisible()
  })

  it('recovers from an organisation lookup failure', async () => {
    const fetchMock = mockRequests()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t load this overview',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('link', { name: 'View clients, 45 total' }),
    ).toBeVisible()
  })

  it('conceals inaccessible organisations without requesting their totals', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]))
    vi.stubGlobal('fetch', fetchMock)
    renderPage()
    expect(
      await screen.findByRole('heading', { name: 'Organisation unavailable' }),
    ).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('link', { name: /View clients/ }),
    ).not.toBeInTheDocument()
  })

  it.each([404, 503])(
    'hides cached totals when a protected refetch fails with %s',
    async (status) => {
      const fetchMock = mockRequests()
      const client = createTestQueryClient()
      renderPage(client)
      await screen.findByRole('link', { name: 'View clients, 45 total' })
      fetchMock.mockResolvedValueOnce(new Response(null, { status }))
      await act(async () => {
        await client.invalidateQueries({
          queryKey: ['workers', userId, organisationId],
        })
      })
      if (status === 404) {
        expect(
          await screen.findByRole('heading', {
            name: 'Organisation unavailable',
          }),
        ).toBeVisible()
      } else {
        expect(await screen.findByRole('alert')).toBeVisible()
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(
          await screen.findByRole('link', { name: 'View workers, 3 total' }),
        ).toBeVisible()
        return
      }
      expect(
        screen.queryByRole('link', { name: /View clients/ }),
      ).not.toBeInTheDocument()
    },
  )

  it('does not carry totals into a different organisation while it loads', async () => {
    const fetchMock = mockRequests()
    renderPage()
    await screen.findByRole('link', { name: 'View clients, 45 total' })
    fetchMock.mockImplementation(async (input) =>
      (typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url) === '/api/organisations'
        ? Response.json(organisations)
        : new Promise<Response>(() => undefined),
    )
    fireEvent.click(screen.getByRole('link', { name: 'Other workspace' }))
    expect(
      await screen.findByRole('heading', { name: 'Cedar Workforce' }),
    ).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Loading overview')
    expect(
      screen.queryByRole('link', { name: /View clients/ }),
    ).not.toBeInTheDocument()
  })
})

function mockRequests(clients = 45, workers = 3) {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    if (url === '/api/organisations')
      return Promise.resolve(Response.json(organisations))
    return Promise.resolve(
      Response.json({
        items: [],
        page: 1,
        pageSize: 20,
        totalCount: url.includes('/clients?') ? clients : workers,
      }),
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage(client = createTestQueryClient()) {
  return render(
    <TestQueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/organisations/${organisationId}`]}>
        <Link to={`/organisations/${otherId}`}>Other workspace</Link>
        <Routes>
          <Route
            path="organisations/:organisationId"
            element={<OrganisationOverviewPage userId={userId} />}
          />
        </Routes>
      </MemoryRouter>
    </TestQueryClientProvider>,
  )
}
