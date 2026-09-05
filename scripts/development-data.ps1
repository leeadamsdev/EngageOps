[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('seed', 'reset')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'
# Handle native exit codes consistently even when PowerShell 7 callers enable native errors.
$PSNativeCommandUseErrorActionPreference = $false

if (-not $Action) {
    throw 'Usage: ./scripts/development-data.ps1 {seed|reset}'
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI is required. Install Docker and make docker available on PATH.'
}

$Action = $Action.ToLowerInvariant()
$repositoryRoot = Split-Path -Parent $PSScriptRoot

Push-Location -LiteralPath $repositoryRoot
try {
    docker compose exec -T backend dotnet run `
        --project src/backend/EngageOps.Api/EngageOps.Api.csproj `
        --no-build `
        --no-launch-profile `
        -- development-data $Action

    if ($LASTEXITCODE -ne 0) {
        throw "Development data $Action failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
