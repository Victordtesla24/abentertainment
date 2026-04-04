#!/usr/bin/env bash
set -euo pipefail

# Deploy static export to Hostinger shared hosting
# Usage: ./scripts/deploy-to-hostinger.sh
#
# Prerequisites:
#   - SSH key configured for Hostinger (u970615914@82.180.172.143)
#   - .env.production present in working tree
#   - Node.js and npm installed

REMOTE_USER="u970615914"
REMOTE_HOST="82.180.172.143"
REMOTE_PATH="/home/u970615914/domains/abentertainment.com.au/public_html/out"
LOCAL_OUT="out"

echo "=== AB Entertainment — Deploy to Hostinger ==="
echo ""

# Pre-flight checks
echo "[1/7] Pre-flight checks..."

if [ ! -f ".env.production" ]; then
  echo "ERROR: .env.production not found. Required for static export build."
  exit 1
fi

node scripts/validate-export-env.mjs || {
  echo "ERROR: Environment validation failed."
  exit 1
}

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "WARNING: Not on main branch (on '$CURRENT_BRANCH'). Deploy from main recommended."
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo ""
  [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

COMMIT_SHA=$(git rev-parse --short HEAD)
echo "  Branch: $CURRENT_BRANCH"
echo "  Commit: $COMMIT_SHA"

# Check for uncommitted changes
if ! git diff --quiet HEAD; then
  echo "WARNING: Uncommitted changes detected."
  read -p "Continue with uncommitted changes? [y/N] " -n 1 -r
  echo ""
  [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

# Build
echo ""
echo "[2/7] Building static export..."
NEXT_EXPORT=true npm run build

if [ ! -d "$LOCAL_OUT" ]; then
  echo "ERROR: Build did not produce $LOCAL_OUT directory."
  exit 1
fi

# Stamp build with commit SHA for provenance verification
echo "$COMMIT_SHA $(date -u +%Y-%m-%dT%H:%M:%SZ) $CURRENT_BRANCH" > "$LOCAL_OUT/.build-info"

# Verify build output
CHUNK_COUNT=$(find "$LOCAL_OUT/_next/static/chunks" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "  Build output: $(du -sh "$LOCAL_OUT" | cut -f1)"
echo "  JS/CSS chunks: $CHUNK_COUNT files"
echo "  HTML pages: $(find "$LOCAL_OUT" -name 'index.html' | wc -l | tr -d ' ')"

if [ "$CHUNK_COUNT" -eq 0 ]; then
  echo "ERROR: No JS/CSS chunks found in build output. Build may have failed."
  exit 1
fi

# Test SSH connectivity
echo ""
echo "[3/7] Testing SSH connectivity..."
ssh -o ConnectTimeout=10 -o BatchMode=yes "$REMOTE_USER@$REMOTE_HOST" "echo 'SSH OK'" 2>/dev/null || {
  echo "ERROR: Cannot connect to Hostinger via SSH."
  echo "  Verify SSH key is configured for $REMOTE_USER@$REMOTE_HOST"
  exit 1
}

# Pre-deploy backup (for rollback)
echo ""
echo "[4/7] Backing up current deployment..."
ssh "$REMOTE_USER@$REMOTE_HOST" "
  if [ -d '${REMOTE_PATH}' ]; then
    rm -rf '${REMOTE_PATH}.bak'
    cp -a '${REMOTE_PATH}' '${REMOTE_PATH}.bak'
    echo '  Backup created at ${REMOTE_PATH}.bak'
  else
    echo '  No existing deployment to backup (first deploy)'
  fi
"

# Deploy
echo ""
echo "[5/7] Deploying to Hostinger..."
rsync -avz --delete \
  --exclude='.build-info' \
  "$LOCAL_OUT/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

# Deploy .htaccess separately (lives at public_html root, not in out/)
echo ""
echo "[6/7] Deploying .htaccess..."
rsync -avz .htaccess "$REMOTE_USER@$REMOTE_HOST:/home/u970615914/domains/abentertainment.com.au/public_html/.htaccess"

# Upload build provenance info
rsync -avz "$LOCAL_OUT/.build-info" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/.build-info"

# Post-deploy verification
echo ""
echo "[7/7] Post-deploy verification..."

# Verify key files exist on server
ssh "$REMOTE_USER@$REMOTE_HOST" "
  echo 'Checking deployed files...'
  [ -f '${REMOTE_PATH}/index.html' ] && echo '  index.html: OK' || echo '  index.html: MISSING'
  [ -d '${REMOTE_PATH}/_next/static/chunks' ] && echo '  _next/chunks: OK' || echo '  _next/chunks: MISSING'
  [ -d '${REMOTE_PATH}/images' ] && echo '  images: OK' || echo '  images: MISSING'
  if [ -f '${REMOTE_PATH}/.build-info' ]; then echo \"  build-info: \$(cat '${REMOTE_PATH}/.build-info')\"; else echo '  build-info: MISSING'; fi
"

echo ""
echo "=== Deploy complete ==="
echo "  Commit: $COMMIT_SHA"
echo "  Site: https://abentertainment.com.au"
echo ""
echo "IMPORTANT: Purge LiteSpeed cache via Hostinger hPanel:"
echo "  1. Log in to hpanel.hostinger.com"
echo "  2. Go to Performance → Cache Manager"
echo "  3. Click 'Purge All Cache'"
echo ""
echo "Verify: curl -sI https://abentertainment.com.au/_next/static/chunks/ | head -5"
echo ""
echo "ROLLBACK (if needed):"
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'rm -rf ${REMOTE_PATH} && mv ${REMOTE_PATH}.bak ${REMOTE_PATH}'"
echo "  Then purge LiteSpeed cache again via hPanel."
