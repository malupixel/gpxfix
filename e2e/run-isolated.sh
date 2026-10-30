#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
compose=(docker compose -p boostmytrack-e2e -f compose.yml)
cleanup() { "${compose[@]}" down -v; }
trap cleanup EXIT
# Start with an empty test database and no leftover GPX files.
"${compose[@]}" down -v
"${compose[@]}" up -d --build --wait
npx playwright test "$@"
