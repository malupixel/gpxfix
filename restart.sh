#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$PROJECT_DIR"

if ! docker compose version >/dev/null 2>&1; then
  echo "Błąd: Docker Compose nie jest dostępny." >&2
  exit 1
fi

echo "==> Przebudowuję API i frontend bez używania cache..."
docker compose build --no-cache api web

echo "==> Uruchamiam aktualne kontenery aplikacji..."
docker compose up -d --force-recreate --remove-orphans --wait api web

echo
echo "==> Projekt został przebudowany i uruchomiony."
docker compose ps
