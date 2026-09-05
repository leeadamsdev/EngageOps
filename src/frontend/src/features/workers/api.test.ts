import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorker, getWorkers } from './api'

const organisationId = '01990db2-4a3f-7d35-a2bd-6b69ac9c75be'
const worker = {
  id: '01990db2-4a3f-7d35-a2bd-6b69ac9c7601',
  organisationId,
  name: 'Alex Morgan',
}
const page = { items: [worker], page: 1, pageSize: 20, totalCount: 1 }

describe('worker API response boundaries', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    { ...page, items: [{ ...worker, organisationId: 'another-organisation' }] },
    { ...page, items: [{ ...worker, name: null }] },
    { ...page, page: 2 },
    { ...page, pageSize: 50 },
    { ...page, totalCount: -1 },
    { ...page, totalCount: 1.5 },
  ])(
    'rejects a list that does not match its tenant and pagination contract: %j',
    async (body) => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(Response.json(body)),
      )

      await expect(
        getWorkers(organisationId, 1, new AbortController().signal),
      ).rejects.toThrow('Workers response was invalid.')
    },
  )

  it('rejects a creation response belonging to another organisation', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ token: 'antiforgery-token' }))
        .mockResolvedValueOnce(
          Response.json(
            { ...worker, organisationId: 'another-organisation' },
            { status: 201 },
          ),
        ),
    )

    await expect(createWorker(organisationId, worker.name)).rejects.toThrow(
      'Create worker response was invalid.',
    )
  })

  it('does not misrepresent an antiforgery failure as name validation', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ token: 'antiforgery-token' }))
        .mockResolvedValueOnce(
          Response.json(
            { status: 400, title: 'Invalid antiforgery token.' },
            { status: 400 },
          ),
        ),
    )

    await expect(
      createWorker(organisationId, worker.name),
    ).rejects.toMatchObject({ status: 400 })
  })
})
