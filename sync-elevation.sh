#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${ELEVATION_DATA_PATH:-/home/malupixel/data/elevation}"
REMOTE="malupixel"
TARGET_DIR="/home/malupixel/data/elevation"
API_SERVICE="tweakmyroute-api.service"
DRY_RUN=false
RESTART=false

usage() {
  cat <<'EOF'
Usage: ./sync-elevation.sh [options]

Upload prepared elevation tiles independently of deploy.sh.
Existing remote files are updated when their contents differ, never deleted.
Only top-level *.hgt and License-COPDEM-30.pdf are copied (no source-cog).

Options:
  --dry-run       Preview transfers without creating directories or restarting API
  --restart       Restart tweakmyroute-api.service after a successful transfer
  --source DIR    Local dataset (default: ELEVATION_DATA_PATH or /home/malupixel/data/elevation)
  --remote HOST   SSH destination (default: malupixel, as in deploy.sh)
  --target DIR    Absolute remote dataset path (default: /home/malupixel/data/elevation)
  -h, --help      Show this help

Examples:
  ./sync-elevation.sh --dry-run
  ./sync-elevation.sh
  ./sync-elevation.sh --restart
  ./sync-elevation.sh --source /path/to/more-tiles
EOF
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --restart) RESTART=true; shift ;;
    --source|--remote|--target)
      if [[ "$#" -lt 2 || -z "$2" || "$2" == --* ]]; then
        echo "Missing value for $1" >&2
        exit 1
      fi
      case "$1" in
        --source) SOURCE_DIR="$2" ;;
        --remote) REMOTE="$2" ;;
        --target) TARGET_DIR="$2" ;;
      esac
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "Local elevation directory does not exist: ${SOURCE_DIR}" >&2
  exit 1
fi
if [[ "${TARGET_DIR}" != /* || "${TARGET_DIR}" == / || "${REMOTE}" == -* ]]; then
  echo "Use an absolute target directory other than / and a valid SSH destination." >&2
  exit 1
fi

shopt -s nullglob
tiles=("${SOURCE_DIR}"/*.hgt)
if [[ "${#tiles[@]}" -eq 0 ]]; then
  echo "No prepared *.hgt tiles found in ${SOURCE_DIR}" >&2
  exit 1
fi
if [[ ! -r "${SOURCE_DIR}/License-COPDEM-30.pdf" ]]; then
  echo "Missing readable dataset licence: ${SOURCE_DIR}/License-COPDEM-30.pdf" >&2
  exit 1
fi
for command in rsync ssh; do
  command -v "${command}" >/dev/null || { echo "Required command missing: ${command}" >&2; exit 1; }
done

# Quote a path for the remote POSIX shell, including embedded apostrophes.
quoted_target="'${TARGET_DIR//\'/\'\\\'\'}'"
OPTIONS=(
  -rltz --checksum --itemize-changes --stats
  --perms --chmod=D755,F644
  --partial-dir=.rsync-partial --protect-args
  --include='/*.hgt'
  --include='/License-COPDEM-30.pdf'
  --exclude='*'
)

echo "Synchronizing ${#tiles[@]} elevation tiles: ${SOURCE_DIR} -> ${REMOTE}:${TARGET_DIR}"
if ${DRY_RUN}; then
  OPTIONS+=(--dry-run)
else
  ssh "${REMOTE}" "mkdir -p -- ${quoted_target} && chmod 755 -- ${quoted_target}"
fi

# No --delete or --inplace: retain other countries and publish complete files atomically.
rsync "${OPTIONS[@]}" -- "${SOURCE_DIR%/}/" "${REMOTE}:${TARGET_DIR%/}/"

if ${DRY_RUN}; then
  echo "Preview complete. No files changed and API was not restarted."
elif ${RESTART}; then
  echo "Restarting ${API_SERVICE} to clear cached elevation tiles..."
  ssh "${REMOTE}" "sudo /usr/bin/systemctl restart '${API_SERVICE}'"
else
  echo "Done. New tiles are available immediately; restart ${API_SERVICE} if existing tiles were replaced."
fi
