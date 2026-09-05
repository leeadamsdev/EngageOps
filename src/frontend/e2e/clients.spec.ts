import {
  clientsPath,
  csrfHeaders,
  expect,
  seedClients,
  test,
} from './fixtures.ts'
import { holdNextRequest, unavailableResponse } from './network.ts'

test('creates a client from the empty state, validates, restores focus and persists after reload', async ({
  authenticatedPage: page,
  account,
}) => {
  await page.goto(clientsPath(account))
  await expect(
    page.getByRole('heading', { name: 'No clients yet' }),
  ).toBeVisible()
  const add = page.getByRole('button', { name: 'Add client', exact: true })
  await add.click()
  const name = page.getByLabel('Client name')
  await expect(name).toBeFocused()
  await name.fill('   ')
  await name.press('Enter')
  await expect(name).toHaveAccessibleDescription('Enter a client name')
  await expect(name).toBeFocused()
  await name.fill('Discarded client')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(add).toBeFocused()
  await add.press('Enter')
  await expect(name).toHaveValue('')
  await name.fill('  Acorn Consulting  ')
  const pending = await holdNextRequest(page, `**/api${clientsPath(account)}`)
  await name.press('Enter')
  await pending.requested
  try {
    await expect(
      page.getByRole('button', { name: 'Adding client…' }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Cancel', exact: true }),
    ).toBeDisabled()
    await expect(name).toBeDisabled()
  } finally {
    pending.release()
  }
  await expect(page.getByRole('status')).toHaveText(
    'Acorn Consulting was added.',
  )
  await expect(add).toBeFocused()
  const list = page.getByRole('list', { name: 'Clients', exact: true })
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list).toContainText('Acorn Consulting')
  await page.reload()
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list).not.toContainText('Discarded client')
  await expect(list).toContainText('Acorn Consulting')
})

test('paginates all records in order and refreshes cached pages after creation', async ({
  authenticatedPage: page,
  account,
  request,
}) => {
  const names = await seedClients(request, account, 45)
  await page.goto(clientsPath(account))
  const rows = page
    .getByRole('list', { name: 'Clients', exact: true })
    .getByRole('listitem')
  const pagination = page.getByRole('navigation', { name: 'Client pages' })
  const previous = pagination.getByRole('button', { name: 'Previous' })
  const next = pagination.getByRole('button', { name: 'Next', exact: true })
  await expect(rows).toHaveCount(20)
  await expect(previous).toBeDisabled()
  await expect(pagination).toContainText('Page 1 of 3')
  const found: string[] = []
  for (let current = 1; current <= 3; current++) {
    await expect(pagination).toContainText(`Page ${String(current)} of 3`)
    await expect(rows).toHaveCount(current === 3 ? 5 : 20)
    found.push(...(await rows.locator('p:first-child').allTextContents()))
    if (current < 3) await next.click()
  }
  expect(found).toEqual(names)
  await expect(next).toBeDisabled()
  await page.getByRole('button', { name: 'Add client', exact: true }).click()
  await page.getByLabel('Client name').fill('Aardvark Consulting')
  await page.getByLabel('Client name').press('Enter')
  await expect(page.getByRole('status')).toHaveText(
    'Aardvark Consulting was added.',
  )
  await expect(rows).toHaveCount(6)
  await previous.click()
  await expect(pagination).toContainText('Page 2 of 3')
  await previous.click()
  await expect(pagination).toContainText('Page 1 of 3')
  await expect(rows.first()).toContainText('Aardvark Consulting')
  await expect(rows).toHaveCount(20)
})

