#!/bin/bash
# Richtet den taeglichen Kanal-Abgleich ein (frueher Vercel Cron, vercel.json):
# Ein systemd-Timer ruft jede Nacht um 03:00 UTC /api/cron/sync-channels auf.
# Verpasste Laeufe (Server war aus) werden beim naechsten Start nachgeholt.
#
#   bash ~/app/deploy/install-sync-timer.sh
#
# Status:        systemctl list-timers festo-sync.timer
# Letzter Lauf:  journalctl -u festo-sync.service -n 20
# Sofort testen: sudo systemctl start festo-sync.service
set -euo pipefail

ENV_FILE="$HOME/app.env"

sudo tee /etc/systemd/system/festo-sync.service >/dev/null <<EOF
[Unit]
Description=Festo Video Search: Kanal-Abgleich
After=docker.service

[Service]
Type=oneshot
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/curl -fsS -m 900 -H "Authorization: Bearer \${CRON_SECRET}" http://localhost/api/cron/sync-channels
EOF

sudo tee /etc/systemd/system/festo-sync.timer >/dev/null <<'EOF'
[Unit]
Description=Festo Video Search: Kanal-Abgleich taeglich um 03:00 UTC

[Timer]
OnCalendar=*-*-* 03:00:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now festo-sync.timer
systemctl list-timers festo-sync.timer --no-pager
