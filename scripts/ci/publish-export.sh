#!/usr/bin/env bash
# Commit the rebuilt out/ to main, and nothing but out/.
#
#   * stages out/ only (force-added: it is gitignored) and refuses to continue if anything else is staged;
#   * does nothing when out/ is identical to what main already carries;
#   * builds the commit with git plumbing on top of the CURRENT tip of main (tip tree with out/ replaced by the
#     built out/), so a bot commit can never conflict, never touches another path and never rewrites history;
#   * if main has moved on with changes outside out/, the build is stale and is skipped (the run for the newer
#     commit publishes its own export);
#   * pushes without force, retrying when another push wins the race.
#
# Environment: GITHUB_SHA (commit that was built), DRY_RUN (default 1; "0" publishes), TRIGGER (label for the message),
#              GIT_REMOTE (default origin), TARGET_BRANCH (default main).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BUILT_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"
REMOTE="${GIT_REMOTE:-origin}"
BRANCH="${TARGET_BRANCH:-main}"
DRY_RUN="${DRY_RUN:-1}"
TRIGGER="${TRIGGER:-manual}"

git add -A -f -- out
outside="$(git diff --cached --name-only | grep -v '^out/' || true)"
if [ -n "$outside" ]; then
  echo "[publish-export] refusing to continue: paths outside out/ are staged:" >&2
  echo "$outside" >&2
  exit 1
fi
if git diff --cached --quiet -- out; then
  echo "[publish-export] out/ is identical to the committed export: nothing to commit"
  exit 0
fi
echo "[publish-export] out/ changed: $(git diff --cached --name-only | wc -l) files ($(git diff --cached --diff-filter=A --name-only | wc -l) added, $(git diff --cached --diff-filter=M --name-only | wc -l) modified, $(git diff --cached --diff-filter=D --name-only | wc -l) deleted)"
if [ "$DRY_RUN" != "0" ]; then
  echo "[publish-export] dry run: nothing is committed or pushed"
  exit 0
fi

OUT_TREE="$(git rev-parse "$(git write-tree):out")"
INPUTS="$(node -p "require('./out/.build-info.json').inputs" 2>/dev/null || echo unknown)"
export GIT_AUTHOR_NAME="github-actions[bot]" GIT_COMMITTER_NAME="github-actions[bot]"
export GIT_AUTHOR_EMAIL="41898282+github-actions[bot]@users.noreply.github.com" GIT_COMMITTER_EMAIL="41898282+github-actions[bot]@users.noreply.github.com"
MESSAGE="$(printf 'build(export): regenerate static export [skip ci]\n\nsource: %s\ninputs: %s\ntrigger: %s\n' "$BUILT_SHA" "$INPUTS" "$TRIGGER")"

for attempt in 1 2 3 4 5; do
  git fetch --no-tags --depth=1 "$REMOTE" "$BRANCH"
  tip="$(git rev-parse FETCH_HEAD)"
  if [ "$tip" != "$BUILT_SHA" ] && git diff --name-only "$BUILT_SHA" "$tip" | grep -qv '^out/'; then
    echo "[publish-export] superseded: $BRANCH moved to $tip with changes outside out/; the run for that commit publishes its own export"
    exit 0
  fi
  index="$(mktemp -u)"
  GIT_INDEX_FILE="$index" git read-tree "$tip"
  GIT_INDEX_FILE="$index" git rm -r -q --cached --ignore-unmatch -- out
  GIT_INDEX_FILE="$index" git read-tree --prefix=out/ "$OUT_TREE"
  tree="$(GIT_INDEX_FILE="$index" git write-tree)"
  rm -f "$index"
  if [ "$tree" = "$(git rev-parse "$tip^{tree}")" ]; then
    echo "[publish-export] $BRANCH ($tip) already carries this export"
    exit 0
  fi
  commit="$(git commit-tree "$tree" -p "$tip" -m "$MESSAGE")"
  if git push "$REMOTE" "$commit:refs/heads/$BRANCH"; then
    echo "[publish-export] published $commit on $BRANCH (parent $tip)"
    exit 0
  fi
  echo "[publish-export] push rejected (attempt $attempt of 5); retrying on the new tip"
  sleep $((attempt * 4))
done
echo "[publish-export] could not publish after 5 attempts" >&2
exit 1
