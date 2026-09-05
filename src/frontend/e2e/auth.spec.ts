import { expect, signIn, test } from './fixtures.ts'
import { holdNextRequest, unavailableResponse } from './network.ts'

test('protects direct links and validates sign-in with keyboard and password visibility', async ({
  page,
}) => {
  await page.goto('/organisations/00000000-0000-0000-0000-000000000001/clients')
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  const email = page.getByLabel('Email address')
  const password = page.getByLabel('Password', { exact: true })
  await expect(email).toBeFocused()
  await expect(email).toHaveAccessibleDescription('Enter your email address')
  await expect(password).toHaveAccessibleDescription('Enter your password')
  await email.fill('invalid-email')
  await email.press('Enter')
  await expect(email).toHaveAccessibleDescription('Enter a valid email address')
  await email.fill('valid@engageops.test')
  await email.press('Enter')
  await expect(password).toBeFocused()
  await password.fill('Password visibility check')
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('button', { name: 'Show password' }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(password).toHaveAttribute('type', 'text')
  await expect(
    page.getByRole('button', { name: 'Hide password' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Enter')
  await expect(password).toHaveAttribute('type', 'password')
})

test('signs in through real cookies and CSRF, survives reload, and signs out', async ({
  page,
  account,
}) => {
  await page.goto('/')
  const pending = await holdNextRequest(page, '**/api/auth/sign-in')
  await page.getByLabel('Email address').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByLabel('Password', { exact: true }).press('Enter')
  await pending.requested
  try {
    await expect(
      page.getByRole('button', { name: 'Signing in…' }),
    ).toBeDisabled()
    await expect(page.getByLabel('Email address')).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Show password' }),
    ).toBeDisabled()
  } finally {
    pending.release()
  }
  await expect(
    page.getByRole('link', {
      name: `Open workspace for ${account.organisationName}`,
    }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Organisations', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('link', {
      name: `Open workspace for ${account.organisationName}`,
    })
    .click()
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Clients', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'No clients yet' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible()
  expect((await page.request.get('/api/auth/session')).status()).toBe(401)
  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible()
  await expect(
    page.getByRole('list', { name: 'Organisations', exact: true }),
  ).toHaveCount(0)
})

test('rejects incorrect credentials and allows a corrected sign-in', async ({
  page,
  account,
}) => {
  await page.goto('/')
  await page.getByLabel('Email address').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill('IncorrectPassword1!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Check your email and password',
  )
  await signIn(page, account)
})

for (const failure of ['network', 'server'] as const) {
  test(`recovers from a ${failure} failure during sign-in`, async ({
    page,
    account,
  }) => {
    await page.route(
      '**/api/auth/sign-in',
      (route) =>
        failure === 'network'
          ? route.abort('failed')
          : route.fulfill(unavailableResponse),
      { times: 1 },
    )
    await page.goto('/')
    await page.getByLabel('Email address').fill(account.email)
    await page.getByLabel('Password', { exact: true }).fill(account.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Check your connection')
    await expect(page.getByRole('alert')).not.toContainText(
      'Check your email and password',
    )
    await signIn(page, account)
  })
}

test('shows session loading and recovers from a session lookup failure', async ({
  page,
}) => {
  const pending = await holdNextRequest(page, '**/api/auth/session')
  await page.goto('/')
  await pending.requested
  try {
    await expect(page.getByRole('status')).toContainText(
      'Checking your session',
    )
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    ).toHaveCount(0)
  } finally {
    pending.release()
  }
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible()
  await page.route(
    '**/api/auth/session',
    (route) => route.fulfill(unavailableResponse),
    { times: 1 },
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText(
    'We couldn’t load your session',
  )
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible()
})

test('keeps the workspace on sign-out failure and allows retry', async ({
  authenticatedPage: page,
}) => {
  await page.route(
    '**/api/auth/sign-out',
    (route) => route.fulfill(unavailableResponse),
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'We couldn’t sign you out',
  )
  await expect(
    page.getByRole('heading', { name: 'Organisations', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible()
})

test('an expired cookie hides the workspace after a protected request', async ({
  authenticatedPage: page,
  account,
}) => {
  await page.context().clearCookies({ name: 'EngageOps.Authentication' })
  await page
    .getByRole('link', {
      name: `Open workspace for ${account.organisationName}`,
    })
    .click()
  await expect(page).toHaveURL(`/organisations/${account.organisationId}`)
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Add client', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0)
})
