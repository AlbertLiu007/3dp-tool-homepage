#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DEPLOY_HOST="${DEPLOY_HOST:-8.153.16.140}"
DEPLOY_USER="${DEPLOY_USER:-unionam}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/unionam_deploy}"
REMOTE_BASE="${DEPLOY_REMOTE_BASE:-/srv/unionam}"
REMOTE_DEPLOY_DIR="$REMOTE_BASE/deploy"
SKIP_LOCAL_VERIFY="${SKIP_LOCAL_VERIFY:-0}"

if [[ ! -f "$DEPLOY_SSH_KEY" ]]; then
  echo "SSH key not found: $DEPLOY_SSH_KEY" >&2
  exit 66
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to deploy a dirty working tree." >&2
  git status --short >&2
  exit 65
fi

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  echo "Production deployments must run from main, current branch: $BRANCH" >&2
  exit 65
fi

git fetch origin main
COMMIT="$(git rev-parse HEAD)"
REMOTE_COMMIT="$(git rev-parse origin/main)"
if [[ "$COMMIT" != "$REMOTE_COMMIT" ]]; then
  echo "Refusing to deploy because HEAD is not identical to origin/main." >&2
  echo "HEAD:        $COMMIT" >&2
  echo "origin/main: $REMOTE_COMMIT" >&2
  exit 65
fi

if [[ "$SKIP_LOCAL_VERIFY" != "1" ]]; then
  npm ci --no-audit --no-fund
  npm run typecheck -w apps/homepage
  npm run build -w apps/homepage
  npm run verify:gift-image-quality -w apps/homepage
fi

SHORT_COMMIT="${COMMIT:0:7}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
RELEASE_NAME="homepage-$SHORT_COMMIT-$TIMESTAMP"
TEMP_DIR="$(mktemp -d)"
ARCHIVE_PATH="$TEMP_DIR/$RELEASE_NAME.tar.gz"
REMOTE_ARCHIVE="$REMOTE_DEPLOY_DIR/incoming/$RELEASE_NAME.tar.gz"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

git archive --format=tar.gz --output="$ARCHIVE_PATH" "$COMMIT"
ARCHIVE_SHA="$(shasum -a 256 "$ARCHIVE_PATH" | awk '{print $1}')"

SSH=(ssh -i "$DEPLOY_SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$DEPLOY_HOST")
SCP=(scp -i "$DEPLOY_SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

"${SSH[@]}" "mkdir -p '$REMOTE_DEPLOY_DIR/incoming'"
"${SCP[@]}" \
  "$ROOT_DIR/scripts/deploy/homepage-router.mjs" \
  "$ROOT_DIR/scripts/deploy/remote-release.sh" \
  "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_DEPLOY_DIR/incoming/"
"${SCP[@]}" "$ARCHIVE_PATH" "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_ARCHIVE"

"${SSH[@]}" "set -eu; install -m 755 '$REMOTE_DEPLOY_DIR/incoming/homepage-router.mjs' '$REMOTE_DEPLOY_DIR/homepage-router.mjs'; install -m 755 '$REMOTE_DEPLOY_DIR/incoming/remote-release.sh' '$REMOTE_DEPLOY_DIR/remote-release.sh'; '$REMOTE_DEPLOY_DIR/remote-release.sh' '$RELEASE_NAME' '$REMOTE_ARCHIVE' '$ARCHIVE_SHA' '$COMMIT'"

echo "Production deployment completed: $RELEASE_NAME"
