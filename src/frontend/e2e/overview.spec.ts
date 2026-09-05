import {
  expect,
  registerAccount,
  seedClients,
  seedWorkers,
  test,
} from './fixtures.ts'
import { holdNextRequest, unavailableResponse } from './network.ts'

test('overview shows totals, opens lists, refreshes after creation and supports switching', async ({
  authenticatedPage: page,
  account,
  request,
}) => {
  await seedClients(request, account, 21)
  await seedWorkers(request, account, 3)
  await page
    .getByRole('link', {
      name: `Open workspace for ${account.organisationName}`,
    })
    .click()
  await expect(page).toHaveURL(`/organisations/${account.organisationId}`)
  await expect(
    page.getByRole('link', { name: 'View clients, 21 total' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'View workers, 3 total' }).click()
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  await page.getByLabel('Worker name').fill('Alex Morgan')
  await page.getByLabel('Worker name').press('Enter')
  await expect(page.getByRole('status')).toHaveText('Alex Morgan was added.')
  await page
    .getByRole('navigation', { name: 'Breadcrumb' })
    .getByRole('link', { name: account.organisationName, exact: true })
    .click()
  await expect(
    page.getByRole('link', { name: 'View workers, 4 total' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'View clients, 21 total' }).click()
  await page.getByRole('button', { name: 'Add client', exact: true }).click()
  await page.getByLabel('Client name').fill('Acorn Consulting')
  await page.getByLabel('Client name').press('Enter')
  await expect(page.getByRole('status')).toHaveText(
    'Acorn Consulting was added.',
  )
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Overview', exact: true })
    .click()
  await expect(
    page.getByRole('link', { name: 'View clients, 22 total' }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('link', { name: 'View workers, 4 total' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Switch organisation' }).click()
  await expect(page).toHaveURL('/organisations')
  await expect(
    page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Overview' }),
  ).toHaveCount(0)
})

test('overview handles loading, failed totals and an expired session', async ({
  authenticatedPage: page,
  account,
}) => {
  const pending = await holdNextRequest(
    page,
    `**/api/organisations/${account.organisationId}/workers?*`,
  )
  await page.goto(`/organisations/${account.organisationId}`)
  await pending.requested
  try {
    await expect(page.getByRole('status')).toContainText('Loading overview')
    await expect(page.getByRole('link', { name: /View workers/ })).toHaveCount(
      0,
    )
  } finally {
    pending.release()
  }
  await expect(
    page.getByRole('link', { name: 'View workers, 0 total' }),
  ).toBeVisible()
  await page.route(
    `**/api/organisations/${account.organisationId}/workers?*`,
    (route) => route.fulfill(unavailableResponse),
    { times: 1 },
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText(
    'We couldn’t load this overview',
  )
  await expect(page.getByRole('link', { name: /View clients/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(
    page.getByRole('link', { name: 'View workers, 0 total' }),
  ).toBeVisible()
  await page.context().clearCookies({ name: 'EngageOps.Authentication' })
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: /View workers/ })).toHaveCount(0)
})

test('conceals another organisation and does not reuse overview totals across accounts', async ({
  authenticatedPage: page,
  account,
  request,
  playwright,
  baseURL,
}) => {
  await seedWorkers(request, account, 3)
  await page.goto(`/organisations/${account.organisationId}`)
  await expect(
    page.getByRole('link', { name: 'View workers, 3 total' }),
  ).toBeVisible()
  if (!baseURL) throw new Error('Playwright baseURL must be configured')
  const otherRequest = await playwright.request.newContext({ baseURL })
  try {
    const other = await registerAccount(otherRequest, 'Other Workforce')
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByLabel('Email address').fill(other.email)
    await page.getByLabel('Password', { exact: true }).fill(other.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Organisation unavailable' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /View workers/ })).toHaveCount(
      0,
    )
    await page.getByRole('link', { name: 'Switch organisation' }).click()
    await page
      .getByRole('link', { name: 'Open workspace for Other Workforce' })
      .click()
    await expect(
      page.getByRole('link', { name: 'View workers, 0 total' }),
    ).toBeVisible()
  } finally {
    await otherRequest.dispose()
  }
})
