# Testing and validation

Backend tests live in [`tests/backend/EngageOps.Api.Tests`](../tests/backend/EngageOps.Api.Tests).
Frontend tests are colocated as `*.test.tsx` files in
[`src/frontend/src`](../src/frontend/src).
Playwright browser tests live in [`src/frontend/e2e`](../src/frontend/e2e).

## Prerequisites

Use the host tool versions listed in [Local development](local-development.md#prerequisites).
Common commands below work in PowerShell on Windows and a standard shell on
macOS/Linux. Shell-specific cleanup is shown separately.
Restore dependencies from the repository root:

```text
dotnet restore EngageOps.slnx
```

From `src/frontend`:

```text
pnpm install --frozen-lockfile
```

Backend integration tests require a running Docker engine with Linux container
support and access to the PostgreSQL image selected by
[`PostgreSqlTestDatabase.cs`](../tests/backend/EngageOps.Api.Tests/Persistence/PostgreSqlTestDatabase.cs).
Testcontainers starts isolated databases and the tests apply EF migrations. The
Compose application and its demo account do not need to be running or seeded.
Frontend component tests run in jsdom and mock API responses, so they do not require the API
or PostgreSQL.

## Backend

Run from the repository root:

```text
dotnet format EngageOps.slnx --verify-no-changes
dotnet build EngageOps.slnx
dotnet test --solution EngageOps.slnx
```

The solution uses xUnit v3 and Microsoft.Testing.Platform, selected in
[`global.json`](../global.json). The shared build configuration enables nullable
reference types, code-style analysis and warnings-as-errors.

The suite covers:

- Entity validation and assignment cancellation rules.
- EF mappings, migrations, relational constraints and persistence.
- Membership checks and concealment of inaccessible tenants/resources.
- Cookie sessions, antiforgery, lockout, malformed inputs and safe HTTP errors.
- Account provisioning, rollback and concurrent duplicate registration.
- Client/worker creation, pagination and assignment creation/list/detail/cancellation.
- Demo seeding, repeatability, reset scope and ambiguous/shared organisation safeguards.

[`EngageOpsApiFactory`](../tests/backend/EngageOps.Api.Tests/EngageOpsApiFactory.cs)
hosts the application through `WebApplicationFactory` and injects test database
configuration. Shared HTTP helpers handle cookies, antiforgery and response
assertions. Database tests use real PostgreSQL constraints and migrations.

## Frontend

Run from `src/frontend`:

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` also runs TypeScript checking before the Vite build. For interactive
test feedback, use `pnpm test:watch`.

Vitest and React Testing Library cover session/sign-in/sign-out behaviour,
organisation access, client/worker pagination and creation, field validation, retries,
expired sessions, cached-data visibility and focus restoration. Shared test setup
provides DOM matchers and cleanup; test query clients disable automatic retries.

These tests use jsdom and mocked `fetch`. They do not validate real browser layout
or the full browser-to-database path. For UI changes, also exercise the affected
workflow in the running application at desktop and smaller widths, with keyboard
navigation and the relevant loading, empty, success and failure states. The
[demo organisations](development-data.md) provide empty, small and paginated lists
for those checks.

## Browser journeys (Playwright)

With Docker running, use these commands from `src/frontend`:

```text
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e
```

On Linux, install browser system dependencies too:

```sh
pnpm exec playwright install --with-deps chromium firefox webkit
```

Use an OS version supported by the pinned Playwright release; see
[Playwright system requirements](https://playwright.dev/docs/intro#system-requirements).
Linux browser dependency installation may require administrator privileges.

The suite builds the frontend and serves it through Vite preview on
`http://127.0.0.1:15173`, proxying API requests to `http://127.0.0.1:18080`.
Both ports must be free. It refuses to reuse an existing frontend server.
[`compose.e2e.yaml`](../compose.e2e.yaml) starts a separate API and PostgreSQL,
using the existing API Dockerfile and applying EF migrations on startup.
No host .NET installation, `.env`, running development stack or demo seed is needed
for browser tests. The development stack can remain running on its usual ports.

Each invocation has a unique Compose project and an anonymous database volume.
Fixtures register fresh accounts/organisations through the real API and create
only the clients and workers a test needs. No shared authentication state file or
demo account is used. Teardown removes the invocation's containers,
network and database volume after successful or failed runs. Do not run two browser
suite invocations simultaneously because they share the dedicated test ports.

All journeys run in desktop Chromium, Firefox and WebKit, tablet Chromium (768px)
and mobile Chromium (Pixel 7 emulation). These are browser engines and emulated
viewports, not physical-device certification. Coverage includes:

- Protected links, keyboard sign-in validation, password visibility, pending controls,
  real cookie/CSRF authentication, invalid credentials, session reload and sign-out.
- Session/network/server failures, retry and expired authentication.
- Organisation listing, navigation, breadcrumbs, deep links, empty/loading/error states,
  inaccessible tenants and cached-data isolation when switching accounts.
- Organisation overview totals, empty summaries, updates after client/worker creation,
  workspace entry and switching, failed totals, expired sessions and tenant isolation.
- Client and worker creation, validation, cancellation, pending controls, input preservation,
  success/focus feedback, persistence and CSRF rejection.
- Draft and pending-creation preservation through failed background list refreshes,
  with form removal when authentication or organisation access is lost.
- Pagination across 45 records, ordering, boundaries, failed-page retry and
  invalidation of cached pages after creation.
- axe WCAG A/AA scans of sign-in, validation, workspace, empty/form/populated states;
  horizontal overflow and pagination controls at 320px; reduced-motion sign-in.

Happy-path, persistence and tenant/security journeys use the real API/database.
`page.route` is limited to deterministic loading/failure responses and the
organisation-empty state, which registration cannot create. Browser tests complement
the existing component and backend suites; API-only assignments and detailed
database/domain constraints remain covered by backend tests.

Pagination checks cover retained rows, loading announcements, prevention of repeated
navigation and keyboard focus/scroll stability, including the first and last pages.
Long organisation, client and worker names are checked for wrapping without clipping
at 320px.
Automated accessibility scans do not establish full accessibility, and no visual
screenshot baselines are committed.

For targeted runs and debugging:

```text
pnpm test:e2e --project=chromium
pnpm test:e2e e2e/clients.spec.ts --project=chromium --headed
pnpm test:e2e:ui
pnpm test:e2e:report
```

The HTML report is written to `playwright-report/`. Failed tests retain traces,
screenshots and error context under `test-results/`; stack logs and its Compose
project name are written to `e2e-artifacts/`. These directories are ignored by Git,
formatting, lint and Docker builds. Open traces from the HTML report or with
`pnpm exec playwright show-trace <path-to-trace.zip>`.

If the runner is forcibly terminated before teardown, remove only the recorded test
project from the repository root:

Windows / PowerShell:

```powershell
$testProject = (Get-Content src/frontend/e2e-artifacts/compose-project.txt -Raw).Trim()
if ($testProject -notmatch '^engageops-e2e-[0-9a-f-]{36}$') {
    throw 'Unexpected browser test project name.'
}
docker compose -f compose.e2e.yaml -p $testProject down --volumes --remove-orphans
```

macOS/Linux shell (the subshell prevents an invalid project name from closing your terminal):

```sh
(
    test_project=$(cat src/frontend/e2e-artifacts/compose-project.txt) || exit 1
    if ! printf '%s\n' "$test_project" | LC_ALL=C grep -Eq '^engageops-e2e-[0-9a-f-]{36}$'; then
        printf 'Unexpected browser test project name.\n' >&2
        exit 1
    fi
    docker compose -f compose.e2e.yaml -p "$test_project" down --volumes --remove-orphans
)
```

After upgrading Playwright, rerun its browser installation command. Browser tests
are included in strict TypeScript checking and lint; `pnpm test` continues to run
only the colocated Vitest suite.

## Local infrastructure

Run from the repository root with `.env` configured:

```text
docker compose config --quiet
docker compose -f compose.e2e.yaml config --quiet
docker compose ps
```

The configuration commands validate both Compose files without printing interpolated
values. `docker compose ps` shows service state; it does not build or start services.
PostgreSQL has a container health check. The API's `/health` endpoint checks application liveness,
so verify an affected API workflow as well when checking database-backed behaviour.

## Dependency checks

When changing dependencies, run from the repository root:

```text
dotnet package list --outdated
dotnet package list --vulnerable
```

From `src/frontend`:

```text
pnpm outdated
pnpm audit
```

## Automated checks

[`ci.yml`](../.github/workflows/ci.yml) runs on pushes and pull requests to `main`:

- POSIX shell syntax validation for the development-data entry point.
- Backend restore, formatting verification, Release build and tests.
- Compose configuration validation and backend/frontend Docker image builds.
- Frontend frozen-lockfile installation, formatting, lint, tests and build.
- Browser installation and the full Playwright matrix against a disposable stack,
  with one retry in CI and reports/diagnostics retained as artifacts for seven days.

These jobs run on Ubuntu and provide Linux validation. Windows is validated locally;
there is no Windows or macOS CI matrix, and macOS has not been physically validated.
The frontend job saves the shared pnpm store cache; the browser job only restores it
to avoid competing cache writes. Cache misses still run a normal frozen-lockfile install.

[`codeql.yml`](../.github/workflows/codeql.yml) scans C# and JavaScript/TypeScript on
pushes/pull requests to `main` and weekly. The scheduled/manual
[`dependency-audit.yml`](../.github/workflows/dependency-audit.yml) runs `pnpm audit`.
[`dependabot.yml`](../.github/dependabot.yml) configures weekly updates for NuGet,
the .NET SDK, Docker Compose and GitHub Actions.

Test fixtures remain independent of demo datasets; see
[Test fixtures](development-data.md#test-fixtures) for that distinction.
