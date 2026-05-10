#!/usr/bin/env bash
# Start local Redis when installed via Homebrew (macOS). No-op if already reachable.
set -euo pipefail
if command -v redis-cli >/dev/null 2>&1 && redis-cli ping 2>/dev/null | grep -q PONG; then
  echo "redis: already running (PONG)"
  exit 0
fi
if [[ "$(uname -s)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
  if brew list redis >/dev/null 2>&1; then
    brew services start redis
    for _ in 1 2 3 4 5; do
      redis-cli ping 2>/dev/null | grep -q PONG && echo "redis: started (PONG)" && exit 0
      sleep 0.4
    done
  fi
fi
echo "redis: not running. Install with: brew install redis && brew services start redis" >&2
echo "           or: docker compose -f docker/docker-compose.yml up -d redis" >&2
exit 1
