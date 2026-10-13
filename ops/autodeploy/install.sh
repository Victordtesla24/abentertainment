#!/usr/bin/env bash
# Install the abentertainment auto-deploy on the VPS (run as root, from this directory).
#   ./install.sh            installs the script, units and logrotate rule; the timer stays DISABLED
#   ./install.sh --enable   additionally enables and starts the timer (this is the switch that turns auto-deploy on)
#   ./install.sh --disable  stops and disables the timer
#   ./install.sh --deploy-sh  additionally replaces /docker/abentertainment/deploy.sh (the agent-ops hook script)
#                             with the safe wrapper in this directory
set -euo pipefail
cd "$(dirname "$0")"
install -m 0755 abentertainment-autodeploy /usr/local/sbin/abentertainment-autodeploy
install -m 0644 abentertainment-autodeploy.service abentertainment-autodeploy.timer /etc/systemd/system/
install -m 0644 agent-ops.logrotate /etc/logrotate.d/agent-ops
install -d -m 0750 /var/lib/abentertainment-autodeploy /var/log/agent-ops
systemctl daemon-reload
if [ "${1:-}" = "--deploy-sh" ] || [ "${2:-}" = "--deploy-sh" ]; then
  install -m 0755 deploy.sh /docker/abentertainment/deploy.sh
fi
case "${1:-}" in
  --enable)  systemctl enable --now abentertainment-autodeploy.timer ;;
  --disable) systemctl disable --now abentertainment-autodeploy.timer ;;
esac
systemctl list-timers abentertainment-autodeploy.timer --no-pager || true
