#!/bin/bash
# Gate de sintaxis JS antes de publicar (2026-08-28 · Kaizen ACT)
# Por qué: el sitio se despliega copiando archivos a S3 sin ningún paso que compile el JS.
# La clase ya nos mordió (feedback_sed_global_rompe_identificadores): un reemplazo masivo
# corrompió identificadores y salió a producción, porque el único smoke era `curl → 200`
# y un HTML con JS roto igual responde 200. Esto revienta ANTES de subir nada.
# Cubre los .js sueltos Y el JS embebido en los <script> de los .html.
set -u
cd "$(dirname "$0")/.." || exit 1
FAIL=0

for f in $(find . -name "*.js" -not -path "./.git/*" -not -path "*/node_modules/*"); do
  if node --check "$f" 2>/tmp/checkjs.err; then
    echo "✅ $f"
  else
    echo "❌ $f"; sed 's/^/     /' /tmp/checkjs.err; FAIL=1
  fi
done

for h in $(find . -name "*.html" -not -path "./.git/*" -not -path "*/node_modules/*"); do
  node -e '
    const fs=require("fs"), vm=require("vm");
    const src=fs.readFileSync(process.argv[1],"utf8");
    // solo scripts inline: los que tienen src= los baja el navegador, no viven en el HTML
    const re=/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m, n=0, bad=0;
    while ((m=re.exec(src))) {
      n++;
      const code=m[1];
      if (!code.trim()) continue;
      // línea real donde empieza el bloque, para que el error sea ubicable
      const line=src.slice(0,m.index).split("\n").length;
      try { new vm.Script(code); }
      catch (e) { bad++; console.error(`     bloque #${n} (línea ~${line}): ${e.message}`); }
    }
    if (bad) { console.log(`❌ ${process.argv[1]} — ${bad}/${n} bloques <script> con error`); process.exit(1); }
    console.log(`✅ ${process.argv[1]} — ${n} bloque(s) <script> inline OK`);
  ' "$h" || FAIL=1
done

[ "$FAIL" -eq 0 ] && echo "✅ Sintaxis JS OK — se puede publicar" || echo "🔴 JS roto — deploy abortado"
exit "$FAIL"
