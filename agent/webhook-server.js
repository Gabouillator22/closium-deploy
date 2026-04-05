/**
 * Closium OS — Webhook Server
 * Reçoit Stripe + Tally, déclenche OpenClaw automatiquement.
 * Port 18790 (OpenClaw Gateway = 18789)
 */

import express from 'express'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const exec = promisify(execFile)
const app = express()
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.raw({ type: '*/*', limit: '10mb' })) // raw pour vérif signature Stripe

// ── Helpers ─────────────────────────────────────────────────────────────────
function verifyStripeSignature(rawBody, signature, secret) {
  const elements = signature.split(',')
  const timestamp = elements.find(e => e.startsWith('t=')).slice(2)
  const sig = elements.find(e => e.startsWith('v1=')).slice(3)
  const payload = `${timestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}

function slugify(str) {
  return str.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function runDeploy(clientData) {
  const slug = slugify(clientData.nom)
  const configPath = `/tmp/closium-${slug}-${Date.now()}.json`

  // Charger template config
  const { default: template } = await import(`${ROOT}/config/client_example.json`, {
    assert: { type: 'json' }
  })

  const config = {
    ...template,
    client: { nom: clientData.nom, slug, email: clientData.email },
    placeholders: {
      ...template.placeholders,
      TALLY_FORM_ID: process.env.TALLY_FORM_ID || 'jaWeWJ'
    }
  }

  await writeFile(configPath, JSON.stringify(config, null, 2))

  // Lancer closium-deploy
  const start = Date.now()
  const { stdout, stderr } = await exec('node', [
    join(ROOT, 'deploy.js'), 'deploy',
    '--config', configPath
  ], {
    timeout: 300_000,
    env: { ...process.env, NODE_ENV: 'production' }
  })

  return {
    slug,
    duration: Math.round((Date.now() - start) / 1000),
    stdout: stdout.slice(-500),
    stderr: stderr.slice(-200)
  }
}

async function notifySlack(message) {
  if (!process.env.SLACK_WEBHOOK_URL) return
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message })
  })
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

// Stripe webhook
app.post('/webhook/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature']
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (secret) {
    try {
      verifyStripeSignature(req.body.toString(), sig, secret)
    } catch {
      return res.status(400).json({ error: 'Invalid signature' })
    }
  }

  const event = JSON.parse(req.body.toString())

  // On ne traite que les paiements confirmés
  const TRIGGER_EVENTS = [
    'payment_intent.succeeded',
    'checkout.session.completed',
    'invoice.payment_succeeded'
  ]
  if (!TRIGGER_EVENTS.includes(event.type)) {
    return res.json({ ok: true, skipped: event.type })
  }

  const obj = event.data?.object || {}
  const meta = obj.metadata || {}
  const clientData = {
    nom: meta.client_nom || obj.customer_details?.name || obj.billing_details?.name || 'Client',
    email: meta.client_email || obj.customer_details?.email || obj.billing_details?.email || obj.receipt_email || '',
    source: 'stripe',
    amount: obj.amount_total || obj.amount || 0
  }

  if (!clientData.email) return res.status(400).json({ error: 'email manquant dans payload Stripe' })

  res.json({ ok: true, message: 'Déploiement lancé', client: clientData.nom })

  // Deploy en arrière-plan
  runDeploy(clientData)
    .then(result => notifySlack(`✅ *Closium OS déployé — ${clientData.nom}*\n📧 ${clientData.email}\n⏱ ${result.duration}s`))
    .catch(err => notifySlack(`❌ *Échec déploiement — ${clientData.nom}*\n${err.message}`))
})

// Tally webhook
app.post('/webhook/tally', async (req, res) => {
  const body = JSON.parse(req.body.toString())
  const fields = body.data?.fields || []

  const get = (...labels) => {
    for (const label of labels) {
      const f = fields.find(f => f.label?.toLowerCase().includes(label.toLowerCase()))
      if (f?.value) return String(f.value)
    }
    return ''
  }

  const clientData = {
    nom: get('société', 'company', 'entreprise', 'raison sociale') || get('nom'),
    email: get('email', 'mail', 'e-mail'),
    source: 'tally'
  }

  if (!clientData.nom || !clientData.email) {
    return res.status(400).json({ error: 'nom/email manquants dans payload Tally', fields: fields.map(f => f.label) })
  }

  res.json({ ok: true, message: 'Déploiement lancé', client: clientData.nom })

  runDeploy(clientData)
    .then(result => notifySlack(`✅ *Closium OS déployé — ${clientData.nom}*\n📧 ${clientData.email}\n⏱ ${result.duration}s`))
    .catch(err => notifySlack(`❌ *Échec déploiement — ${clientData.nom}*\n${err.message}`))
})

// Déclenchement manuel (OpenClaw → POST JSON)
app.post('/webhook/manual', express.json(), async (req, res) => {
  const { nom, email, slug } = req.body
  if (!nom || !email) return res.status(400).json({ error: 'nom et email requis' })

  res.json({ ok: true, message: 'Déploiement lancé', client: nom })

  runDeploy({ nom, email, slug, source: 'manual' })
    .then(result => notifySlack(`✅ *Closium OS déployé — ${nom}*\n📧 ${email}\n⏱ ${result.duration}s`))
    .catch(err => notifySlack(`❌ *Échec déploiement — ${nom}*\n${err.message}`))
})

const PORT = process.env.WEBHOOK_PORT || 18790
app.listen(PORT, () => {
  console.log(`✅ Closium Webhook Server → http://localhost:${PORT}`)
  console.log(`   POST /webhook/stripe  — Stripe payment events`)
  console.log(`   POST /webhook/tally   — Tally form submissions`)
  console.log(`   POST /webhook/manual  — Déclenchement manuel`)
  console.log(`   GET  /health          — Health check`)
})
