import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import {
  clientsPath,
  csrfHeaders,
  expect,
  registerAccount,
  seedClients,
  seedWorkers,
  workersPath,
  test,
} from './fixtures.ts'

test('organisation overview and workspace navigation remain accessible with long names', async ({
  page,
  request,
}, testInfo) => {
  const organisationName =
    'Northstar International Workforce Operations and Consulting'
  const account = await registerAccount(request, organisationName)
  await seedClients(request, account, 21)
  await seedWorkers(request, account, 3)
  await page.context().addCookies((await request.storageState()).cookies)
  await page.goto(`/organisations/${account.organisationId}`)
  await expect(
    page.getByRole('heading', { name: organisationName }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'View clients, 21 total' }),
  ).toBeVisible()
  await checkAccessibility(page)
  await page.screenshot({
    path: testInfo.outputPath('overview.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 320, height: 800 })
  await checkAccessibility(page)
  for (const name of ['Overview', 'Clients', 'Workers']) {
    await expect(
      page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('link', { name, exact: true }),
    ).toBeInViewport()
  }
  await page.screenshot({
    path: testInfo.outputPath('overview-narrow.png'),
    fullPage: true,
  })
})

test('worker empty state, validation and paginated long names fit narrow screens and remain accessible', async ({
  authenticatedPage: page,
  account,
  request,
}, testInfo) => {
  await page.goto(workersPath(account))
  await expect(
    page.getByRole('heading', { name: 'No workers yet' }),
  ).toBeVisible()
  await checkAccessibility(page)
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  await page.getByLabel('Worker name').press('Enter')
  await expect(page.getByLabel('Worker name')).toBeFocused()
  await expect(page.getByLabel('Worker name')).toHaveAccessibleDescription(
    'Enter a worker name',
  )
  await checkAccessibility(page)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await seedWorkers(request, account, 21)
  const longName = 'A'.repeat(200)
  const response = await request.post(`/api${workersPath(account)}`, {
    headers: await csrfHeaders(request),
    data: { name: longName },
  })
  expect(response.status()).toBe(201)
  await page.reload()
  const name = page.getByText(longName, { exact: true })
  await expect(name).toBeVisible()
  await checkAccessibility(page)
  await page.screenshot({
    path: testInfo.outputPath('workers.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 320, height: 800 })
  expect(
    await name.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  await checkAccessibility(page)
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  await expect(page.getByLabel('Worker name')).toBeFocused()
  await checkAccessibility(page)
  await page.screenshot({
    path: testInfo.outputPath('workers-narrow-form.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  const pagination = page.getByRole('navigation', { name: 'Worker pages' })
  const next = pagination.getByRole('button', { name: 'Next', exact: true })
  await next.focus()
  await page.keyboard.press('Enter')
  await expect(pagination).toContainText('Page 2 of 2')
  await expect(next).toBeFocused()
  await expect(next).toBeInViewport()
  await checkAccessibility(page)
})

async function checkAccessibility(page: Page) {
  // Scan settled content; entrance opacity otherwise produces transient contrast failures.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.playState === 'running' &&
                animation.effect?.getComputedTiming().iterations !== Infinity,
            ).length,
      ),
    )
    .toBe(0)
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(result.violations).toEqual([])
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
}

test('sign-in and its validation remain accessible at the configured viewport', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible()
  await checkAccessibility(page)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByLabel('Email address')).toBeFocused()
  await checkAccessibility(page)
})

test('long organisation and client names wrap without clipping on narrow screens', async ({
  page,
  request,
}) => {
  const organisationName =
    'Northstar International Workforce Operations and Consulting'
  const account = await registerAccount(request, organisationName)
  const clientNames = [
    'Harbour International Facilities and Workforce Management',
    'A'.repeat(200),
  ]
  for (const name of clientNames) {
    const response = await request.post(`/api${clientsPath(account)}`, {
      headers: await csrfHeaders(request),
      data: { name },
    })
    expect(response.status()).toBe(201)
  }
  await page.context().addCookies((await request.storageState()).cookies)
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/organisations')
  const organisation = page.getByText(organisationName, { exact: true })
  await expect(organisation).toBeVisible()
  expect(
    await organisation.evaluate(
      (element) =>
        element.scrollWidth <= element.clientWidth &&
        element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true)
  await checkAccessibility(page)
  await page
    .getByRole('link', { name: `Open workspace for ${organisationName}` })
    .click()
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Clients', exact: true })
    .click()
  await expect(
    page.getByText('Manage this organisation’s clients.', { exact: true }),
  ).toBeVisible()
  for (const name of clientNames) {
    const label = page.getByText(name, { exact: true })
    await expect(label).toBeVisible()
    expect(
      await label.evaluate(
        (element) =>
          element.scrollWidth <= element.clientWidth &&
          element.scrollHeight <= element.clientHeight,
      ),
    ).toBe(true)
  }
  await checkAccessibility(page)
})

test('workspace, empty state, client form and populated list remain accessible', async ({
  authenticatedPage: page,
  account,
  request,
}) => {
  await checkAccessibility(page)
  await page.goto(clientsPath(account))
  await expect(
    page.getByRole('heading', { name: 'No clients yet' }),
  ).toBeVisible()
  await checkAccessibility(page)
  await page.getByRole('button', { name: 'Add client', exact: true }).click()
  await page.getByLabel('Client name').press('Enter')
  await expect(page.getByLabel('Client name')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await checkAccessibility(page)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await seedClients(request, account, 21)
  await page.reload()
  await expect(
    page.getByRole('navigation', { name: 'Client pages' }),
  ).toBeVisible()
  await checkAccessibility(page)
})

test('small-screen navigation, form actions and pagination fit a 320px viewport', async ({
  authenticatedPage: page,
  account,
  request,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await checkAccessibility(page)
  await seedClients(request, account, 21)
  await page.goto(clientsPath(account))
  await page.getByRole('button', { name: 'Add client', exact: true }).click()
  await expect(page.getByLabel('Client name')).toBeFocused()
  await checkAccessibility(page)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  const pagination = page.getByRole('navigation', { name: 'Client pages' })
  await pagination.scrollIntoViewIfNeeded()
  const label = await pagination
    .getByText('Page 1 of 2', { exact: true })
    .boundingBox()
  const next = await pagination
    .getByRole('button', { name: 'Next', exact: true })
    .boundingBox()
  const previous = await pagination
    .getByRole('button', { name: 'Previous' })
    .boundingBox()
  if (!label || !next || !previous)
    throw new Error('Pagination controls must be visible')
  expect(label.y + label.height).toBeLessThanOrEqual(next.y)
  expect(Math.abs(next.y - previous.y)).toBeLessThan(1)
  expect(next.height).toBeGreaterThanOrEqual(44)
  expect(previous.height).toBeGreaterThanOrEqual(44)
  await checkAccessibility(page)
})
