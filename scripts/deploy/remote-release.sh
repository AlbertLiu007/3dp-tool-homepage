#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 4 ]]; then
  echo "Usage: remote-release.sh <release-name> <archive-path> <sha256> <commit>" >&2
  exit 64
fi

RELEASE_NAME="$1"
ARCHIVE_PATH="$2"
EXPECTED_SHA="$3"
COMMIT="$4"

BASE_DIR="${DEPLOY_BASE_DIR:-/srv/unionam}"
RELEASES_DIR="$BASE_DIR/releases"
DEPLOY_DIR="$BASE_DIR/deploy"
SHARED_DIR="$BASE_DIR/shared/homepage"
SHARED_ENV="$SHARED_DIR/.env.local"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"
APP_DIR="$RELEASE_DIR/apps/homepage"
TARGET_FILE="$DEPLOY_DIR/homepage-active-port"
CURRENT_LINK="$BASE_DIR/current-homepage"
PREVIOUS_LINK="$BASE_DIR/previous-homepage"
LOCK_FILE="$DEPLOY_DIR/homepage-deploy.lock"
ROUTER_SCRIPT="$DEPLOY_DIR/homepage-router.mjs"
BLUE_PORT=3012
GREEN_PORT=3013

mkdir -p "$RELEASES_DIR" "$DEPLOY_DIR" "$SHARED_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another homepage deployment is already running." >&2
  exit 75
fi

if [[ ! "$RELEASE_NAME" =~ ^homepage-[A-Za-z0-9._-]+$ ]]; then
  echo "Invalid release name." >&2
  exit 64
fi

ACTUAL_SHA="$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')"
if [[ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]]; then
  echo "Release archive checksum mismatch." >&2
  exit 65
fi

if [[ -e "$RELEASE_DIR" ]]; then
  echo "Release already exists: $RELEASE_DIR" >&2
  exit 73
fi

bootstrap_shared_environment() {
  if [[ -f "$SHARED_ENV" ]]; then
    chmod 600 "$SHARED_ENV"
    return
  fi

  local source_env=""
  if [[ -L "$CURRENT_LINK" && -f "$CURRENT_LINK/apps/homepage/.env.local" ]]; then
    source_env="$CURRENT_LINK/apps/homepage/.env.local"
  else
    source_env="$(find "$RELEASES_DIR" -path '*/apps/homepage/.env.local' -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)"
  fi

  if [[ -z "$source_env" || ! -f "$source_env" ]]; then
    echo "Unable to bootstrap the shared production environment file." >&2
    exit 66
  fi

  install -m 600 "$source_env" "$SHARED_ENV"
}

wait_for_health() {
  local url="$1"
  local expected_commit="${2:-}"
  local attempts="${3:-90}"
  local response=""
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if response="$(curl --silent --show-error --fail --max-time 5 "$url" 2>/dev/null)"; then
      if [[ -z "$expected_commit" || "$response" == *"\"commit\":\"$expected_commit\""* ]]; then
        return 0
      fi
    fi
    sleep 1
  done
  echo "Health check failed: $url" >&2
  [[ -n "$response" ]] && echo "$response" >&2
  return 1
}

atomic_target_switch() {
  local port="$1"
  local temporary="$TARGET_FILE.$$.tmp"
  printf '%s\n' "$port" > "$temporary"
  mv -f "$temporary" "$TARGET_FILE"
}

bootstrap_shared_environment
mkdir -p "$RELEASE_DIR"
tar -xzf "$ARCHIVE_PATH" -C "$RELEASE_DIR"
ln -s "$SHARED_ENV" "$APP_DIR/.env.local"

cat > "$RELEASE_DIR/DEPLOYMENT" <<EOF
release=$RELEASE_NAME
commit=$COMMIT
archive_sha256=$EXPECTED_SHA
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

cd "$RELEASE_DIR"
npm ci --no-audit --no-fund
npm run typecheck -w apps/homepage
npm run build -w apps/homepage
npm run verify:gift-image-quality -w apps/homepage

if [[ -f "$TARGET_FILE" ]]; then
  ACTIVE_PORT="$(tr -d '[:space:]' < "$TARGET_FILE")"
else
  ACTIVE_PORT=""
fi

if [[ "$ACTIVE_PORT" == "$BLUE_PORT" ]]; then
  CANDIDATE_PORT="$GREEN_PORT"
  CANDIDATE_NAME="3dp-homepage-green"
elif [[ "$ACTIVE_PORT" == "$GREEN_PORT" ]]; then
  CANDIDATE_PORT="$BLUE_PORT"
  CANDIDATE_NAME="3dp-homepage-blue"
else
  CANDIDATE_PORT="$BLUE_PORT"
  CANDIDATE_NAME="3dp-homepage-blue"
fi

pm2 delete "$CANDIDATE_NAME" >/dev/null 2>&1 || true
APP_RELEASE="$RELEASE_NAME" APP_COMMIT="$COMMIT" NEXT_DIST_DIR=.next-build NODE_ENV=production \
  pm2 start "$RELEASE_DIR/node_modules/next/dist/bin/next" \
  --name "$CANDIDATE_NAME" \
  --cwd "$APP_DIR" \
  --interpreter /usr/bin/node-22 \
  -- start --hostname 127.0.0.1 --port "$CANDIDATE_PORT"

wait_for_health "http://127.0.0.1:$CANDIDATE_PORT/api/health" "$COMMIT"

set -a
# shellcheck disable=SC1090
. "$SHARED_ENV"
set +a
npm run migrate:gift-db -w apps/homepage

SWITCHED=0
rollback() {
  local exit_code=$?
  if [[ $SWITCHED -eq 1 && -n "$ACTIVE_PORT" ]]; then
    echo "Deployment failed after traffic switch; restoring port $ACTIVE_PORT." >&2
    atomic_target_switch "$ACTIVE_PORT"
  fi
  exit "$exit_code"
}
trap rollback ERR

if [[ ! -f "$ROUTER_SCRIPT" ]]; then
  echo "Missing stable router script: $ROUTER_SCRIPT" >&2
  exit 66
fi

if ! pm2 describe 3dp-homepage-router >/dev/null 2>&1; then
  atomic_target_switch "$CANDIDATE_PORT"
  pm2 delete 3dp-homepage >/dev/null 2>&1 || true
  ROUTER_TARGET_FILE="$TARGET_FILE" ROUTER_PORT=3002 NODE_ENV=production \
    pm2 start "$ROUTER_SCRIPT" --name 3dp-homepage-router --interpreter /usr/bin/node-22
  wait_for_health "http://127.0.0.1:3002/__router_health"
else
  atomic_target_switch "$CANDIDATE_PORT"
fi
SWITCHED=1

wait_for_health "http://127.0.0.1:3002/api/health" "$COMMIT"
for url in \
  "https://unionam.com/api/health" \
  "https://www.unionam.com/api/health" \
  "https://ops.unionam.com/api/health"; do
  wait_for_health "$url" "$COMMIT" 30
done

if [[ -L "$CURRENT_LINK" ]]; then
  ln -sfn "$(readlink -f "$CURRENT_LINK")" "$PREVIOUS_LINK"
fi
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

cat >> "$DEPLOY_DIR/homepage-deployments.log" <<EOF
$(date -u +%Y-%m-%dT%H:%M:%SZ) release=$RELEASE_NAME commit=$COMMIT sha256=$EXPECTED_SHA port=$CANDIDATE_PORT status=success
EOF

pm2 save
rm -f "$ARCHIVE_PATH"
trap - ERR
echo "Deployment succeeded: $RELEASE_NAME on port $CANDIDATE_PORT"
