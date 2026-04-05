import { Client } from '@notionhq/client'

function client(token) {
  return new Client({ auth: token })
}

/**
 * Dupliquer une page Notion vers un nouveau portail client
 */
export async function duplicatePage(token, sourcePageId, newTitle) {
  const notion = client(token)
  const source = await notion.pages.retrieve({ page_id: sourcePageId })
  const parentId = source.parent?.page_id || source.parent?.database_id

  const created = await notion.pages.create({
    parent: source.parent,
    icon: source.icon || undefined,
    cover: source.cover || undefined,
    properties: {
      ...source.properties,
      title: {
        title: [{ type: 'text', text: { content: newTitle } }]
      }
    }
  })
  return { id: created.id, url: created.url }
}

/**
 * Mettre à jour les propriétés d'une page de database
 */
export async function updatePageProperties(token, pageId, properties) {
  const notion = client(token)
  const res = await notion.pages.update({ page_id: pageId, properties })
  return res
}

/**
 * Créer une entrée dans la Gallerie Template
 */
export async function createTemplateEntry(token, dbId, data) {
  const notion = client(token)
  const res = await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      Name: { title: [{ text: { content: data.nom } }] },
      doc_template_id: { rich_text: [{ text: { content: data.doc_template_id || '' } }] },
      contexte: { rich_text: [{ text: { content: data.contexte || '' } }] },
      tally_url: { url: data.tally_url || null },
      page_id: { rich_text: [{ text: { content: data.page_id || '' } }] }
    }
  })
  return res
}

/**
 * Créer la fiche client dans la database Closium
 */
export async function createClientPage(token, dbId, clientData) {
  const notion = client(token)
  const res = await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      Name: { title: [{ text: { content: clientData.nom } }] },
      Email: { email: clientData.email },
      Slug: { rich_text: [{ text: { content: clientData.slug } }] }
    }
  })
  return res
}

/**
 * Vérifier si une page existe déjà (idempotence par slug)
 */
export async function pageExists(token, dbId, slug) {
  const notion = client(token)
  const res = await notion.databases.query({
    database_id: dbId,
    filter: {
      property: 'Slug',
      rich_text: { equals: slug }
    }
  })
  return res.results.length > 0
}
