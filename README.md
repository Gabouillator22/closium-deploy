# closium-deploy

CLI de déploiement automatisé Closium OS — onboarding client en < 5 minutes.

## Installation

```bash
git clone https://github.com/Gabouillator22/closium-deploy
cd closium-deploy
npm install
```

## Usage

```bash
# Déploiement complet
node deploy.js deploy --config ./config/mon_client.json

# Dry-run (simulation)
node deploy.js deploy --config ./config/mon_client.json --dry-run

# Relancer uniquement une étape
node deploy.js deploy --config ./config/mon_client.json --step notion
node deploy.js deploy --config ./config/mon_client.json --step drive
node deploy.js deploy --config ./config/mon_client.json --step make
```

## Prérequis

- Node.js 18+
- Accès Make API du client (`api_key`)
- Token Notion du client
- Google Service Account avec accès Drive

## Structure du projet

```
closium-deploy/
├── deploy.js                  ← entrypoint CLI
├── config/
│   ├── client_schema.json     ← schéma de validation
│   └── client_example.json    ← exemple à copier
├── blueprints/                ← blueprints Make JSON (à déposer ici)
├── src/
│   ├── templating.js          ← moteur de remplacement des placeholders
│   ├── make.js                ← client Make REST API
│   ├── notion.js              ← client Notion API
│   ├── drive.js               ← client Google Drive API
│   ├── tally.js               ← génération d'URLs Tally
│   ├── report.js              ← rapport de déploiement
│   └── deploy.js              ← orchestrateur principal
├── test/
│   └── deploy.test.js
└── reports/                   ← rapports JSON générés automatiquement
```

## Ajouter des blueprints Make

1. Exporter un scénario depuis Make (menu ⋮ → Export Blueprint)
2. Remplacer les IDs hardcodés par des `{{PLACEHOLDER_NAME}}`
3. Déposer dans `blueprints/`

Placeholders disponibles : `{{NOTION_DB_CLIENT_ID}}`, `{{GOOGLE_DRIVE_FOLDER_ID}}`, `{{TALLY_FORM_ID}}`, `{{SLACK_CHANNEL_ID}}`, `{{WEBHOOK_URL}}`

## Développement

```bash
npm test     # Tests Jest
npm run lint # ESLint
```
