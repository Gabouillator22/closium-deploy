# Closium OS — Architecture & Contexte

## Vision produit

Closium OS est un système d'automatisation B2B clé en main vendu et installé chez des agences, freelances et prestataires de services (cible : 10-50k€/mois de CA). Modèle commercial : 1 client/jour = 40k€/mois. Installation en moins de 3h, onboarding entièrement automatisé via `closium-deploy`.

---

## Stack technique

| Outil | Rôle |
|---|---|
| **Make.com** | Orchestration des automatisations (scénarios A1-A4) |
| **Notion** | Base de données client, Gallerie Template, Portail Client |
| **Google Drive / Docs** | Stockage et génération des contrats |
| **Tally** | Formulaire de déclenchement de génération de document |
| **Claude API (Haiku)** | Rédaction juridique contextuelle dans Make (module natif) |
| **Slack** | Notifications temps réel |
| **DocuSign** | Signature électronique des contrats |
| **Stripe** | Paiement et déclenchement onboarding |
| **closium-deploy** | CLI Node.js d'onboarding automatisé (ce repo) |

---

## Les 9 templates de contrat

Nomenclature : `TEMPLATE_CONTRAT_[TYPE]_[MODALITE]`

| Nom | Description |
|---|---|
| `TEMPLATE_CONTRAT_PRESTATION_FORFAIT` | Mission ponctuelle forfaitaire, périmètre défini, paiement unique |
| `TEMPLATE_CONTRAT_PRESTATION_ACOMPTE` | Forfait avec paiement en 2 temps : 50% commande / 50% livraison |
| `TEMPLATE_CONTRAT_PRESTATION_JALONS` | Forfait structuré en 3 phases avec jalons de paiement progressifs |
| `TEMPLATE_CONTRAT_RETAINER_MENSUEL` | Facturation mensuelle récurrente, durée indéterminée avec préavis |
| `TEMPLATE_CONTRAT_RETAINER_ENGAGE` | Récurrent avec durée minimum d'engagement et indemnité de sortie |
| `TEMPLATE_CONTRAT_COMBO_SETUP_RETAINER` | Phase 1 implémentation forfaitaire + Phase 2 abonnement mensuel |
| `TEMPLATE_CONTRAT_REGIE_TJM` | Régie au TJM, facturation au temps passé, CRA mensuel |
| `TEMPLATE_CONTRAT_GROWTH_PARTNER` | Partenariat : fixe mensuel + variable indexé sur croissance CA |
| `TEMPLATE_CONTRAT_AVENANT` | Avenant modificatif d'un contrat parent (périmètre, tarif, calendrier) |

---

## Système de balises dans les templates Google Docs

### Balises `{{P_*}}` — orange (prestataire)
Injectées automatiquement à l'onboarding client via `closium-deploy`. Valeur fixe pour toute la durée du contrat.

| Balise | Signification |
|---|---|
| `{{P_NOM_SOCIETE}}` | Raison sociale du prestataire |
| `{{P_SIRET}}` | SIRET du prestataire |
| `{{P_ADRESSE}}` | Adresse complète du prestataire |
| `{{P_CODE_POSTAL}}` | Code postal du prestataire |
| `{{P_VILLE}}` | Ville du prestataire |
| `{{P_NOM_SIGNATAIRE}}` | Nom du signataire prestataire |
| `{{P_EMAIL}}` | Email professionnel du prestataire |
| `{{P_TELEPHONE}}` | Téléphone du prestataire |
| `{{P_IBAN}}` | IBAN pour paiement |
| `{{P_FORME_JURIDIQUE}}` | SAS, SARL, auto-entrepreneur... |
| `{{P_CAPITAL}}` | Capital social |
| `{{P_RCS}}` | Numéro RCS |

### Balises `{{C_*}}` — noir (client final)
Conservées dans les templates, remplies lors de chaque génération de document via le formulaire Tally + Claude Haiku.

---

## Architecture Notion

```
Workspace Closium
├── Gallerie Template          ← database des 9 templates par client
│   ├── Nom (title)
│   ├── doc_template_id        ← ID Google Doc template
│   ├── contexte               ← description pour Claude
│   ├── tally_url              ← URL Tally avec hidden fields
│   └── page_id                ← ID du portail client Notion
│
├── Portail Client [dupliqué par client]
│   ├── Vue Kanban des contrats
│   ├── Boutons de génération
│   └── Lien vers Gallerie
│
├── Infos Société Client       ← rempli une fois à l'onboarding
│   └── Balises {{P_*}}
│
└── Database Clients Closium   ← fiche par client Gabriel
    ├── Nom, Email, Slug
    ├── NOTION_DB_CLIENT_ID
    └── GOOGLE_DRIVE_FOLDER_ID
```