test('shows client loading and recovers from a failed page request', async ({
  authenticatedPage: page,
  account,
  request,
}) => {
  await seedClients(request, account, 21)
  const pending = await holdNextRequest(page, `**/api${clientsPath(account)}?*`)
  await page.goto(clientsPath(account))
  await pending.requested
  try {
    await expect(page.getByRole('status')).toContainText('Loading clients')
    await expect(
      page.getByRole('button', { name: 'Add client', exact: true }),
    ).toHaveCount(0)
  } finally {
    pending.release()
  }
  await expect(
    page
      .getByRole('list', { name: 'Clients', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(20)
  await page.route(
    `**/api${clientsPath(account)}?*`,
    (route) => route.fulfill(unavailableResponse),
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'We couldn’t load this organisation’s clients',
  )
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(
    page.getByRole('navigation', { name: 'Client pages' }),
  ).toContainText('Page 2 of 2')
  await expect(
    page
      .getByRole('list', { name: 'Clients', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(1)
})

test('retains client input on failure and allows a successful retry', async ({
  authenticatedPage: page,
  account,
}) => {
  await page.goto(clientsPath(account))
  await page.getByRole('button', { name: 'Add client', exact: true }).click()
  await page.getByLabel('Client name').fill('Retry Consulting')
  await page.route(
    `**/api${clientsPath(account)}`,
    (route) => route.fulfill(unavailableResponse),
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Add client', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'We couldn’t add this client right now',
  )
  await expect(page.getByLabel('Client name')).toHaveValue('Retry Consulting')
  await page.getByRole('button', { name: 'Add client', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText(
    'Retry Consulting was added.',
  )
  await expect(
    page
      .getByRole('list', { name: 'Clients', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(1)
})

test('presents server field validation and an unavailable organisation during creation', async ({
  authenticatedPage: page,
  account,
}) => {
  await page.goto(clientsPath(account))
  await page.getByRole('button', { name: 'Add client', exact: true }).click()
  await page.getByLabel('Client name').fill('Validation Consulting')
  await page.route(
    `**/api${clientsPath(account)}`,
    (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          status: 400,
          errors: { name: ['The supplied client name is invalid.'] },
        }),
      }),
    { times: 1 },
  )
  await page.getByLabel('Client name').press('Enter')
  await expect(page.getByLabel('Client name')).toHaveAccessibleDescription(
    'The supplied client name is invalid.',
  )
  await page.getByLabel('Client name').fill('Changed Consulting')
  await expect(page.getByLabel('Client name')).toHaveAttribute(
    'aria-invalid',
    'false',
  )
  await page.route(
    `**/api${clientsPath(account)}`,
    (route) => route.fulfill({ status: 404, json: { status: 404 } }),
    { times: 1 },
  )
  await page.getByLabel('Client name').press('Enter')
  await expect(page.getByRole('alert')).toContainText(
    'the organisation is no longer available',
  )
  await expect(page.getByLabel('Client name')).toHaveValue('Changed Consulting')
})

test('rejects mutations without CSRF and does not persist the rejected client', async ({
  authenticatedPage: page,
  account,
}) => {
  const response = await page.request.post(`/api${clientsPath(account)}`, {
    data: { name: 'Rejected client' },
  })
  expect(response.status()).toBe(400)
  const accepted = await page.request.post(`/api${clientsPath(account)}`, {
    headers: await csrfHeaders(page.request),
    data: { name: 'Accepted client' },
  })
  expect(accepted.status()).toBe(201)
  await page.goto(clientsPath(account))
  await expect(
    page
      .getByRole('list', { name: 'Clients', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(1)
  await expect(page.getByText('Accepted client', { exact: true })).toBeVisible()
  await expect(page.getByText('Rejected client', { exact: true })).toHaveCount(
    0,
  )
})

test('retains keyboard focus when moving to an uncached client page', async ({
  authenticatedPage: page,
  account,
  request,
}) => {
  await seedClients(request, account, 41)
  await page.goto(clientsPath(account))
  const next = page.getByRole('button', { name: 'Next', exact: true })
  await next.scrollIntoViewIfNeeded()
  await next.focus()
  const originalScroll = await page.evaluate(() => window.scrollY)
  const pending = await holdNextRequest(page, `**/api${clientsPath(account)}?*`)
  await page.keyboard.press('Enter')
  await pending.requested
  try {
    await expect(
      page.getByText('Loading page 2…', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'Clients', exact: true }),
    ).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByText('Client 01', { exact: true })).toBeAttached()
    await expect(next).toBeFocused()
    await expect(next).toBeDisabled()
    await page.keyboard.press('Enter')
    await expect(
      page.getByText('Loading page 2…', { exact: true }),
    ).toBeVisible()
    expect(
      Math.abs((await page.evaluate(() => window.scrollY)) - originalScroll),
    ).toBeLessThan(2)
  } finally {
    pending.release()
  }
  await expect(
    page.getByRole('navigation', { name: 'Client pages' }),
  ).toContainText('Page 2 of 3')
  await expect(next).toBeEnabled()
  await expect(next).toBeFocused()
  await expect(next).toBeInViewport()
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - originalScroll),
  ).toBeLessThan(2)
  await page.keyboard.press('Enter')
  await expect(page.getByText('Page 3 of 3', { exact: true })).toBeVisible()
  await expect(next).toBeFocused()
  await expect(next).toBeDisabled()
  await expect(next).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Page 3 of 3', { exact: true })).toBeVisible()
  const previous = page.getByRole('button', { name: 'Previous' })
  await previous.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible()
  await expect(previous).toBeFocused()
  await expect(previous).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible()
  await expect(previous).toBeFocused()
  await expect(previous).toBeDisabled()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible()
})
