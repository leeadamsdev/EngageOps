import { expect, test } from './fixtures.ts'
import { unavailableResponse } from './network.ts'

for (const resource of ['client', 'worker'] as const) {
  const label = resource === 'client' ? 'Client name' : 'Worker name'
  const listName = resource === 'client' ? 'Clients' : 'Workers'

  test(`${resource} draft survives a failed background refresh and retry`, async ({
    authenticatedPage: page,
    account,
  }) => {
    const path = `/organisations/${account.organisationId}/${resource}s`
    await page.goto(path)
    await page
      .getByRole('button', { name: `Add ${resource}`, exact: true })
      .click()
    await page.getByLabel(label).fill('Unsaved draft')
    await page.route(
      `**/api${path}?*`,
      (route) => route.fulfill(unavailableResponse),
      { times: 1 },
    )
    // Trigger the visibility event used to refetch stale queries when returning to a tab.
    await page.evaluate(() =>
      window.dispatchEvent(new Event('visibilitychange')),
    )
    await expect(page.getByRole('alert')).toContainText(
      'Check your connection and try again.',
    )
    await expect(page.getByLabel(label)).toHaveValue('Unsaved draft')
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByLabel(label)).toHaveValue('Unsaved draft')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(
      page.getByRole('button', { name: `Add ${resource}`, exact: true }),
    ).toBeFocused()
  })

  test(`${resource} creation completes once when a background refresh fails during submission`, async ({
    authenticatedPage: page,
    account,
  }) => {
    const path = `/organisations/${account.organisationId}/${resource}s`
    await page.goto(path)
    await page
      .getByRole('button', { name: `Add ${resource}`, exact: true })
      .click()
    await page.getByLabel(label).fill('Saved name')
    const pending = Promise.withResolvers<undefined>()
    const requested = Promise.withResolvers<undefined>()
    let failNextRead = true
    // Keep interception stable while the POST is held and the concurrent GET fails.
    await page.route(`**/api${path}**`, async (route) => {
      if (route.request().method() === 'POST') {
        requested.resolve(undefined)
        await pending.promise
        await route.continue()
      } else if (failNextRead) {
        failNextRead = false
        await route.fulfill(unavailableResponse)
      } else {
        await route.continue()
      }
    })
    await page.getByLabel(label).press('Enter')
    await requested.promise
    try {
      await page.evaluate(() =>
        window.dispatchEvent(new Event('visibilitychange')),
      )
      await expect(page.getByRole('alert')).toContainText(
        'Check your connection and try again.',
      )
      await expect(page.getByLabel(label)).toHaveValue('Saved name')
      await expect(page.getByLabel(label)).toBeDisabled()
      await expect(
        page.getByRole('button', { name: 'Cancel', exact: true }),
      ).toBeDisabled()
    } finally {
      pending.resolve(undefined)
    }
    await expect(page.getByRole('status')).toHaveText('Saved name was added.')
    await expect(page.getByRole('form')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: `Add ${resource}`, exact: true }),
    ).toBeFocused()
    await page.reload()
    const rows = page
      .getByRole('list', { name: listName, exact: true })
      .getByRole('listitem')
    await expect(rows).toHaveCount(1)
    await expect(rows).toContainText('Saved name')
  })
}
