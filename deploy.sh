#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE="malupixel"
BASE_DIR="/home/malupixel/www/tweakmyroute.com"

API_SERVICE="tweakmyroute-api.service"
WEB_SERVICE="tweakmyroute-web.service"

SSH_DIR=""
SSH_OPTIONS=()
SSH_TRANSPORT=""

cleanup() {
  if [[ -n "${SSH_DIR}" ]]; then
    ssh "${SSH_OPTIONS[@]}" -O exit "${REMOTE}" >/dev/null 2>&1 || true
    rm -rf "${SSH_DIR}"
  fi
}

deploy_ssh() {
  ssh "${SSH_OPTIONS[@]}" "${REMOTE}" "$@"
}

# Retry transport failures only. Never repeat a remote build or service restart.
retry_transport() {
  local attempt status
  for attempt in 1 2 3; do
    if "$@"; then
      return 0
    else
      status=$?
    fi
    if [[ "${status}" -ne 255 || "${attempt}" -eq 3 ]]; then
      return "${status}"
    fi
    echo "SSH transport failed; retrying in $((attempt * 3)) seconds (${attempt}/3)..." >&2
    sleep "$((attempt * 3))"
  done
}

prepare_ssh() {
  SSH_DIR="$(mktemp -d /tmp/tweakmyroute-deploy.XXXXXX)"
  trap cleanup EXIT
  SSH_OPTIONS=(
    -o ConnectTimeout=15
    -o ServerAliveInterval=15
    -o ServerAliveCountMax=3
    -o ControlMaster=auto
    -o ControlPersist=60
    -o "ControlPath=${SSH_DIR}/connection"
  )
  SSH_TRANSPORT="ssh -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o ControlMaster=auto -o ControlPersist=60 -o ControlPath=${SSH_DIR}/connection"
  echo "Checking SSH connection to ${REMOTE}..."
  if ! retry_transport deploy_ssh true; then
    echo "Cannot establish SSH connection to ${REMOTE}. Deployment stopped before building or uploading files." >&2
    return 1
  fi
}

EXCLUDES=(
  --exclude node_modules
  --exclude .next
  --exclude .git
  --exclude ".env*"
  --exclude "*.log"
  --exclude "*.tsbuildinfo"
  --exclude .DS_Store
  --exclude coverage
  --exclude .vscode
  --exclude .idea
)

usage() {
  cat <<'EOF'
Usage: ./deploy.sh [all|api|web ...]

With no arguments, all components are deployed.

Examples:
  ./deploy.sh
  ./deploy.sh all
  ./deploy.sh api
  ./deploy.sh web
  ./deploy.sh api web
EOF
}

deploy_api() {
  local build_dir
  build_dir="$(mktemp -d "${SSH_DIR}/api-build.XXXXXX")"
  trap 'rm -rf "${build_dir}"; trap - RETURN' RETURN

  echo "Preparing isolated API build..."
  rsync -rlt --exclude target --exclude data --exclude '*.hgt' --exclude '*.tif' --exclude '*.tiff' "${ROOT_DIR}/api/" "${build_dir}/"

  echo "Building API..."
  local java_home="${JAVA_HOME:-}"
  if [[ -x /usr/lib/jvm/java-21-openjdk-amd64/bin/java ]]; then
    java_home="/usr/lib/jvm/java-21-openjdk-amd64"
  elif [[ -x /usr/lib/jvm/java-1.21.0-openjdk-amd64/bin/java ]]; then
    java_home="/usr/lib/jvm/java-1.21.0-openjdk-amd64"
  fi

  if [[ -n "${java_home}" ]]; then
    JAVA_HOME="${java_home}" PATH="${java_home}/bin:${PATH}" \
      mvn -f "${build_dir}/pom.xml" package -DskipTests
  else
    mvn -f "${build_dir}/pom.xml" package -DskipTests
  fi

  local jars=("${build_dir}"/target/*.jar)
  local jar=""
  for candidate in "${jars[@]}"; do
    if [[ "${candidate}" != *.original ]]; then
      jar="${candidate}"
      break
    fi
  done

  if [[ -z "${jar}" || ! -f "${jar}" ]]; then
    echo "API build did not produce a deployable JAR." >&2
    exit 1
  fi

  echo "Uploading API..."
  retry_transport rsync -avz -e "${SSH_TRANSPORT}" "${jar}" "${REMOTE}:${BASE_DIR}/api/app.jar"

  echo "Restarting ${API_SERVICE}..."
  deploy_ssh "sudo /usr/bin/systemctl restart ${API_SERVICE}"
}

deploy_web() {
  echo "Uploading web sources..."
  retry_transport rsync -avz --delete -e "${SSH_TRANSPORT}" "${EXCLUDES[@]}" \
    "${ROOT_DIR}/web/" \
    "${REMOTE}:${BASE_DIR}/web/"

  echo "Building web on the server..."
  deploy_ssh "
    set -euo pipefail
    cd '${BASE_DIR}/web'
    if [ -f .env ]; then set -a; . ./.env; set +a; fi
    export NEXT_PUBLIC_API_URL=''
    export API_INTERNAL_URL='http://127.0.0.1:8151'
    npm ci
    npm run build
    sudo /usr/bin/systemctl restart '${WEB_SERVICE}'
  "
}

DO_API=false
DO_WEB=false

if [[ "$#" -eq 0 ]]; then
  DO_API=true
  DO_WEB=true
fi

for arg in "$@"; do
  case "${arg}" in
    api)
      DO_API=true
      ;;
    web)
      DO_WEB=true
      ;;
    all)
      DO_API=true
      DO_WEB=true
      ;;
    -h|--help|help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown module: ${arg}" >&2
      usage
      exit 1
      ;;
  esac
done

prepare_ssh

if ${DO_API}; then
  deploy_api
fi

if ${DO_WEB}; then
  deploy_web
fi

echo "Done!"
