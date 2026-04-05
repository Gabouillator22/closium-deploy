import axios from 'axios'

const RETRY_COUNT = 3

function baseUrl(zone) {
  return `https://${zone}.make.com/api/v2`
}

function headers(apiKey) {
  return { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' }
}

async function withRetry(fn) {
  let lastErr
  for (let i = 0; i < RETRY_COUNT; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (err.response?.status < 500) throw err
      await new Promise(r => setTimeout(r, 2 ** i * 500))
    }
  }
  throw lastErr
}

/**
 * Créer une équipe Make
 */
export async function createTeam(apiKey, teamName, zone = 'eu2') {
  return withRetry(async () => {
    const res = await axios.post(
      `${baseUrl(zone)}/teams`,
      { name: teamName },
      { headers: headers(apiKey) }
    )
    return res.data.team
  })
}

/**
 * Lister les scénarios d'une équipe
 */
export async function listScenarios(apiKey, teamId, zone = 'eu2') {
  return withRetry(async () => {
    const res = await axios.get(
      `${baseUrl(zone)}/scenarios?teamId=${teamId}`,
      { headers: headers(apiKey) }
    )
    return res.data.scenarios || []
  })
}

/**
 * Importer un blueprint comme scénario
 */
export async function importScenario(apiKey, teamId, blueprint, name, zone = 'eu2') {
  return withRetry(async () => {
    const res = await axios.post(
      `${baseUrl(zone)}/scenarios`,
      { teamId, name, blueprint: typeof blueprint === 'string' ? blueprint : JSON.stringify(blueprint) },
      { headers: headers(apiKey) }
    )
    return res.data.scenario
  })
}

/**
 * Activer un scénario
 */
export async function activateScenario(apiKey, scenarioId, zone = 'eu2') {
  return withRetry(async () => {
    const res = await axios.patch(
      `${baseUrl(zone)}/scenarios/${scenarioId}`,
      { isEnabled: true },
      { headers: headers(apiKey) }
    )
    return res.data.scenario
  })
}

/**
 * Vérifier si un scénario existe déjà (idempotence)
 */
export async function scenarioExists(apiKey, teamId, name, zone = 'eu2') {
  const scenarios = await listScenarios(apiKey, teamId, zone)
  return scenarios.some(s => s.name === name)
}
