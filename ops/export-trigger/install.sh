#!/usr/bin/env bash
# Install the export trigger on the VPS (run as root, from this directory).
#   ./install.sh            installs the script and units and makes a dry-run tick; the timer stays DISABLED
#   ./install.sh --enable   additionally enables and starts the timer (this is the switch that turns the trigger on)
#   ./install.sh --disable  stops and disables the timer
# Needs: node (the same check script the workflow runs), git, gh logged in as root (repo + workflow scopes). No new secret.
set -euo pipefail
cd "$(dirname "$0")"
if [ "${1:-}" = "--disable" ]; then systemctl disable --now abentertainment-export-trigger.timer; exit 0; fi
python3 -B abentertainment-export-trigger --self-test
command -v node >/dev/null || { echo "node is required on the VPS" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh is not logged in for root" >&2; exit 1; }
install -m 0755 abentertainment-export-trigger /usr/local/sbin/abentertainment-export-trigger
install -m 0644 abentertainment-export-trigger.service abentertainment-export-trigger.timer /etc/systemd/system/
install -d -m 0750 /var/lib/abentertainment-export-trigger /var/log/agent-ops
systemctl daemon-reload
python3 -B /usr/local/sbin/abentertainment-export-trigger --dry-run
if [ "${1:-}" = "--enable" ]; then systemctl enable --now abentertainment-export-trigger.timer; fi
systemctl list-timers abentertainment-export-trigger.timer --no-pager || true
