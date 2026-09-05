# Local development

The local workflow supports Windows, macOS and Linux. Commands run from the
repository root unless a different working directory is specified. Common command
blocks work in both PowerShell and a standard Unix shell; only shell-specific syntax
is shown separately.

## Prerequisites

The application runs through Docker Compose. Use Docker Desktop on Windows/macOS,
or Docker Engine with the Compose plugin / Docker Desktop on Linux. Docker must run
Linux containers, and Compose must support `develop.watch` and `initial_sync`.
Use a current stable Compose release. The Docker CLI must be on `PATH` and
able to contact the daemon without changing the documented commands to use `sudo`.

Development-data commands have thin PowerShell and POSIX `sh` entry points. Use
PowerShell on Windows (PowerShell 7 or Windows PowerShell 5.1), or the system shell
on macOS/Linux. PowerShell 7 can also run the `.ps1` entry point on macOS/Linux.

For host-side builds, tests and EF tooling, install the versions selected by the
repository:

| Tool     | Version source                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------ |
| .NET SDK | [`global.json`](../global.json)                                                                  |
| Node.js  | [`.node-version`](../.node-version)                                                              |
| pnpm     | `packageManager` in [`src/frontend/package.json`](../src/frontend/package.json)                  |
| EF CLI   | [`.config/dotnet-tools.json`](../.config/dotnet-tools.json), restored with `dotnet tool restore` |

The Dockerfiles install their own SDK/Node/pnpm dependencies. Host-side tests require
the tools above even when the application is running in containers.

## Initial setup

Create the local environment file if it does not already exist.

Windows / PowerShell:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

macOS/Linux shell:

```sh
if [ ! -e .env ]; then cp .env.example .env; fi
```

Edit `.env` and set `POSTGRES_PASSWORD`. The database name and user are supplied by
`POSTGRES_DB` and `POSTGRES_USER`. `.env` is ignored by Git; `.env.example` documents
the configuration keys.

Validate the configuration, then build and start the services:

```text
docker compose config --quiet
docker compose up --build --watch
```

Keep that terminal running. Compose waits for PostgreSQL's health check before
starting the backend. The backend builds, applies migrations and starts the API.
Once it is listening, open another terminal at the repository root and follow the
[demo-data guide](development-data.md) to seed an account. Open <http://localhost:5173>.

| Service    | Local address           | Behaviour                                                       |
| ---------- | ----------------------- | --------------------------------------------------------------- |
| Frontend   | <http://localhost:5173> | Vite development server; proxies `/api` requests to the backend |
| Backend    | <http://localhost:8080> | API under `/api`; liveness endpoint at `/health`                |
| PostgreSQL | `localhost:5432`        | Database name and credentials from `.env`                       |

All published ports bind to loopback. `/health` checks application liveness; it does
not query PostgreSQL. These containers run the API in Development and use Vite and
`dotnet watch` for source changes.

## Daily workflow

Compose watch synchronises source changes. Backend changes are handled by
`dotnet watch`; frontend changes are handled by Vite. The watch configuration
rebuilds images when the listed project/dependency files change. See
[`compose.yaml`](../compose.yaml) for the exact watched paths.

Inspect services and recent output:

```text
docker compose ps
docker compose logs --tail 100 backend frontend postgres
```

After changing `.env` or service configuration, restart the Compose command so the
containers receive the new configuration. If a Dockerfile or an unwatched build
input changes, restart with `--build`.

To run without source watching:

```text
docker compose up -d --build
```

To stop and remove the containers while retaining named volumes:

```text
docker compose down
```

The PostgreSQL volume persists application data. The Data Protection volume keeps
authentication keys across backend rebuilds. Use the scoped
[demo reset](development-data.md#reset) when restoring demo data to its baseline.

## Configuration boundaries

Compose reads `.env` and supplies the backend's `ConnectionStrings__Database`,
`ASPNETCORE_ENVIRONMENT`, `Database__ApplyMigrationsOnStartup` and development-data
settings. The frontend container receives `API_PROXY_TARGET=http://backend:8080`.

Host-side .NET commands do not automatically load Compose's `.env`. A database
connection string must be supplied separately when running EF tooling on the host.
The backend requires `ConnectionStrings:Database`; migration-on-startup is enabled
by Compose configuration.

The Vite proxy defaults to `http://localhost:8080` when run on the host. The API's
[`launchSettings.json`](../src/backend/EngageOps.Api/Properties/launchSettings.json)
uses different ports for a normal IDE launch; set `API_PROXY_TARGET` to the running
API address if using that workflow.

## Schema changes

Mappings live beside their feature entities. Migrations and the model snapshot live
in [`Persistence/Migrations`](../src/backend/EngageOps.Api/Persistence/Migrations).

For a model change, restore the pinned EF tool and configure a connection in the
current terminal session. Restore the tool using the same command on all platforms:

```text
dotnet tool restore
```

Set the connection string, replacing the placeholders with the local `.env` values.

Windows / PowerShell:

```powershell
$env:ConnectionStrings__Database = 'Host=localhost;Port=5432;Database=<POSTGRES_DB>;Username=<POSTGRES_USER>;Password=<POSTGRES_PASSWORD>'
```

macOS/Linux shell:

```sh
export ConnectionStrings__Database='Host=localhost;Port=5432;Database=<POSTGRES_DB>;Username=<POSTGRES_USER>;Password=<POSTGRES_PASSWORD>'
```

Then create the migration:

```text
dotnet ef migrations add DescribeSchemaChange --project src/backend/EngageOps.Api --output-dir Persistence/Migrations
```

Replace `DescribeSchemaChange` with a meaningful migration name. Review the generated
migration and snapshot, then run the [backend validation checks](testing.md#backend).
The Compose backend applies migrations on startup; after the new migration is
included in its build, restart it to apply the change. The demo-data commands also
apply outstanding migrations before seeding or resetting.

## Troubleshooting

| Symptom                                                    | Check                                                                                                                                                           |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compose rejects watch configuration                        | Check `docker compose version` and support for the keys used in `compose.yaml`.                                                                                 |
| A published port is unavailable                            | Check for another process/container using 5173, 8080 or 5432.                                                                                                   |
| The frontend loads but API calls fail                      | Check backend logs and `/health`; confirm the frontend proxy target matches the API address.                                                                    |
| Database authentication fails after editing `.env`         | PostgreSQL credentials in an existing volume are not changed by editing initialization variables. Reconcile the configuration with that database's credentials. |
| The demo command cannot find the built application         | Wait for the backend's initial build, or rebuild/start the backend from current source. The script uses `--no-build`.                                           |
| A host-side command reports missing database configuration | Supply `ConnectionStrings__Database` in that shell; Compose's `.env` is not loaded by the .NET process.                                                         |

See [Testing](testing.md) for dependency installation and the validation commands.
