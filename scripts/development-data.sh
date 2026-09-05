#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
    printf 'Usage: %s {seed|reset}\n' "$0" >&2
    exit 2
fi

case "$1" in
    seed|reset) ;;
    *) printf 'Usage: %s {seed|reset}\n' "$0" >&2; exit 2 ;;
esac

if ! command -v docker >/dev/null 2>&1; then
    printf 'Docker CLI is required. Install Docker and make docker available on PATH.\n' >&2
    exit 127
fi

case "$0" in
    /*) script_path=$0 ;;
    *) script_path=./$0 ;;
esac
repository_root=$(CDPATH= cd -P "$(dirname "$script_path")/.." && pwd)
cd "$repository_root"

exec docker compose exec -T backend dotnet run \
    --project src/backend/EngageOps.Api/EngageOps.Api.csproj \
    --no-build \
    --no-launch-profile \
    -- development-data "$1"
