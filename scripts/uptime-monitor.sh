#!/bin/bash
# SMC Uptime Monitor — corre cada 5 min via launchd
# Notifica en macOS si algún servicio cae o tarda >3s

URLS=(
  "https://www.smconnection.cl|Marketing"
  "https://intranet.smconnection.cl|Intranet"
  "https://voy-app-3.vercel.app|VOY"
  "https://develop.d2qam7xccab5t8.amplifyapp.com|Intranet QAS"
)

LOG="$HOME/smartconnection/logs/uptime.log"
mkdir -p "$(dirname $LOG)"

notify() {
  local title="$1"
  local msg="$2"
  osascript -e "display notification \"$msg\" with title \"$title\" sound name \"Basso\""
}

for entry in "${URLS[@]}"; do
  URL="${entry%%|*}"
  NAME="${entry##*|}"

  START=$(date +%s)
  STATUS=$(curl -o /dev/null -s -w "%{http_code}" --max-time 10 "$URL")
  END=$(date +%s)
  MS=$(( (END - START) * 1000 ))

  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

  if [ "$STATUS" != "200" ]; then
    echo "[$TIMESTAMP] 🔴 $NAME DOWN — status $STATUS" >> "$LOG"
    notify "🔴 SMC DOWN: $NAME" "$URL respondió $STATUS"
  elif [ "$MS" -gt 5000 ]; then
    echo "[$TIMESTAMP] 🟡 $NAME LENTO — ${MS}ms" >> "$LOG"
    notify "🟡 SMC LENTO: $NAME" "${MS}ms — umbral 3000ms"
  else
    echo "[$TIMESTAMP] ✅ $NAME OK — ${MS}ms" >> "$LOG"
  fi
done

# Rotar log si supera 500 líneas
LINES=$(wc -l < "$LOG")
if [ "$LINES" -gt 500 ]; then
  tail -200 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
