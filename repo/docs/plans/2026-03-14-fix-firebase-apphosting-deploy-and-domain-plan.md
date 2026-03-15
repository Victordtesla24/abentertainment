---
title: fix: recover Firebase App Hosting deploy and enforce production domain
type: fix
status: active
date: 2026-03-14
origin: firebase-server-logs.log
---

# fix: recover Firebase App Hosting deploy and enforce production domain

## Overview

This plan restores reliable Firebase App Hosting deployment for the AB Entertainment website using the existing Firebase project and app identity only, aligns production URLs to `abentertainment.web.com`, and introduces a deterministic deployment script that uses `uv` for script runtime dependencies.

## Problem Statement

`firebase-server-logs.log` shows App Hosting build failure at cloud build step 3 due to `npm ci` lockfile mismatch:

- `Missing: @swc/helpers@0.5.19 from lock file`
- `npm ci can only install packages when your package.json and package-lock.json are in sync`

This blocks rollout creation even though local `npm run build` succeeds.

## Hard Constraints

- Use only Firebase project `abentertainment-mel` (project number `1034441279871`).
- Use only app ID `1:1034441279871:web:d2e9645b842ab1fd5bf24a`.
- Do not create new Firebase projects, apps, or hosting sites.
- Update only impacted application files and deployment-related scripts/config.
- Keep production domain `abentertainment.web.com`.
- Use Firebase CLI and GitHub for deployment workflow.

## Deterministic Defaults

- Continue on current branch.
- Use existing App Hosting backend context and current branch commit.
- Use headless mode for automated browser checks.
- Use `npm@10.9.2` for lockfile/CI parity with Firebase builder behavior.
- Use `uv` for deployment-script Python dependencies.

## Root Cause Findings

- Firebase App Hosting builder executes `npm ci` and enforces strict lockfile consistency.
- Local environment with npm 11 can mask lockfile issues that fail under npm 10.
- Existing lockfile required a regeneration pass to satisfy builder expectations.
- Existing app-level domain references had partial drift from legacy `.com.au` URLs.
- CLI auth for App Hosting rollout currently returns `403` for the signed-in identity and provided service account, which can block live rollout creation after code is fixed.

## Execution Phases

### Phase 1: Stabilize Build Inputs

- [ ] Regenerate `repo/package-lock.json` using `npm@10.9.2`.
- [ ] Re-run `npm@10.9.2 ci` in `repo/` and confirm success.
- [ ] Re-run `npm run build` in `repo/` and confirm success.

### Phase 2: Enforce Production Domain

- [ ] Keep `repo/apphosting.yaml` runtime/build env `NEXT_PUBLIC_SITE_URL=https://abentertainment.web.com`.
- [ ] Update impacted hardcoded public URLs in cron/newsletter/metadata files to `https://abentertainment.web.com`.
- [ ] Ensure no remaining `.com.au` production URL references in impacted runtime paths.

### Phase 3: Deployment Automation (with `uv`)

- [ ] Add deployment script under `repo/scripts/` that:
- [ ] Validates expected Firebase project ID, project number, app ID, and service-account email.
- [ ] Validates/repairs `NEXT_PUBLIC_SITE_URL` in `repo/apphosting.yaml` to `https://abentertainment.web.com`.
- [ ] Uses `uv` to provision required Python dependencies for script execution.
- [ ] Runs lockfile parity command via `npm@10.9.2`.
- [ ] Verifies local build before deploy.
- [ ] Triggers Firebase App Hosting rollout via Firebase CLI for current branch/commit.
- [ ] Emits explicit failure if permissions block rollout creation.

## Detailed Implementation Notes

### Deployment Script Contract (`repo/scripts/deploy_firebase_apphosting.py`)

- [ ] Require execution from repository root and fail fast on missing `repo/`.
- [ ] Parse and enforce the following fixed values:
- [ ] `Project_ID=abentertainment-mel`
- [ ] `Project_Number=1034441279871`
- [ ] `Project_Name=abentertainment`
- [ ] `App_ID=1:1034441279871:web:d2e9645b842ab1fd5bf24a`
- [ ] `SERVICE_ACCOUNT=firebase-adminsdk-fbsvc@abentertainment-mel.iam.gserviceaccount.com`
- [ ] Validate service-account JSON in `repo/abentertainment-mel-firebase-adminsdk-fbsvc-2c8cda0af3.json`.
- [ ] Export `GOOGLE_APPLICATION_CREDENTIALS` for CLI calls.
- [ ] Verify Firebase CLI is installed and accessible.
- [ ] Verify `uv` is installed and accessible.
- [ ] Use `npm exec --yes npm@10.9.2 -- install --package-lock-only` before CI parity check.
- [ ] Use `npm exec --yes npm@10.9.2 -- ci` and `npm run build`.
- [ ] Attempt `firebase apphosting:rollouts:create abentertainment --project abentertainment-mel --git-branch <current_branch> --force`.
- [ ] If rollout fails with `403`/permission denied, print a hard error and stop with non-zero exit code.

### Minimal File-Impact Policy

- [ ] Do not modify unrelated product code.
- [ ] Do not modify Firebase resource topology.
- [ ] Do not commit secret `.env` content.
- [ ] Keep all deployment automation under `repo/scripts/` and supporting docs only.

### Phase 4: Validate and Ship

- [ ] Run targeted sanity checks for changed routes/components.
- [ ] Commit only impacted files.
- [ ] Push branch to GitHub.
- [ ] Execute deployment script and capture rollout result or blocking error.

## Acceptance Criteria

- [ ] `repo/package-lock.json` is builder-compatible; `npm@10.9.2 ci` passes.
- [ ] `npm run build` passes in `repo/`.
- [ ] Production domain is consistently `abentertainment.web.com` in impacted files.
- [ ] Deployment script exists, runs with `uv`, and validates expected Firebase identity values.
- [ ] Changes are committed and pushed to GitHub.
- [ ] Firebase rollout is triggered; if blocked, failure reason is explicit and actionable.

## Operational Validation

- `cd repo && npm exec --yes npm@10.9.2 -- ci`
- `cd repo && npm run build`
- `cd repo && uv run --with pyyaml scripts/deploy_firebase_apphosting.py`
