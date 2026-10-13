#!/usr/bin/env bash
# abentertainment tenant - deploy script, called by /docker/agent-ops/bin/deploy-hook.sh as `deploy.sh [ref]`
# (registry: /docker/agent-ops/projects.yml). Installed at /docker/abentertainment/deploy.sh; the file is
# untracked in the production checkout on purpose and is never touched by the sync.
#
# REPLACED 2026-10-13. The previous body ran `git reset --hard <ref>` (or `git pull --ff-only`) in this checkout,
# which destroys the live data files and the locally modified docker-compose.yml. The deploy now goes through the
# same safe sync as the 20-second timer (/usr/local/sbin/abentertainment-autodeploy, source: ops/autodeploy in the
# repository): fast-forward only, anything that differs on disk is kept, rebuild only when image inputs changed,
# health check and automatic rollback to the previous image. A ref can only move the checkout FORWARD; asking for an
# older commit is refused. The hook still probes http://127.0.0.1:3000/ afterwards, as before.
set -euo pipefail

BIN="${AUTODEPLOY_BIN:-/usr/local/sbin/abentertainment-autodeploy}"
LOCK="${AD_LOCK_FILE:-/var/lock/agent-ops-deploy-abentertainment.lock}"
ref="${1:-}"

args=(--deploy-now)
[ -z "$ref" ] || args+=(--ref "$ref")

# deploy-hook.sh holds the deploy lock on fd 9 and logs our output itself; tell the script not to lock or log again.
if [ -e /proc/$$/fd/9 ] && [ "$(stat -L -c %i /proc/$$/fd/9 2>/dev/null)" = "$(stat -c %i "$LOCK" 2>/dev/null)" ]; then
  export AD_LOCK_INHERITED=1 AD_LOG_FILE=
fi
exec python3 -B "$BIN" "${args[@]}"
