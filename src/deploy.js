import chalk from 'chalk'
import ora from 'ora'
import { loadConfig, loadAllBlueprints, replaceAll } from './templating.js'
import { DeployReport } from './report.js'
import * as drive from './drive.js'
import * as notion from './notion.js'
import * as make from './make.js'
import * as tally from './tally.js'

const TEMPLATE_NAMES = [
  'TEMPLATE_CONTRAT_PRESTATION_FORFAIT',
  'TEMPLATE_CONTRAT_PRESTATION_ACOMPTE',
  'TEMPLATE_CONTRAT_PRESTATION_JALONS',
  'TEMPLATE_CONTRAT_RETAINER_MENSUEL',
  'TEMPLATE_CONTRAT_RETAINER_ENGAGE',
  'TEMPLATE_CONTRAT_COMBO_SETUP_RETAINER',
  'TEMPLATE_CONTRAT_REGIE_TJM',
  'TEMPLATE_CONTRAT_GROWTH_PARTNER',
  'TEMPLATE_CONTRAT_AVENANT'
]

const TEMPLATE_CONTEXTES = {
  TEMPLATE_CONTRAT_PRESTATION_FORFAIT: 'Contrat forfaitaire B2B. Mission ponctuelle à périmètre défini. Obligation de moyens. Paiement unique ou acompte/solde.',
  TEMPLATE_CONTRAT_PRESTATION_ACOMPTE: 'Contrat forfaitaire B2B. Mission ponctuelle. Paiement en deux versements : acompte 50% à la commande, solde 50% à la livraison.',
  TEMPLATE_CONTRAT_PRESTATION_JALONS: 'Contrat forfaitaire B2B. Mission structurée en 3 phases avec jalons de paiement progressifs.',
  TEMPLATE_CONTRAT_RETAINER_MENSUEL: 'Contrat à exécution successive. Facturation mensuelle récurrente. Durée indéterminée avec préavis.',
  TEMPLATE_CONTRAT_RETAINER_ENGAGE: "Contrat récurrent avec durée minimum d'engagement et indemnité de sortie anticipée.",
  TEMPLATE_CONTRAT_COMBO_SETUP_RETAINER: 'Contrat en deux phases : implémentation forfaitaire (Phase 1) puis accès mensuel récurrent (Phase 2).',
  TEMPLATE_CONTRAT_REGIE_TJM: "Contrat en régie. Facturation au temps passé selon taux journalier. Compte-rendu d'activité mensuel.",
  TEMPLATE_CONTRAT_GROWTH_PARTNER: 'Contrat de partenariat. Rémunération hybride : fixe mensuel + variable indexé sur la croissance du CA.',
  TEMPLATE_CONTRAT_AVENANT: 'Avenant modificatif. Modifie un contrat parent existant. Périmètre, tarif ou calendrier révisé.'
}

export async function deployClient(configPath, options = {}) {
  const { dryRun = false, stepOnly = null } = options
  const config = await loadConfig(configPath)
  const report = new DeployReport(config.client.nom)

  console.log(chalk.bold.cyan(`\n🚀 Closium Deploy — ${config.client.nom}\n`))
  if (dryRun) console.log(chalk.yellow('  ⚠️  Mode dry-run activé — aucune action réelle\n'))

  // ÉTAPE 1 — Google Drive
  if (!stepOnly || stepOnly === 'drive') {
    const spinner = ora('Google Drive — Création du dossier client...').start()
    try {
      if (!dryRun) {
        const exists = await drive.folderExists(config.google, config.google.master_templates_folder_id, config.client.slug)
        if (!exists) {
          const folder = await drive.createFolder(config.google, config.google.master_templates_folder_id, config.client.nom)
          config.placeholders.GOOGLE_DRIVE_FOLDER_ID = folder.id
          const templates = await drive.copyFolder(config.google, config.google.master_templates_folder_id, folder.id)
          await drive.shareFolder(config.google, folder.id, config.client.email)
          report.addStep('drive', 'ok', { folderId: folder.id, templates })
        } else {
          report.addStep('drive', 'ok', { note: 'Dossier existant — ignoré (idempotent)' })
        }
      } else {
        report.addStep('drive', 'ok', { note: 'dry-run' })
      }
      spinner.succeed('Google Drive ✅')
    } catch (err) {
      spinner.fail('Google Drive ❌')
      report.addError('drive', err)
    }
  }

  // ÉTAPE 2 — Notion
  if (!stepOnly || stepOnly === 'notion') {
    const spinner = ora('Notion — Duplication du portail...').start()
    try {
      if (!dryRun) {
        const exists = await notion.pageExists(config.notion.token, config.notion.master_portal_id, config.client.slug)
        if (!exists) {
          const portal = await notion.duplicatePage(config.notion.token, config.notion.master_portal_id, config.client.nom)
          config.placeholders.NOTION_DB_CLIENT_ID = portal.id

          for (const name of TEMPLATE_NAMES) {
            const docId = report.data?.drive?.templates?.[name] || ''
            const tallyUrl = tally.buildTallyUrl(config.tally.form_id, {
              notion_page_id: portal.id,
              template_id: docId
            })
            await notion.createTemplateEntry(config.notion.token, config.notion.master_gallerie_id, {
              nom: name,
              doc_template_id: docId,
              contexte: TEMPLATE_CONTEXTES[name],
              tally_url: tallyUrl,
              page_id: portal.id
            })
          }
          report.addStep('notion', 'ok', { portalId: portal.id, portalUrl: portal.url })
        } else {
          report.addStep('notion', 'ok', { note: 'Portail existant — ignoré (idempotent)' })
        }
      } else {
        report.addStep('notion', 'ok', { note: 'dry-run' })
      }
      spinner.succeed('Notion ✅')
    } catch (err) {
      spinner.fail('Notion ❌')
      report.addError('notion', err)
    }
  }

  // ÉTAPE 3 — Make
  if (!stepOnly || stepOnly === 'make') {
    const spinner = ora('Make — Import des scénarios...').start()
    try {
      if (!dryRun) {
        let teamId = config.make.team_id
        if (!teamId) {
          const team = await make.createTeam(config.make.api_key, config.client.nom, config.make.zone)
          teamId = team.id
        }
        const blueprints = await loadAllBlueprints()
        const results = []
        for (const bp of blueprints) {
          const exists = await make.scenarioExists(config.make.api_key, teamId, bp.name, config.make.zone)
          if (!exists) {
            const configured = replaceAll(bp.json, config.placeholders)
            const scenario = await make.importScenario(config.make.api_key, teamId, configured, bp.name, config.make.zone)
            results.push(scenario)
          }
        }
        report.addStep('make', 'ok', { teamId, scenarios: results.length })
      } else {
        report.addStep('make', 'ok', { note: 'dry-run' })
      }
      spinner.succeed('Make ✅')
    } catch (err) {
      spinner.fail('Make ❌')
      report.addError('make', err)
    }
  }

  // Rapport final
  report.summary()
  const reportPath = `./reports/${config.client.slug}_${Date.now()}.json`
  await report.save(reportPath)

  return report
}
