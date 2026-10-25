#!/usr/bin/env bash
# metro-stop.sh — stop the detached Expo dev server.
set -uo pipefail

PIDFILE="${METRO_PID:-/tmp/opencode/metro.pid}"

# The shell that runs this script (and its parents) must never be killed, even
# if its command line happens to contain the words "expo start".
is_ancestor() {
  local candidate="$1" pid="$$"
  while [ -n "$pid" ] && [ "$pid" != "0" ] && [ "$pid" != "1" ]; do
    [ "$pid" = "$candidate" ] && return 0
    pid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
  done
  return 1
}

stopped=0

if [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE")"
  if kill "$PID" 2>/dev/null; then
    echo "Stopped the dev server (pid $PID)."
    stopped=1
  fi
  rm -f "$PIDFILE"
fi

# Fall back to whatever dev server is still listening (the pid file is lost
# when the machine reboots or the file is cleaned).
for pid in $(pgrep -f 'expo start' 2>/dev/null || true); do
  is_ancestor "$pid" && continue
  kill "$pid" 2>/dev/null && stopped=1
done

if [ "$stopped" = "1" ]; then
  echo "Dev server stopped."
else
  echo "No dev server was running."
fi
