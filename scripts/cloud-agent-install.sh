#!/usr/bin/env bash
# Idempotent Cloud Agent dependency install. Node 22 is required by the locked
# @supabase/supabase-js client, which uses the native WebSocket API.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm alias default 22
  export PATH
  NODE_BIN="$(dirname "$(nvm which 22)")"
  export PATH="$NODE_BIN:$PATH"
fi

corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
