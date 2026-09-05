import {
  clientsPath,
  workersPath,
  csrfHeaders,
  expect,
  seedWorkers,
  test,
  registerAccount,
} from './fixtures.ts'
import { holdNextRequest, unavailableResponse } from './network.ts'

test('enters workers through organisation navigation and preserves deep links', async ({
  authenticatedPage: page,
  account,
}) => {
  const navigation = page.getByRole('navigation', { name: 'Primary' })
  await expect(
    navigation.getByRole('link', { name: 'Workers', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('link', {
      name: `Open workspace for ${account.organisationName}`,
    })
    .click()
  const workers = navigation.getByRole('link', { name: 'Workers', exact: true })
  await workers.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(workersPath(account))
  await expect(workers).toHaveAttribute('aria-current', 'page')
  await expect(
    navigation.getByRole('link', { name: 'Clients', exact: true }),
  ).not.toHaveAttribute('aria-current')
  const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(breadcrumb).toContainText(account.organisationName)
  await expect(
    breadcrumb.getByText('Workers', { exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'No workers yet' }),
  ).toBeVisible()
  await navigation.getByRole('link', { name: 'Clients', exact: true }).click()
  await expect(page).toHaveURL(clientsPath(account))
  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'Workers', exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Switch organisation' }).click()
  await expect(page).toHaveURL('/organisations')
  await expect(workers).toHaveCount(0)
})

test('hides worker data when a cookie expires during creation', async ({
  authenticatedPage: page,
  account,
}) => {
  await page.goto(workersPath(account))
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  await page.getByLabel('Worker name').fill('Expired session worker')
  await page.context().clearCookies({ name: 'EngageOps.Authentication' })
  await page.getByLabel('Worker name').press('Enter')
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0)
  await expect(page.getByLabel('Worker name')).toHaveCount(0)
})

test('creates a worker from the empty state, validates, restores focus and persists after reload', async ({
  authenticatedPage: page,
  account,
}) => {
  await page.goto(workersPath(account))
  await expect(
    page.getByRole('heading', { name: 'No workers yet' }),
  ).toBeVisible()
  const add = page.getByRole('button', { name: 'Add worker', exact: true })
  await add.click()
  const name = page.getByLabel('Worker name')
  await expect(name).toBeFocused()
  await name.fill('   ')
  await name.press('Enter')
  await expect(name).toHaveAccessibleDescription('Enter a worker name')
  await expect(name).toBeFocused()
  await name.fill('Discarded worker')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(add).toBeFocused()
  await add.press('Enter')
  await expect(name).toHaveValue('')
  await name.fill('  Alex Morgan  ')
  const pending = await holdNextRequest(page, `**/api${workersPath(account)}`)
  await name.press('Enter')
  await pending.requested
  try {
    await expect(
      page.getByRole('button', { name: 'Adding worker…' }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Cancel', exact: true }),
    ).toBeDisabled()
    await expect(name).toBeDisabled()
  } finally {
    pending.release()
  }
  await expect(page.getByRole('status')).toHaveText('Alex Morgan was added.')
  await expect(add).toBeFocused()
  const list = page.getByRole('list', { name: 'Workers', exact: true })
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list).toContainText('Alex Morgan')
  await page.reload()
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list).not.toContainText('Discarded worker')
  await expect(list).toContainText('Alex Morgan')
})

test('paginates all records in order and refreshes cached pages after creation', async ({
  authenticatedPage: page,
  account,
  request,
}) => {
  const names = await seedWorkers(request, account, 45)
  await page.goto(workersPath(account))
  const rows = page
    .getByRole('list', { name: 'Workers', exact: true })
    .getByRole('listitem')
  const pagination = page.getByRole('navigation', { name: 'Worker pages' })
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
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  await page.getByLabel('Worker name').fill('Aaron Brooks')
  await page.getByLabel('Worker name').press('Enter')
  await expect(page.getByRole('status')).toHaveText('Aaron Brooks was added.')
  await expect(rows).toHaveCount(6)
  await previous.click()
  await expect(pagination).toContainText('Page 2 of 3')
  await previous.click()
  await expect(pagination).toContainText('Page 1 of 3')
  await expect(rows.first()).toContainText('Aaron Brooks')
  await expect(rows).toHaveCount(20)
})

test('shows worker loading and recovers from a failed page request', async ({
  authenticatedPage: page,
  account,
  request,
}) => {
  await seedWorkers(request, account, 21)
  const pending = await holdNextRequest(page, `**/api${workersPath(account)}?*`)
  await page.goto(workersPath(account))
  await pending.requested
  try {
    await expect(page.getByRole('status')).toContainText('Loading workers')
    await expect(
      page.getByRole('button', { name: 'Add worker', exact: true }),
    ).toHaveCount(0)
  } finally {
    pending.release()
  }
  await expect(
    page
      .getByRole('list', { name: 'Workers', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(20)
  await page.route(
    `**/api${workersPath(account)}?*`,
    (route) => route.fulfill(unavailableResponse),
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'We couldn’t load this organisation’s workers',
  )
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(
    page.getByRole('navigation', { name: 'Worker pages' }),
  ).toContainText('Page 2 of 2')
  await expect(
    page
      .getByRole('list', { name: 'Workers', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(1)
})

test('retains worker input on failure and allows a successful retry', async ({
  authenticatedPage: page,
  account,
}) => {
  await page.goto(workersPath(account))
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  await page.getByLabel('Worker name').fill('Taylor Reed')
  await page.route(
    `**/api${workersPath(account)}`,
    (route) => route.fulfill(unavailableResponse),
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'We couldn’t add this worker right now',
  )
  await expect(page.getByLabel('Worker name')).toHaveValue('Taylor Reed')
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Taylor Reed was added.')
  await expect(
    page
      .getByRole('list', { name: 'Workers', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(1)
})

test('presents server field validation and an unavailable organisation during creation', async ({
  authenticatedPage: page,
  account,
}) => {
  await page.goto(workersPath(account))
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  await page.getByLabel('Worker name').fill('Jamie Carter')
  await page.route(
    `**/api${workersPath(account)}`,
    (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          status: 400,
          errors: { name: ['The supplied worker name is invalid.'] },
        }),
      }),
    { times: 1 },
  )
  await page.getByLabel('Worker name').press('Enter')
  await expect(page.getByLabel('Worker name')).toHaveAccessibleDescription(
    'The supplied worker name is invalid.',
  )
  await page.getByLabel('Worker name').fill('Jamie Reed')
  await expect(page.getByLabel('Worker name')).toHaveAttribute(
    'aria-invalid',
    'false',
  )
  await page.route(
    `**/api${workersPath(account)}`,
    (route) => route.fulfill({ status: 404, json: { status: 404 } }),
    { times: 1 },
  )
  await page.getByLabel('Worker name').press('Enter')
  await expect(page.getByRole('alert')).toContainText(
    'the organisation is no longer available',
  )
  await expect(page.getByLabel('Worker name')).toHaveValue('Jamie Reed')
})

test('rejects mutations without CSRF and does not persist the rejected worker', async ({
  authenticatedPage: page,
  account,
}) => {
  const response = await page.request.post(`/api${workersPath(account)}`, {
    data: { name: 'Rejected worker' },
  })
  expect(response.status()).toBe(400)
  const accepted = await page.request.post(`/api${workersPath(account)}`, {
    headers: await csrfHeaders(page.request),
    data: { name: 'Accepted worker' },
  })
  expect(accepted.status()).toBe(201)
  await page.goto(workersPath(account))
  await expect(
    page
      .getByRole('list', { name: 'Workers', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(1)
  await expect(page.getByText('Accepted worker', { exact: true })).toBeVisible()
  await expect(page.getByText('Rejected worker', { exact: true })).toHaveCount(
    0,
  )
})

test('retains keyboard focus when moving to an uncached worker page', async ({
  authenticatedPage: page,
  account,
  request,
}) => {
  await seedWorkers(request, account, 41)
  await page.goto(workersPath(account))
  const next = page.getByRole('button', { name: 'Next', exact: true })
  await next.scrollIntoViewIfNeeded()
  await next.focus()
  const originalScroll = await page.evaluate(() => window.scrollY)
  const pending = await holdNextRequest(page, `**/api${workersPath(account)}?*`)
  await page.keyboard.press('Enter')
  await pending.requested
  try {
    await expect(
      page.getByText('Loading page 2…', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'Workers', exact: true }),
    ).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByText('Worker 01', { exact: true })).toBeAttached()
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
    page.getByRole('navigation', { name: 'Worker pages' }),
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

test('conceals another tenant and isolates cached workers when switching accounts', async ({
  authenticatedPage: page,
  request,
  account,
  playwright,
  baseURL,
}) => {
  await seedWorkers(request, account, 1)
  await page
    .getByRole('link', {
      name: `Open workspace for ${account.organisationName}`,
    })
    .click()
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Workers', exact: true })
    .click()
  await expect(page.getByText('Worker 01', { exact: true })).toBeVisible()
  const documentStartedAt = await page.evaluate(() => performance.timeOrigin)
  if (!baseURL) throw new Error('Playwright baseURL must be configured')
  const otherRequest = await playwright.request.newContext({ baseURL })
  try {
    const other = await registerAccount(otherRequest, 'Other Browser Workforce')
    // Stay on the worker route so account B encounters account A's populated cache.
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible()
    const pending = await holdNextRequest(
      page,
      `**/api${workersPath(account)}?*`,
    )
    try {
      await page.getByLabel('Email address').fill(other.email)
      await page.getByLabel('Password', { exact: true }).fill(other.password)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await pending.requested
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(
        documentStartedAt,
      )
      await expect(page).toHaveURL(workersPath(account))
      await expect(page.getByRole('status')).toContainText('Loading workers')
      await expect(page.getByText('Worker 01', { exact: true })).toHaveCount(0)
      await expect(
        page.getByRole('list', { name: 'Workers', exact: true }),
      ).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: 'Add worker', exact: true }),
      ).toHaveCount(0)
    } finally {
      pending.release()
    }
    await expect(
      page.getByRole('heading', { name: 'Organisation unavailable' }),
    ).toBeVisible()
    await expect(page.getByText('Worker 01', { exact: true })).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Add worker', exact: true }),
    ).toHaveCount(0)
    await page.getByRole('link', { name: 'Return to organisations' }).click()
    await expect(
      page
        .getByRole('list', { name: 'Organisations', exact: true })
        .getByRole('listitem'),
    ).toHaveCount(1)
    await page
      .getByRole('link', {
        name: `Open workspace for ${other.organisationName}`,
      })
      .click()
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Workers', exact: true })
      .click()
    await expect(page).toHaveURL(workersPath(other))
    await expect(
      page.getByRole('heading', { name: 'No workers yet' }),
    ).toBeVisible()
    await expect(page.getByText('Worker 01', { exact: true })).toHaveCount(0)
  } finally {
    await otherRequest.dispose()
  }
})
