# Hub bot v2 — operator setup

Two things on your side. Both are environment / infra — no more code edits.

## 1. Add the DO Inference API key

In DO App Platform → your `infohub-web` app → Settings → Environment Variables, add:

```
DO_INFERENCE_API_KEY=doo_v1_...
```

(The key is the `doo_v1_...` value visible after creating it at
cloud.digitalocean.com/model-studio/manage-keys. Encrypted secret.)

Optional override (default is `openai-gpt-5`):

```
BOT_LLM_MODEL=openai-gpt-5
```

Other valid IDs on DO: `anthropic-claude-sonnet-4`, `anthropic-claude-opus-4`,
`openai-gpt-5.2`, `openai-gpt-4.1`, `deepseek-v4-pro`, `llama-3.3-70b-instruct`.

Until the key is set, the bot replies "AI chat is not configured yet" to
all chat messages. Commands (/start, /stop, /status, /mute, /forget, /recap)
still work because they don't hit the model.

## 2. Add the 4 new systemd timers on the droplet

```bash
ssh root@46.101.247.54
```

Create one timer + service file for each cron. The `infohub-cron@.service`
template already exists — these are just timer files that pass the right
endpoint path.

### Timer: prune telegram conversations (nightly retention sweep)

```bash
cat > /etc/systemd/system/infohub-cron-prune-tg-conversations.timer <<'EOF'
[Unit]
Description=InfoHub cron — prune telegram conversations (90-day retention)

[Timer]
OnCalendar=*-*-* 03:30:00 UTC
Unit=infohub-cron@prune-tg-conversations.service
Persistent=true

[Install]
WantedBy=timers.target
EOF
```

### Timer: scan-ideas (proactive idea push, every 5 min)

```bash
cat > /etc/systemd/system/infohub-cron-scan-ideas.timer <<'EOF'
[Unit]
Description=InfoHub cron — Hub bot scan-ideas

[Timer]
OnCalendar=*-*-* *:*:00/5
Unit=infohub-cron@scan-ideas.service
Persistent=true

[Install]
WantedBy=timers.target
EOF
```

### Timer: watch-ideas (lifecycle/invalidation, every 5 min)

```bash
cat > /etc/systemd/system/infohub-cron-watch-ideas.timer <<'EOF'
[Unit]
Description=InfoHub cron — Hub bot watch-ideas (lifecycle)

[Timer]
OnCalendar=*-*-* *:*:00/5
Unit=infohub-cron@watch-ideas.service
Persistent=true

[Install]
WantedBy=timers.target
EOF
```

### Timer: morning-brief (daily 08:00 UTC)

```bash
cat > /etc/systemd/system/infohub-cron-morning-brief.timer <<'EOF'
[Unit]
Description=InfoHub cron — Hub bot morning brief

[Timer]
OnCalendar=*-*-* 08:00:00 UTC
Unit=infohub-cron@morning-brief.service
Persistent=true

[Install]
WantedBy=timers.target
EOF
```

### Enable + start

```bash
systemctl daemon-reload
systemctl enable --now \
  infohub-cron-prune-tg-conversations.timer \
  infohub-cron-scan-ideas.timer \
  infohub-cron-watch-ideas.timer \
  infohub-cron-morning-brief.timer

systemctl list-timers --all 'infohub-cron-*'
```

You should see all 4 new timers in the list alongside the existing 13.

### Verify

```bash
# Manually fire one to confirm it works:
journalctl -u 'infohub-cron@scan-ideas' --since "1 minute ago" -f &
systemctl start infohub-cron@scan-ideas.service

# Should see in the log: "HTTP 200" + a JSON response body
```

## 3. (Optional) reset bot menu in Telegram

If you've changed any command descriptions, run:

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "start", "description": "Link or resume"},
      {"command": "stop", "description": "Pause notifications"},
      {"command": "status", "description": "Show status"},
      {"command": "mute", "description": "Mute for N hours"},
      {"command": "unmute", "description": "Resume early"},
      {"command": "ideas", "description": "Top trade setups (Pro+)"},
      {"command": "notify", "description": "Toggle proactive push (Pro+)"},
      {"command": "brief", "description": "Morning brief (Pro+)"},
      {"command": "forget", "description": "Wipe history"},
      {"command": "recap", "description": "Summarize last 7 days"},
      {"command": "help", "description": "Show commands"}
    ]
  }'
```

## What to expect after setup

- Within 5 min of the scan-ideas timer enabling, the first proactive
  push *could* fire — but only if the universe has a coin scoring ≥ 75.
  On a quiet day you'll see zero pushes. That's the design.
- The watch-ideas timer is a no-op when no ideas are live.
- The morning brief fires once daily — you'll see it in your DMs at 08:00 UTC.
- `/bot/track` shows zero data until the first push lands. Then it
  populates automatically as ideas close.
