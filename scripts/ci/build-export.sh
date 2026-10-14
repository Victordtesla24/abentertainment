#!/usr/bin/env bash
# Build the Hostinger static export (out/) exactly as the production build does, from the live public data.
#
#   * committed .jpeg uploads are restored first (*.jpeg is gitignored under public/, so they exist only as out/uploads/*.jpeg in git)
#   * data/*.json are refreshed from the live public API (the build fails when it is unreachable or returns empty data)
#   * NEXT_PUBLIC_VPS_API_URL / NEXT_PUBLIC_ESCALATION_EMAIL unset, telemetry off, canonical site URL, script deferral on
#   * the result is stamped (out/.build-info.json) and verified; refreshed data files are put back afterwards and never committed
#
# The live API must not be mid-restart: in the workflow the VPS hold (wait-for-vps-api.sh) runs before this script for pushes that
# change server-side files, and refresh-build-data.mjs retries a restart for about three minutes before it fails the build.
#
# Run from anywhere inside the repository after `npm ci`. Used by .github/workflows/build-export.yml and runnable locally.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

restore_workspace() { git checkout -- data public/data 2>/dev/null || true; }
trap restore_workspace EXIT

git ls-files 'out/uploads/*.jpeg' | while IFS= read -r f; do
  dest="public/${f#out/}"
  mkdir -p "$(dirname "$dest")"
  git show "HEAD:$f" > "$dest"
done

node scripts/refresh-build-data.mjs

# a build id derived from the inputs makes the export reproducible: same inputs, same bytes
NEXT_BUILD_ID="$(node -p "require('./node_modules/.cache/abent-export/inputs.json').inputs.slice(0, 20)")"

rm -rf .next tsconfig.tsbuildinfo
env -u NEXT_PUBLIC_VPS_API_URL -u NEXT_PUBLIC_ESCALATION_EMAIL \
  NEXT_BUILD_ID="$NEXT_BUILD_ID" DEFER_SCRIPTS=1 NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SITE_URL=https://abentertainment.com.au \
  npm run build:export

node scripts/refresh-build-data.mjs --stamp
node scripts/ci/verify-export.mjs
echo "[build-export] out/: $(find out -name index.html | wc -l) html pages, $(du -sh out | cut -f1)"
