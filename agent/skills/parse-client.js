#!/usr/bin/env node
/**
 * Parse les données client depuis différentes sources :
 * - Stripe Payment Intent / Checkout Session
 * - Tally form submission
 * - Payload manuel
 * Génère le fichier config JSON pour closium-deploy
 */

import { writeFile } from 'fs/promises'
import { readFileSync } from 'fs'

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseStripePayload(payload) {
  const obj = payload.data?.object || {}
  const meta = obj.metadata || {}
  const nom = meta.client_nom || obj.customer_details?.name || obj.billing_details?.name || ''
  const email = meta.client_email || obj.customer_details?.email || obj.billing_details?.email || obj.receipt_email || ''
  return { nom, email, source: 'stripe', amount: obj.amount_total || obj.amount || 0 }
}

function parseTallyPayload(payload) {
  const fields = payload.data?.fields || []
  const get = (label) => fields.find(f =>
    f.label?.toLowerCase().includes(label.toLowerCase())
  )?.value || ''

  const nom = get('société') || get('company') || get('nom') || ''
  const email = get('email') || get('mail') || ''
  return { nom, email, source: 'tally' }
}

function parseManualPayload(payload) {
  return {
    nom: payload.client_nom || payload.nom || '',
    email: payload.client_email || payload.email || '',
    source: 'manual'
  }
}

async function main() {
  // Lire depuis stdin (OpenClaw pipe) ou variables d'env
  let raw = {}

  try {
    const stdin = readFileSync('/dev/stdin', 'utf-8').trim()
    if (stdin) raw = JSON.parse(stdin)
  } catch {
    // Fallback sur env vars
    raw = {
      client_nom: process.env.CLIENT_NOM || '',
      client_email: process.env.CLIENT_EMAIL || '',
      client_slug: process.env.CLIENT_SLUG || ''
    }
  }

  // Détection de la source
  let parsed
  if (raw.type?.startsWith('payment_intent') || raw.type?.startsWith('checkout.session')) {
    parsed = parseStripePayload(raw)
  } else if (raw.data?.fields || raw.formId) {
    parsed = parseTallyPayload(raw)
  } else {
    parsed = parseManualPayload(raw)
  }

  const slug = raw.client_slug || process.env.CLIENT_SLUG || slugify(parsed.nom)

  if (!parsed.nom || !parsed.email) {
    console.error(JSON.stringify({ error: 'nom et email requis', received: parsed }))
    process.exit(1)
  }

  // Charger le template de config
  const template = JSON.parse(readFileSync(
    new URL('../../config/client_example.json', import.meta.url),
    'utf-8'
  ))

  const config = {
    ...template,
    client: {
      nom: parsed.nom,
      slug,
      email: parsed.email
    },
    placeholders: {
      ...template.placeholders,
      TALLY_FORM_ID: process.env.TALLY_FORM_ID || template.tally?.form_id || 'jaWeWJ'
    },
    _meta: {
      source: parsed.source,
      generated_at: new Date().toISOString(),
      amount: parsed.amount || null
    }
  }

  // Écrire le fichier config temporaire
  const configPath = `/tmp/closium-${slug}.json`
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

  // Output pour OpenClaw (stdout = résultat du step)
  console.log(JSON.stringify({
    ok: true,
    nom: parsed.nom,
    email: parsed.email,
    slug,
    config_path: configPath,
    source: parsed.source
  }))
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }))
  process.exit(1)
})
