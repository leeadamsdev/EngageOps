import type { Page } from '@playwright/test'

export async function holdNextRequest(page: Page, pattern: string) {
  const gate = Promise.withResolvers<undefined>()
  const requested = Promise.withResolvers<undefined>()
  await page.route(
    pattern,
    async (route) => {
      requested.resolve(undefined)
      await gate.promise
      await route.continue()
    },
    { times: 1 },
  )
  return {
    requested: requested.promise,
    release: () => {
      gate.resolve(undefined)
    },
  }
}

export const unavailableResponse = {
  status: 503,
  contentType: 'application/problem+json',
  body: JSON.stringify({ status: 503, title: 'Service unavailable' }),
}
