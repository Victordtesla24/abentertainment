#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

PROJECT_ID = "abentertainment-mel"
PROJECT_NUMBER = "1034441279871"
PROJECT_NAME = "abentertainment"
APP_ID = "1:1034441279871:web:d2e9645b842ab1fd5bf24a"
SERVICE_ACCOUNT_EMAIL = "firebase-adminsdk-fbsvc@abentertainment-mel.iam.gserviceaccount.com"
SITE_URL = "https://abentertainment.web.com"
BACKEND_ID = "abentertainment"
SERVICE_ACCOUNT_FILE = "abentertainment-mel-firebase-adminsdk-fbsvc-2c8cda0af3.json"


def fail(message: str, *, code: int = 1) -> None:
    print(f"[deploy] ERROR: {message}", file=sys.stderr)
    raise SystemExit(code)


def run(
    args: list[str],
    *,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    cmd_text = " ".join(args)
    workdir = str(cwd) if cwd else os.getcwd()
    print(f"[deploy] RUN ({workdir}): {cmd_text}")
    result = subprocess.run(
        args,
        cwd=cwd,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if result.stdout:
        print(result.stdout, end="")
    if check and result.returncode != 0:
        fail(f"Command failed with exit code {result.returncode}: {cmd_text}", code=result.returncode)
    return result


def assert_tool(name: str) -> None:
    if shutil.which(name) is None:
        fail(f"Required tool not found in PATH: {name}")


def repo_paths() -> tuple[Path, Path]:
    script_file = Path(__file__).resolve()
    repo_root = script_file.parents[1]
    workspace_root = repo_root.parent
    return workspace_root, repo_root


def validate_service_account_json(repo_root: Path) -> Path:
    service_account_path = repo_root / SERVICE_ACCOUNT_FILE
    if not service_account_path.exists():
        fail(f"Missing service account key file: {service_account_path}")

    try:
        payload = json.loads(service_account_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"Service account file is invalid JSON: {exc}")

    project_id = payload.get("project_id")
    client_email = payload.get("client_email")
    if project_id != PROJECT_ID:
        fail(f"Service account project_id mismatch: expected {PROJECT_ID}, got {project_id}")
    if client_email != SERVICE_ACCOUNT_EMAIL:
        fail(
            "Service account email mismatch: "
            f"expected {SERVICE_ACCOUNT_EMAIL}, got {client_email}"
        )

    return service_account_path


def ensure_site_url(apphosting_yaml: Path) -> None:
    if not apphosting_yaml.exists():
        fail(f"Missing apphosting config: {apphosting_yaml}")

    try:
        data = yaml.safe_load(apphosting_yaml.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        fail(f"Invalid YAML in {apphosting_yaml}: {exc}")

    env_entries = data.get("env")
    if not isinstance(env_entries, list):
        fail(f"{apphosting_yaml} must define an 'env' list")

    site_entry = None
    for item in env_entries:
        if isinstance(item, dict) and item.get("variable") == "NEXT_PUBLIC_SITE_URL":
            site_entry = item
            break

    if site_entry is None:
        fail("NEXT_PUBLIC_SITE_URL is missing from apphosting.yaml env config")

    if site_entry.get("value") != SITE_URL:
        site_entry["value"] = SITE_URL
        apphosting_yaml.write_text(
            "# Firebase App Hosting Configuration\n"
            "# https://firebase.google.com/docs/app-hosting/configure\n\n"
            "env:\n"
            "  - variable: NEXT_PUBLIC_SITE_URL\n"
            f"    value: {SITE_URL}\n"
            "    availability:\n"
            "      - BUILD\n"
            "      - RUNTIME\n",
            encoding="utf-8",
        )
        print(f"[deploy] Updated NEXT_PUBLIC_SITE_URL to {SITE_URL} in {apphosting_yaml}")


def assert_project_identity(repo_root: Path) -> None:
    apphosting_file = repo_root / "apphosting.yaml"
    ensure_site_url(apphosting_file)

    env_file = repo_root / ".env"
    if env_file.exists():
        content = env_file.read_text(encoding="utf-8")
        app_id_match = re.search(r"^NEXT_PUBLIC_FIREBASE_APP_ID=(.+)$", content, flags=re.MULTILINE)
        project_id_match = re.search(
            r"^NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+)$", content, flags=re.MULTILINE
        )
        project_number_match = re.search(
            r"^NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=(.+)$", content, flags=re.MULTILINE
        )

        if app_id_match and app_id_match.group(1).strip() != APP_ID:
            fail(f".env Firebase App ID mismatch: expected {APP_ID}")
        if project_id_match and project_id_match.group(1).strip() != PROJECT_ID:
            fail(f".env Firebase project ID mismatch: expected {PROJECT_ID}")
        if project_number_match and project_number_match.group(1).strip() != PROJECT_NUMBER:
            fail(f".env Firebase sender/project number mismatch: expected {PROJECT_NUMBER}")


def current_branch(workspace_root: Path) -> str:
    result = run(["git", "branch", "--show-current"], cwd=workspace_root)
    branch = result.stdout.strip()
    if not branch:
        fail("Unable to detect current git branch")
    return branch


def run_build_parity(repo_root: Path) -> None:
    run(["npm", "exec", "--yes", "npm@10.9.2", "--", "install", "--package-lock-only"], cwd=repo_root)
    run(["npm", "exec", "--yes", "npm@10.9.2", "--", "ci"], cwd=repo_root)
    run(["npm", "run", "build"], cwd=repo_root)


def rollout_apphosting(workspace_root: Path, branch: str, service_account_path: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="firebase-auth-") as tmp_home:
        isolated_env = dict(os.environ)
        isolated_env["HOME"] = tmp_home
        isolated_env["XDG_CONFIG_HOME"] = str(Path(tmp_home) / ".config")
        isolated_env["CLOUDSDK_CONFIG"] = str(Path(tmp_home) / ".gcloud")
        isolated_env["GOOGLE_APPLICATION_CREDENTIALS"] = str(service_account_path)

        run(
            [
                "gcloud",
                "auth",
                "activate-service-account",
                SERVICE_ACCOUNT_EMAIL,
                "--key-file",
                str(service_account_path),
            ],
            cwd=workspace_root,
            env=isolated_env,
        )

        rollout = run(
            [
                "firebase",
                "apphosting:rollouts:create",
                BACKEND_ID,
                "--project",
                PROJECT_ID,
                "--git-branch",
                branch,
                "--force",
            ],
            cwd=workspace_root,
            env=isolated_env,
            check=False,
        )

    if rollout.returncode != 0:
        output = rollout.stdout or ""
        if "Permission denied" in output or "HTTP Error: 403" in output:
            fail(
                "Firebase rollout blocked by permissions for the provided identity. "
                "Grant App Hosting + Service Usage permissions and rerun."
            )
        fail("Firebase rollout command failed; inspect output above for details.", code=rollout.returncode)

    print("[deploy] Firebase App Hosting rollout command completed.")


def main() -> None:
    workspace_root, repo_root = repo_paths()

    if not (repo_root / "package.json").exists():
        fail(f"Expected repo package.json at {repo_root / 'package.json'}")

    assert_tool("uv")
    assert_tool("git")
    assert_tool("npm")
    assert_tool("firebase")
    assert_tool("gcloud")

    run(["uv", "--version"], cwd=workspace_root)
    run(["firebase", "--version"], cwd=workspace_root)

    service_account_path = validate_service_account_json(repo_root)
    assert_project_identity(repo_root)

    branch = current_branch(workspace_root)
    print(f"[deploy] Current git branch: {branch}")
    print(
        "[deploy] Firebase target: "
        f"project={PROJECT_ID} ({PROJECT_NUMBER}), app_id={APP_ID}, backend={BACKEND_ID}"
    )

    run_build_parity(repo_root)
    rollout_apphosting(workspace_root, branch, service_account_path)

    print("[deploy] Deployment flow finished successfully.")


if __name__ == "__main__":
    main()
