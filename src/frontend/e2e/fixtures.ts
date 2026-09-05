import { randomUUID } from 'node:crypto'
import {
  test as base,
  expect,
  type APIRequestContext,
  type Page,
} from '@playwright/test'
import { isRecord } from '../src/lib/json.ts'

export async function csrfHeaders(request: APIRequestContext) {
  const response = await request.get('/api/auth/csrf')
  expect(response.status()).toBe(200)
  const body: unknown = await response.json()
  if (!isRecord(body) || typeof body.token !== 'string') {
    throw new Error('Expected an antiforgery token from the API')
  }
  return { 'X-CSRF-TOKEN': body.token }
}

export async function registerAccount(
  request: APIRequestContext,
  organisationName = 'Browser Test Workforce',
) {
  const email = `e2e-${randomUUID()}@engageops.test`
  const password = `E2e-${randomUUID()}!`
  const response = await request.post('/api/auth/register', {
    headers: await csrfHeaders(request),
    data: { email, password, organisationName },
  })
  expect(response.status()).toBe(201)
  const body: unknown = await response.json()
  if (!isRecord(body) || typeof body.organisationId !== 'string') {
    throw new Error('Expected an organisation ID from registration')
  }
  return {
    email,
    password,
    organisationName,
    organisationId: body.organisationId,
  }
}

export async function signIn(page: Page, account: Account) {
  await page.getByLabel('Email address').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Organisations', exact: true }),
  ).toBeVisible()
}

export function clientsPath(account: Account) {
  return `/organisations/${account.organisationId}/clients`
}

export function workersPath(account: Account) {
  return `/organisations/${account.organisationId}/workers`
}

export function seedClients(
  request: APIRequestContext,
  account: Account,
  count: number,
) {
  return seedNames(request, clientsPath(account), 'Client', count)
}

export function seedWorkers(
  request: APIRequestContext,
  account: Account,
  count: number,
) {
  return seedNames(request, workersPath(account), 'Worker', count)
}

async function seedNames(
  request: APIRequestContext,
  path: string,
  prefix: string,
  count: number,
) {
  const headers = await csrfHeaders(request)
  const names = Array.from(
    { length: count },
    (_, index) => `${prefix} ${String(index + 1).padStart(2, '0')}`,
  )
  for (const name of names) {
    const response = await request.post(`/api${path}`, {
      headers,
      data: { name },
    })
    expect(response.status()).toBe(201)
  }
  return names
}

type Account = Awaited<ReturnType<typeof registerAccount>>

export const test = base.extend<{ account: Account; authenticatedPage: Page }>({
  account: async ({ request }, use) => {
    await use(await registerAccount(request))
  },
  authenticatedPage: async ({ page, request, account }, use) => {
    await page.context().addCookies((await request.storageState()).cookies)
    await page.goto('/organisations')
    await expect(
      page.getByRole('link', {
        name: `Open workspace for ${account.organisationName}`,
      }),
    ).toBeVisible()
    await use(page)
  },
})

export { expect } from '@playwright/test'
