import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, request } from '@playwright/test'

const execute = promisify(execFile)

export default async function globalSetup() {
  const project = `engageops-e2e-${randomUUID()}`
  const root = resolve(import.meta.dirname, '../../..')
  const artifacts = resolve(import.meta.dirname, '../e2e-artifacts')
  const compose = (...args: string[]) =>
    execute(
      'docker',
      ['compose', '-f', 'compose.e2e.yaml', '-p', project, ...args],
      {
        cwd: root,
        timeout: 300_000,
        maxBuffer: 10 * 1024 * 1024,
      },
    )

  // Each invocation owns its containers and anonymous database volume, including retries.
  async function teardown() {
    try {
      const logs = await compose('logs', '--no-color')
      await writeFile(
        resolve(artifacts, 'containers.log'),
        logs.stdout + logs.stderr,
      )
    } finally {
      await compose('down', '--volumes', '--remove-orphans')
    }
  }

  await mkdir(artifacts, { recursive: true })
  await writeFile(resolve(artifacts, 'compose-project.txt'), project)
  try {
    await compose('up', '--detach', '--build', '--wait', '--wait-timeout', '90')
    const api = await request.newContext({ baseURL: 'http://127.0.0.1:18080' })
    try {
      await expect(async () => {
        const response = await api.get('/health', { timeout: 3000 })
        expect(response.status()).toBe(200)
      }).toPass({ timeout: 90_000, intervals: [500, 1000] })
    } finally {
      await api.dispose()
    }
  } catch (error) {
    try {
      await teardown()
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Browser stack setup and cleanup failed',
        { cause: cleanupError },
      )
    }
    throw error
  }
  return teardown
}
