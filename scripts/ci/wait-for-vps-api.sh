#!/usr/bin/env bash
# Hold the export build (and so the out/ commit) until the VPS has rolled the API container, when this push changed
# server-side files. The workflow runs this BEFORE the data refresh and the build.
#
# Why: the static front-end is live on Hostinger about a minute after a push, the API container needs 2-3 minutes
# to rebuild. A page that calls a new API route must not be served before that route exists, and the build reads the
# live public API: started while the container is being recreated it fails with "fetch failed" (run 38507160035, the
# push of a46b55d3). Waiting here builds the export from the new API and never during its restart.
#
# How: the VPS auto-deploy (ops/autodeploy) posts the commit status "vps/api-deploy" on every commit it syncs
# (pending while it rebuilds, success when the container is healthy or nothing server-side changed, failure when the
# deploy failed and was rolled back). This script waits for that status on the pushed commit.
#
# Fails OPEN on every uncertainty (cannot list files, VPS never acknowledges within 90 s, 12 minutes pass): the
# front-end is published, exactly as it would be without this step. It fails the job only when the VPS reports that
# the deploy failed, so a front-end that depends on API changes the container does not have is not published.
#
# Environment: GITHUB_REPOSITORY, GITHUB_SHA, BEFORE_SHA (github.event.before), GH_TOKEN; optional ACK_WAIT_SECONDS,
#              FINAL_WAIT_SECONDS, POLL_SECONDS.
set -uo pipefail

REPO="${GITHUB_REPOSITORY:?}"
SHA="${GITHUB_SHA:?}"
BEFORE="${BEFORE_SHA:-}"
CONTEXT="vps/api-deploy"
ACK_WAIT="${ACK_WAIT_SECONDS:-90}"
FINAL_WAIT="${FINAL_WAIT_SECONDS:-720}"
POLL="${POLL_SECONDS:-8}"
# Paths that cannot change the API container image. Keep in sync with IGNORED_FOR_REBUILD in
# ops/autodeploy/abentertainment-autodeploy.
IGNORED='^(out/|docs/|e2e/|ops/|\.github/|\.claude/|\.context/|agent-system/|data/|public/data/|scripts/ci/)|\.md$|^(deploy-webhook\.php|api-proxy\.php|\.htaccess|ops-autodeploy-check\.txt|playwright\.config\.ts|\.gitignore|scripts/refresh-build-data\.mjs)$'

if [ -z "$BEFORE" ] || [[ "$BEFORE" =~ ^0+$ ]]; then
  echo "[wait-for-vps-api] no previous commit to compare with; not waiting"
  exit 0
fi
if ! files="$(gh api --paginate "repos/$REPO/compare/${BEFORE}...${SHA}" --jq '.files[].filename' 2>/dev/null)"; then
  echo "[wait-for-vps-api] cannot list the changed files; not waiting"
  exit 0
fi
relevant="$(printf '%s\n' "$files" | grep -v '^$' | grep -Ev "$IGNORED" || true)"
if [ -z "$relevant" ]; then
  echo "[wait-for-vps-api] no server-side file changed in this push; not waiting"
  exit 0
fi
echo "[wait-for-vps-api] server-side files changed ($(printf '%s\n' "$relevant" | wc -l)), for example:"
printf '%s\n' "$relevant" | head -5 | sed 's/^/    /'

status() {
  gh api "repos/$REPO/commits/$SHA/statuses" \
    --jq "[.[] | select(.context==\"$CONTEXT\")] | sort_by(.created_at) | last | .state // empty" 2>/dev/null
}

started=$SECONDS
state=""
deadline=$((SECONDS + ACK_WAIT))
while [ "$SECONDS" -lt "$deadline" ]; do
  state="$(status)"
  [ -n "$state" ] && break
  sleep "$POLL"
done
if [ -z "$state" ]; then
  echo "::warning::the VPS did not acknowledge this commit within ${ACK_WAIT}s (auto-deploy not running?); building and publishing the front-end without waiting"
  exit 0
fi
echo "[wait-for-vps-api] VPS acknowledged: $state"

deadline=$((SECONDS + FINAL_WAIT))
while [ "$SECONDS" -lt "$deadline" ]; do
  state="$(status)"
  case "$state" in
    success)
      echo "[wait-for-vps-api] the API container is up to date (waited $((SECONDS - started))s); building and publishing the front-end"
      exit 0
      ;;
    failure|error)
      echo "::error::the VPS reports that deploying this commit failed and the previous API container is serving; not building or publishing a front-end that may need the new API. Fix the deploy or push a new commit."
      exit 1
      ;;
  esac
  sleep "$POLL"
done
echo "::warning::the VPS API deploy did not finish within $((FINAL_WAIT / 60)) minutes; building and publishing the front-end anyway"
exit 0
