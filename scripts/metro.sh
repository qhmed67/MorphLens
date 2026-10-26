#!/usr/bin/env bash
# metro.sh — start the Expo dev server *detached* from the calling shell.
#
# Why this script exists: a dev server started as a normal background job dies
# with the shell that started it, and the app then refuses to open ("Could not
# connect to Metro") until someone runs `npx expo start` by hand. `setsid`
# detaches the server from the session, so it keeps serving the phone.
#
# Usage:
#   npm run dev        # start (no-op if it is already up)
#   npm run dev:stop   # stop it
#   npm run dev:log    # follow the log
set -uo pipefail

cd "$(dirname "$0")/.."

LOG="${METRO_LOG:-/tmp/opencode/metro.log}"
PIDFILE="${METRO_PID:-/tmp/opencode/metro.pid}"
URL="http://127.0.0.1:8081/status"

if curl -fsS -o /dev/null "$URL" 2>/dev/null; then
  echo "Metro is already running on :8081 (log: $LOG)"
  exit 0
fi

mkdir -p "$(dirname "$LOG")"
setsid nohup npx expo start --lan --clear > "$LOG" 2>&1 < /dev/null &
echo $! > "$PIDFILE"

for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null "$URL" 2>/dev/null; then
    echo "Metro is up on :8081 (log: $LOG)"
    exit 0
  fi
  sleep 1
done

echo "Metro did not come up within 90s — see $LOG" >&2
exit 1
