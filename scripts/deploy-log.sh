#!/bin/bash
# Deploy Log — registra cada deploy en deploy-log.json
# Uso: bash scripts/deploy-log.sh [proyecto] [resultado] [url]

PROJECT="${1:-unknown}"
RESULT="${2:-success}"
URL="${3:-}"
LOG_FILE="$HOME/smartconnection/deploy-log.json"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
TAG=$(git describe --tags --exact-match 2>/dev/null || echo "")
ACTOR="${GITHUB_ACTOR:-guillermo}"
DURATION="${DEPLOY_DURATION:-}"

# Crear archivo si no existe
[ ! -f "$LOG_FILE" ] && echo "[]" > "$LOG_FILE"

ENTRY=$(python3 -c "
import json, sys
entry = {
  'timestamp': '$TIMESTAMP',
  'project': '$PROJECT',
  'commit': '$COMMIT',
  'tag': '$TAG',
  'result': '$RESULT',
  'url': '$URL',
  'actor': '$ACTOR',
  'duration': '$DURATION'
}
with open('$LOG_FILE') as f: log = json.load(f)
log.insert(0, entry)
log = log[:100]  # max 100 entradas
with open('$LOG_FILE', 'w') as f: json.dump(log, f, indent=2)
print(f\"✅ Logged: {entry['project']} {entry['result']} @ {entry['timestamp']}\")
")
echo "$ENTRY"
