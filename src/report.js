import chalk from 'chalk'
import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'

export class DeployReport {
  constructor(clientName) {
    this.clientName = clientName
    this.startedAt = new Date().toISOString()
    this.steps = []
    this.errors = []
    this.data = {}
  }

  addStep(name, status, data = {}) {
    this.steps.push({ name, status, data, ts: new Date().toISOString() })
    this.data[name] = data
  }

  addError(step, error) {
    this.errors.push({
      step,
      message: error.message || String(error),
      ts: new Date().toISOString()
    })
  }

  summary() {
    const ok = this.steps.filter(s => s.status === 'ok').length
    const total = this.steps.length + this.errors.length
    console.log('')
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    console.log(chalk.bold.cyan(`  Closium Deploy — Rapport : ${this.clientName}`))
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))

    for (const step of this.steps) {
      const icon = step.status === 'ok' ? chalk.green('✅') : chalk.yellow('⚠️')
      console.log(`  ${icon}  ${step.name}`)
      if (step.data && Object.keys(step.data).length > 0) {
        for (const [k, v] of Object.entries(step.data)) {
          console.log(chalk.gray(`       ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`))
        }
      }
    }

    for (const err of this.errors) {
      console.log(`  ${chalk.red('❌')}  ${err.step}: ${chalk.red(err.message)}`)
    }

    console.log('')
    console.log(chalk.bold(`  Résultat : ${ok}/${total} étapes réussies`))
    if (this.errors.length === 0) {
      console.log(chalk.bold.green('  🚀 Déploiement terminé avec succès'))
    } else {
      console.log(chalk.bold.yellow(`  ⚠️  ${this.errors.length} erreur(s) — vérifier les logs`))
    }
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    console.log('')
  }

  async save(outputPath) {
    const dir = dirname(outputPath)
    await mkdir(dir, { recursive: true })
    const report = {
      client: this.clientName,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      steps: this.steps,
      errors: this.errors,
      data: this.data
    }
    await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8')
    console.log(chalk.gray(`  📄 Rapport sauvegardé : ${outputPath}`))
    return outputPath
  }
}
