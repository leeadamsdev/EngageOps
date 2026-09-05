import {
  clientsPath,
  expect,
  registerAccount,
  seedClients,
  test,
} from './fixtures.ts'
import { holdNextRequest, unavailableResponse } from './network.ts'

test('navigates organisations, breadcrumbs, deep links and unknown routes', async ({
  authenticatedPage: page,
  account,
}) => {
  const list = page.getByRole('list', { name: 'Organisations', exact: true })
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(
    page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Clients', exact: true }),
  ).toHaveCount(0)
  await list.getByRole('link').focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(`/organisations/${account.organisationId}`)
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Clients', exact: true })
    .click()
  await expect(page).toHaveURL(clientsPath(account))
  await expect(
    page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Clients', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(
    page.getByRole('navigation', { name: 'Breadcrumb' }),
  ).toContainText(account.organisationName)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'No clients yet' }),
  ).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Breadcrumb' })
    .getByRole('link', { name: 'Organisations' })
    .click()
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'Clients', exact: true }),
  ).toBeVisible()
  await page.goto('/unknown-route')
  await expect(page).toHaveURL('/organisations')
})

test('shows organisation loading, empty and recoverable error states', async ({
  authenticatedPage: page,
}) => {
  const pending = await holdNextRequest(page, '**/api/organisations')
  await page.reload()
  await pending.requested
  try {
    await expect(page.getByRole('status')).toContainText(
      'Loading organisations',
    )
  } finally {
    pending.release()
  }
  await expect(
    page.getByRole('list', { name: 'Organisations', exact: true }),
  ).toBeVisible()
  // The current provisioning API always creates a membership; this UI state needs a controlled response.
  await page.route(
    '**/api/organisations',
    (route) => route.fulfill({ json: [] }),
    { times: 1 },
  )
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'No organisations yet' }),
  ).toBeVisible()
  await page.route(
    '**/api/organisations',
    (route) => route.fulfill(unavailableResponse),
    { times: 1 },
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText(
    'We couldn’t load your organisations',
  )
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(
    page
      .getByRole('list', { name: 'Organisations', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(1)
})

test('conceals another tenant and isolates cached clients when switching accounts', async ({
  authenticatedPage: page,
  request,
  account,
  playwright,
  baseURL,
}) => {
  await seedClients(request, account, 1)
  await page
    .getByRole('link', {
      name: `Open workspace for ${account.organisationName}`,
    })
    .click()
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Clients', exact: true })
    .click()
  await expect(page.getByText('Client 01', { exact: true })).toBeVisible()
  const documentStartedAt = await page.evaluate(() => performance.timeOrigin)
  if (!baseURL) throw new Error('Playwright baseURL must be configured')
  const otherRequest = await playwright.request.newContext({ baseURL })
  try {
    const other = await registerAccount(otherRequest, 'Other Browser Workforce')
    // Stay on the client route so account B encounters account A's populated cache.
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible()
    const pending = await holdNextRequest(
      page,
      `**/api${clientsPath(account)}?*`,
    )
    try {
      await page.getByLabel('Email address').fill(other.email)
      await page.getByLabel('Password', { exact: true }).fill(other.password)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await pending.requested
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(
        documentStartedAt,
      )
      await expect(page).toHaveURL(clientsPath(account))
      await expect(page.getByRole('status')).toContainText('Loading clients')
      await expect(page.getByText('Client 01', { exact: true })).toHaveCount(0)
      await expect(
        page.getByRole('list', { name: 'Clients', exact: true }),
      ).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: 'Add client', exact: true }),
      ).toHaveCount(0)
    } finally {
      pending.release()
    }
    await expect(
      page.getByRole('heading', { name: 'Organisation unavailable' }),
    ).toBeVisible()
    await expect(page.getByText('Client 01', { exact: true })).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Add client', exact: true }),
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
      .getByRole('link', { name: 'Clients', exact: true })
      .click()
    await expect(page).toHaveURL(clientsPath(other))
    await expect(
      page.getByRole('heading', { name: 'No clients yet' }),
    ).toBeVisible()
    await expect(page.getByText('Client 01', { exact: true })).toHaveCount(0)
  } finally {
    await otherRequest.dispose()
  }
})
