#!/usr/bin/env node
import { program } from 'commander'
import { deployClient } from './src/deploy.js'

program
  .name('closium-deploy')
  .description('CLI de déploiement automatisé Closium OS')
  .version('0.1.0')

program
  .command('deploy')
  .description('Déployer un nouveau client Closium')
  .requiredOption('-c, --config <path>', 'Chemin vers le fichier config client JSON')
  .option('--dry-run', "Simuler sans exécuter d'actions réelles")
  .option('--step <name>', 'Relancer uniquement une étape (drive|notion|make)')
  .action(async (options) => {
    try {
      await deployClient(options.config, {
        dryRun: options.dryRun || false,
        stepOnly: options.step || null
      })
    } catch (err) {
      console.error(`\n❌ Erreur fatale : ${err.message}`)
      process.exit(1)
    }
  })

program.parse()
