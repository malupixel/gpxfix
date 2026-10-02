#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE="malupixel"
BASE_DIR="/home/malupixel/www/tweakmyroute.com"

API_SERVICE="tweakmyroute-api.service"
WEB_SERVICE="tweakmyroute-web.service"

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
  build_dir="$(mktemp -d)"
  trap 'rm -rf "${build_dir}"; trap - RETURN' RETURN

  echo "Preparing isolated API build..."
  rsync -rlt --exclude target --exclude data "${ROOT_DIR}/api/" "${build_dir}/"

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
  rsync -avz "${jar}" "${REMOTE}:${BASE_DIR}/api/app.jar"

  echo "Restarting ${API_SERVICE}..."
  ssh "${REMOTE}" "sudo /usr/bin/systemctl restart ${API_SERVICE}"
}

deploy_web() {
  echo "Uploading web sources..."
  rsync -avz --delete "${EXCLUDES[@]}" \
    "${ROOT_DIR}/web/" \
    "${REMOTE}:${BASE_DIR}/web/"

  echo "Building web on the server..."
  ssh "${REMOTE}" "
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

if ${DO_API}; then
  deploy_api
fi

if ${DO_WEB}; then
  deploy_web
fi

echo "Done!"
