#!/bin/bash
# Recordatorio trimestral de rotación de secrets SMC
# Corre via launchd cada 90 días

osascript -e 'display dialog "🔐 SMC — Rotación de Secrets\n\nHan pasado 90 días. Revisar y rotar:\n\n• ANTHROPIC_API_KEY (Amplify + GitHub)\n• GROQ_API_KEY\n• SUPABASE_SERVICE_KEY\n• GITHUB_TOKEN\n• AWS Access Keys\n• SESSION_SECRET\n\nActualizar en: Amplify Console + GitHub Secrets" with title "SMC Security Reminder" buttons {"Hecho", "Recordar en 7 días"} default button "Hecho"' 2>/dev/null
