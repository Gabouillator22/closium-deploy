import { readFile, readdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BLUEPRINTS_DIR = join(__dirname, '..', 'blueprints')

/**
 * Remplace tous les {{PLACEHOLDER}} par les valeurs du config
 * @param {object} blueprint - Blueprint JSON (objet ou string)
 * @param {object} placeholders - Map { PLACEHOLDER_NAME: value }
 * @returns {object} Blueprint avec placeholders résolus
 */
export function replaceAll(blueprint, placeholders) {
  let str = typeof blueprint === 'string' ? blueprint : JSON.stringify(blueprint)
  for (const [key, value] of Object.entries(placeholders)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    str = str.replace(regex, value || '')
  }
  // Placeholders non résolus → chaîne vide
  str = str.replace(/\{\{[A-Z_]+\}\}/g, '')
  return JSON.parse(str)
}

/**
 * Valide qu'un blueprint ne contient plus de placeholders non résolus
 * @param {object} blueprint
 * @returns {{ valid: boolean, remaining: string[] }}
 */
export function validateResolved(blueprint) {
  const str = typeof blueprint === 'string' ? blueprint : JSON.stringify(blueprint)
  const matches = [...str.matchAll(/\{\{([A-Z_]+)\}\}/g)]
  const remaining = [...new Set(matches.map(m => m[1]))]
  return { valid: remaining.length === 0, remaining }
}

/**
 * Charge un blueprint depuis le dossier blueprints/
 * @param {string} name - Nom du fichier sans extension (ex: "A3_blueprint")
 * @returns {{ name: string, json: object }}
 */
export async function loadBlueprint(name) {
  const filePath = join(BLUEPRINTS_DIR, `${name}.json`)
  const raw = await readFile(filePath, 'utf-8')
  return { name, json: JSON.parse(raw) }
}

/**
 * Charge tous les blueprints disponibles dans le dossier blueprints/
 * @returns {Array<{ name: string, json: object }>}
 */
export async function loadAllBlueprints() {
  const files = await readdir(BLUEPRINTS_DIR)
  const jsonFiles = files.filter(f => f.endsWith('.json'))
  return Promise.all(jsonFiles.map(f => loadBlueprint(f.replace('.json', ''))))
}

/**
 * Charge et valide le fichier config client
 * @param {string} configPath
 * @returns {object}
 */
export async function loadConfig(configPath) {
  const raw = await readFile(configPath, 'utf-8')
  const config = JSON.parse(raw)
  const required = ['client', 'make', 'notion', 'google', 'tally', 'placeholders']
  for (const key of required) {
    if (!config[key]) throw new Error(`Config invalide : champ "${key}" manquant`)
  }
  if (!config.client.nom) throw new Error('Config invalide : client.nom manquant')
  if (!config.client.slug) throw new Error('Config invalide : client.slug manquant')
  if (!config.client.email) throw new Error('Config invalide : client.email manquant')
  return config
}
