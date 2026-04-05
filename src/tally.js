/**
 * Générer l'URL d'un formulaire Tally avec les paramètres hidden fields
 * @param {string} formId
 * @param {object} params - { notion_page_id, client_id, template_id, ... }
 * @returns {string}
 */
export function buildTallyUrl(formId, params = {}) {
  const base = `https://tally.so/r/${formId}`
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (entries.length === 0) return base
  const query = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return `${base}?${query}`
}

/**
 * Construire les URLs pour tous les templates d'un client
 * @param {string} formId
 * @param {Array<{ name: string, doc_id: string, page_id: string }>} templates
 * @returns {object} { [template_name]: url }
 */
export function buildAllTemplateUrls(formId, templates) {
  const result = {}
  for (const template of templates) {
    result[template.name] = buildTallyUrl(formId, {
      notion_page_id: template.page_id,
      template_id: template.doc_id
    })
  }
  return result
}
