#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export WEB_PORT=${WEB_PORT:-5173}

# Build once manually when you change frontend:
#   npm run build

exec node --env-file=.env --no-warnings=ExperimentalWarning ./node_modules/tsx/dist/cli.mjs server/prod.ts
