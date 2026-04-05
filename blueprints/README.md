# Blueprints Make

Déposer ici les blueprints JSON exportés depuis Make.com.

## Convention de nommage

```
A1_blueprint.json  — Stripe → Tally → Google Docs → DocuSign → Notion
A2_blueprint.json  — DocuSign signé → Notion update → Email accès client
A3_blueprint.json  — Générateur templates → Google Doc depuis bouton Notion
A4_blueprint.json  — Slack notifications temps réel
```

## Placeholders à remplacer

Avant de déposer un blueprint, remplacer tous les IDs hardcodés par les placeholders suivants :

| Placeholder              | Description                          |
|--------------------------|--------------------------------------|
| `{{NOTION_DB_CLIENT_ID}}`  | ID de la database Notion du client   |
| `{{GOOGLE_DRIVE_FOLDER_ID}}` | ID du dossier Drive client         |
| `{{TALLY_FORM_ID}}`        | ID du formulaire Tally              |
| `{{SLACK_CHANNEL_ID}}`     | ID du canal Slack client            |
| `{{WEBHOOK_URL}}`          | URL du webhook entrant              |

## Export depuis Make

1. Ouvrir le scénario dans Make
2. Menu (⋮) → Export Blueprint
3. Sauvegarder le JSON dans ce dossier
4. Remplacer les IDs par les placeholders ci-dessus
