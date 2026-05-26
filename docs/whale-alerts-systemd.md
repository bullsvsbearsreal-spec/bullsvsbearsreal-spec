# Whale Priority Alerts — Droplet Systemd Setup

The `/api/cron/whale-alerts` endpoint is the low-latency alert path for
Whale-tier users. The standard `/api/cron/alerts` runs every 5min and
**skips Whale users** (controlled by the `?priority=1` flag); whale
users get their own dedicated cadence via a separate systemd timer.

## Files to install on the droplet

Drop these two files in `/etc/systemd/system/` and enable. SSH user
must have rights to write to that directory (use `sudo`).

### `/etc/systemd/system/ih-whale-alerts.service`

```ini
[Unit]
Description=InfoHub — Whale-tier priority alert delivery
Wants=ih-whale-alerts.timer
After=network-online.target

[Service]
Type=oneshot
# Read CRON_SECRET from the same env file the standard alerts cron uses
EnvironmentFile=/etc/infohub/cron.env
ExecStart=/usr/bin/curl -sS --max-time 25 \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    https://info-hub.io/api/cron/whale-alerts
# Don't restart on failure — the timer will retry on next firing
Restart=no
# Short timeout so a hung curl never blocks the next tick
TimeoutStartSec=25
```

### `/etc/systemd/system/ih-whale-alerts.timer`

```ini
[Unit]
Description=Fire InfoHub whale-tier alert check every 30 seconds
Requires=ih-whale-alerts.service

[Timer]
# Earliest fire after boot
OnBootSec=30s
# Fire every 30 seconds thereafter
OnUnitActiveSec=30s
# Anchor to monotonic time, not wall clock — avoids drift after sleep
AccuracySec=1s
# Run if the system was off when it should have fired
Persistent=true
Unit=ih-whale-alerts.service

[Install]
WantedBy=timers.target
```

### `/etc/infohub/cron.env` (already exists for the 5min cron)

```bash
CRON_SECRET=<your secret here, same as the App Platform env var>
```

## Enable + verify

```bash
# Reload unit definitions
sudo systemctl daemon-reload

# Enable timer to start on boot + start it now
sudo systemctl enable --now ih-whale-alerts.timer

# Check it's scheduled
systemctl list-timers ih-whale-alerts.timer
#  NEXT                        LEFT     LAST                        PASSED  UNIT                  ACTIVATES
#  Mon 2026-05-26 12:34:56 UTC 28s      Mon 2026-05-26 12:33:56 UTC 2s ago  ih-whale-alerts.timer ih-whale-alerts.service

# Check last few runs
journalctl -u ih-whale-alerts.service -n 30 --no-pager
```

## Choosing the cadence

The `OnUnitActiveSec=30s` above gives P99 alert latency ≈ 30s — already
10× faster than the 5min standard path. To honour the **/pricing
"P99 < 2s" promise** literally, drop the cadence to 5s or even 1s:

```ini
[Timer]
OnUnitActiveSec=5s    # P99 ≈ 5-7s — recommended starting point
# OnUnitActiveSec=1s  # P99 < 2s but heavy Upstash/DB traffic
```

Trade-off: faster cadence = more cron hits per day, more DB load on
`getAllUsersWithAlerts()` + per-user `getUserTier()`. With ≤100 Whale
users at 1s cadence, that's ~8.6M tier-check queries/day — surfable
with the existing Postgres pool but worth monitoring. At 5s cadence
the load is 5× smaller and still trivially below standard-tier latency.

If load becomes a concern, the next architectural step is **push-based
alerts** (data-source publishes to a Redis pub/sub channel, dedicated
worker fans out). That's the proper "sub-second" infrastructure but
~5× the implementation effort of this cron polling approach.

## Sanity checks after install

1. Sign in as an admin (admins auto-resolve to Whale tier). Create a
   price alert on a symbol that will fire (e.g. BTC > $1).
2. Watch the journal: `sudo journalctl -fu ih-whale-alerts.service`.
3. Within one timer tick you should see the curl call return 200 and
   the Telegram/email/push delivery fires.
4. The standard `/api/cron/alerts` 5min cron logs should now show
   `skippedByTier: N` reflecting Whale users it correctly skipped.

## Disabling

```bash
sudo systemctl disable --now ih-whale-alerts.timer
```

This stops the priority path. Whale users will be picked up by the
standard 5min cron on its next pass (the `priorityOnly=false` branch
no longer skips Whale users when no priority cron is wired) — but
they'd lose the low-latency promise. Don't disable lightly.
