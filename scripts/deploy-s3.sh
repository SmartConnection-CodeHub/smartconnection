#!/bin/bash
# Deploy smartconnection-marketing a S3 + CloudFront
# Sitio estatico autocontenido (HTML + assets en public/)

set -euo pipefail

S3_BUCKET="s3://www.smconnection.cl"
CLOUDFRONT_ID="E3O4YBX3RKHQUL"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Deploy SmartConnection Marketing ==="
echo "Proyecto: $PROJECT_ROOT"

# Validacion pre-deploy
if [ ! -f "$PROJECT_ROOT/index.html" ]; then
  echo "ERROR: index.html no existe en la raiz del proyecto"
  exit 1
fi

FILE_SIZE=$(stat -f%z "$PROJECT_ROOT/index.html" 2>/dev/null || stat -c%s "$PROJECT_ROOT/index.html" 2>/dev/null)
if [ "$FILE_SIZE" -lt 51200 ]; then
  echo "ERROR: index.html es muy pequeno ($FILE_SIZE bytes). Debe ser >50KB."
  exit 1
fi

echo "index.html OK ($FILE_SIZE bytes)"

# Subir index.html
echo ">>> Subiendo index.html..."
aws s3 cp "$PROJECT_ROOT/index.html" "$S3_BUCKET/index.html" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public, max-age=300, s-maxage=3600"

# Subir version en ingles si existe
if [ -f "$PROJECT_ROOT/en/index.html" ]; then
  echo ">>> Subiendo en/index.html..."
  aws s3 cp "$PROJECT_ROOT/en/index.html" "$S3_BUCKET/en/index.html" \
    --content-type "text/html; charset=utf-8" \
    --cache-control "public, max-age=300, s-maxage=3600"
fi

# Sync assets estaticos (imagenes, logos, JS, favicons) SIN --delete
echo ">>> Sincronizando public/ (assets)..."
aws s3 sync "$PROJECT_ROOT/public/" "$S3_BUCKET/" \
  --exclude ".DS_Store" \
  --cache-control "public, max-age=86400, s-maxage=604800"

# Invalidar cache CloudFront
echo ">>> Invalidando CloudFront..."
aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text

# Git tag versionado
TAG="deploy-marketing-$(date +%Y.%m.%d)-$(git -C "$PROJECT_ROOT" rev-list --count HEAD 2>/dev/null | tail -1 | xargs printf '%03d')"
git -C "$PROJECT_ROOT" tag "$TAG" 2>/dev/null && \
  git -C "$PROJECT_ROOT" push origin "$TAG" 2>/dev/null && \
  echo ">>> Tag: $TAG" || echo ">>> Tag omitido (sin cambios git)"

# Smoke test post-deploy
echo ">>> Smoke test..."
sleep 3
STATUS=$(curl -o /dev/null -s -w "%{http_code}" --max-time 10 https://www.smconnection.cl)
if [ "$STATUS" = "200" ]; then
  echo "✅ Deploy OK — smconnection.cl responde $STATUS"
else
  echo "🔴 Smoke test FALLÓ — status $STATUS"
  exit 1
fi

echo "=== Deploy completado ==="
echo "URL: https://www.smconnection.cl"
echo "Tag: $TAG"
