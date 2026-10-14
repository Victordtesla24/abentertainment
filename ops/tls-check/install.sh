#!/usr/bin/env bash
# Install the daily TLS-hop check on the VPS (run as root, from this directory).
#   ./install.sh            installs the script and units, enables the timer and runs the check once
#   ./install.sh --disable  stops and disables the timer
# The log (/var/log/agent-ops/tls-abentertainment-check.log) is rotated by the existing /etc/logrotate.d/agent-ops rule.
set -euo pipefail
cd "$(dirname "$0")"
if [ "${1:-}" = "--disable" ]; then systemctl disable --now abentertainment-tls-check.timer; exit 0; fi
python3 -B abentertainment-tls-check --self-test
install -m 0755 abentertainment-tls-check /usr/local/sbin/abentertainment-tls-check
install -m 0644 abentertainment-tls-check.service abentertainment-tls-check.timer /etc/systemd/system/
install -d -m 0750 /var/log/agent-ops
systemctl daemon-reload
systemctl enable --now abentertainment-tls-check.timer
systemctl start abentertainment-tls-check.service || true   # exit 1/2 = WARN/FAIL: details are in the log, do not stop the install
systemctl list-timers abentertainment-tls-check.timer --no-pager || true
tail -n 12 /var/log/agent-ops/tls-abentertainment-check.log