---

## Workflow Make A3 — Générateur de contrat

```
Tally (webhook)
  ↓
Notion — Get Page (récupérer infos société prestataire)
  ↓
Set Variables (rassembler les données du formulaire)
  ↓
Claude Haiku (natif Make) — Rédaction juridique contextuelle
  ↓
Parse JSON (extraire description_livrables + modalite_paiement)
  ↓
Google Docs — createADocumentFromTemplate (copie du template)
  ↓
Google Docs — replaceText (injection des variables {{C_*}})
  ↓
Notion — Update Page (lien du doc généré)
  ↓
Slack — Message (notification temps réel)
```

---

## Les 5 IDs variables par client

Ces 5 placeholders sont différents pour chaque client et injectés automatiquement par `closium-deploy` :

| Placeholder | Source | Description |
|---|---|---|
| `{{NOTION_DB_CLIENT_ID}}` | Généré à l'onboarding | ID du portail Notion dupliqué |
| `{{GOOGLE_DRIVE_FOLDER_ID}}` | Généré à l'onboarding | ID du dossier Drive client |
| `{{TALLY_FORM_ID}}` | Fourni dans config | ID du formulaire Tally client |
| `{{SLACK_CHANNEL_ID}}` | Fourni dans config | ID du canal Slack client |
| `{{WEBHOOK_URL}}` | Fourni dans config | URL webhook Make du scénario A3 |

---

## Connexions OAuth Make requises (1-3 clics client)

1. **Google** — connexion OAuth → accès Drive + Docs + Gmail
2. **Notion** — connexion OAuth → accès workspace
3. **Slack** — connexion OAuth → accès canal de notification

Ces connexions sont configurées une fois dans Make par le client. `closium-deploy` importe les scénarios avec des références de connexion symboliques que le client relie à ses credentials.

---

## Process d'onboarding client (3h)

```
0:00 — Remplir config/client_[slug].json
0:05 — node deploy.js deploy --config ./config/client_[slug].json --dry-run
0:10 — Vérifier le rapport dry-run
0:15 — node deploy.js deploy --config ./config/client_[slug].json
0:30 — Partager credentials Google Service Account
0:45 — Client connecte ses OAuth dans Make (Google + Notion + Slack)
1:00 — Test complet end-to-end : remplir Tally → vérifier Google Doc généré
1:30 — Ajuster les templates Google Docs si nécessaire
2:00 — Formation client (30 min) : utilisation Notion + Tally + templates
2:30 — Livraison + accès
3:00 — ✅ Client opérationnel
```

---

## Utiliser closium-deploy

### Installation

```bash
git clone https://github.com/Gabouillator22/closium-deploy
cd closium-deploy
npm install
```

### Configuration

```bash
cp config/client_example.json config/client_[slug].json
# Remplir les clés API, tokens, IDs
```

### Commandes

```bash
# Déploiement complet
node deploy.js deploy --config ./config/mon_client.json

# Dry-run (simulation sans actions réelles)
node deploy.js deploy --config ./config/mon_client.json --dry-run

# Relancer uniquement une étape
node deploy.js deploy --config ./config/mon_client.json --step notion
node deploy.js deploy --config ./config/mon_client.json --step drive
node deploy.js deploy --config ./config/mon_client.json --step make
```

### Ajouter des blueprints Make

1. Exporter le scénario depuis Make (menu ⋮ → Export Blueprint)
2. Remplacer les IDs hardcodés par les `{{PLACEHOLDERS}}` (cf. `blueprints/README.md`)
3. Déposer le JSON dans `blueprints/`

---

## Gestion des tokens / modèles Claude

- **Haiku** (`claude-haiku-4-5-20251001`) : utilisé dans Make A3 pour la rédaction juridique — optimisé coût/vitesse
- **Sonnet** (`claude-sonnet-4-6`) : debug, génération blueprints, analyse
- **Opus** (`claude-opus-4-6`) : architecture complexe, décisions critiques
