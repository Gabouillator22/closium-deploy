#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Closium OS — Agent autonome
# Lance : Webhook Server + OpenClaw Gateway + Cloudflare Tunnel
# Usage : bash agent/start.sh
# ─────────────────────────────────────────────────────────────

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Charger .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Vérif variables requises
required_vars=(
  NOTION_TOKEN
  GOOGLE_SERVICE_ACCOUNT_PATH
  SLACK_WEBHOOK_URL
  SLACK_CHANNEL_GABRIEL
)
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Variable manquante : $var (ajoute-la dans .env)"
    exit 1
  fi
done

echo ""
echo "🚀 Closium OS Agent — démarrage"
echo "─────────────────────────────────────────────────"

# 1. Webhook server (port 18790)
echo "▶ Webhook Server (port 18790)..."
node agent/webhook-server.js &
WEBHOOK_PID=$!
echo "  PID: $WEBHOOK_PID"

sleep 1

# 2. Cloudflare Tunnel (expose port 18790 publiquement)
if command -v cloudflared &> /dev/null; then
  echo "▶ Cloudflare Tunnel..."
  cloudflared tunnel --url http://localhost:18790 --no-autoupdate 2>&1 | \
    grep -E "(trycloudflare|https://)" | head -3 &
  CF_PID=$!
  sleep 3
  echo "  Tunnel actif"
else
  echo "⚠️  cloudflared non installé — tunnel désactivé"
  echo "   Install : brew install cloudflare/cloudflare/cloudflared"
  echo "   Ou utilise : npx ngrok http 18790"
fi

# 3. OpenClaw Gateway (port 18789)
if command -v openclaw &> /dev/null; then
  echo "▶ OpenClaw Gateway (port 18789)..."
  openclaw start --config agent/config/openclaw.yaml &
  OC_PID=$!
  echo "  PID: $OC_PID"
else
  echo "⚠️  OpenClaw non installé"
  echo "   Install : curl -fsSL https://get.openclaw.ai | bash"
fi

echo ""
echo "✅ Agent Closium OS opérationnel"
echo "─────────────────────────────────────────────────"
echo "Webhook Stripe  : POST /webhook/stripe"
echo "Webhook Tally   : POST /webhook/tally"
echo "Déclench. manuel: POST /webhook/manual"
echo "Health          : GET  http://localhost:18790/health"
echo ""
echo "Dans Slack, tape :"
echo "  → 'déploie client Agence X contact@agence-x.fr'"
echo "  → 'status déploiement'"
echo "─────────────────────────────────────────────────"
echo ""

# Garder le process actif + gestion SIGINT
trap "echo ''; echo 'Arrêt agent...'; kill $WEBHOOK_PID $CF_PID $OC_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
