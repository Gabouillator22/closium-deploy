import { google } from 'googleapis'
import { readFile } from 'fs/promises'

async function getAuth(credentials) {
  let keyFile
  if (typeof credentials === 'string') {
    keyFile = credentials
  } else if (credentials.service_account_path) {
    keyFile = credentials.service_account_path
  }
  const raw = await readFile(keyFile, 'utf-8')
  const key = JSON.parse(raw)
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/drive']
  })
  return auth
}

function driveClient(auth) {
  return google.drive({ version: 'v3', auth })
}

/**
 * Créer un dossier client dans Drive
 */
export async function createFolder(credentials, parentId, name) {
  const auth = await getAuth(credentials)
  const drive = driveClient(auth)
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    },
    fields: 'id, name'
  })
  return res.data
}

/**
 * Copier tous les fichiers d'un dossier source vers un dossier destination
 * Retourne { [nom_fichier]: nouveau_doc_id }
 */
export async function copyFolder(credentials, sourceFolderId, destFolderId) {
  const auth = await getAuth(credentials)
  const drive = driveClient(auth)

  const list = await drive.files.list({
    q: `'${sourceFolderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)'
  })

  const result = {}
  for (const file of list.data.files || []) {
    const copied = await drive.files.copy({
      fileId: file.id,
      requestBody: { name: file.name, parents: [destFolderId] },
      fields: 'id, name'
    })
    result[file.name] = copied.data.id
  }
  return result
}

/**
 * Partager un dossier avec une adresse email
 */
export async function shareFolder(credentials, folderId, email) {
  const auth = await getAuth(credentials)
  const drive = driveClient(auth)
  await drive.permissions.create({
    fileId: folderId,
    requestBody: { type: 'user', role: 'writer', emailAddress: email },
    sendNotificationEmail: false
  })
}

/**
 * Vérifier si un dossier existe déjà (idempotence)
 */
export async function folderExists(credentials, parentId, name) {
  const auth = await getAuth(credentials)
  const drive = driveClient(auth)
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)'
  })
  return res.data.files?.length > 0
}
