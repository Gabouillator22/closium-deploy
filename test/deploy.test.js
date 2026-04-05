import { jest } from '@jest/globals'

// Mock fs/promises before importing modules
jest.unstable_mockModule('fs/promises', () => ({
  readFile: jest.fn(),
  readdir: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn()
}))

const { readFile, readdir } = await import('fs/promises')
const { replaceAll, validateResolved, loadConfig } = await import('../src/templating.js')
const { buildTallyUrl, buildAllTemplateUrls } = await import('../src/tally.js')
const { DeployReport } = await import('../src/report.js')

// ─── replaceAll ───────────────────────────────────────────────────────────────

describe('replaceAll', () => {
  it('remplace un placeholder simple', () => {
    const bp = { flow: [{ id: '{{NOTION_DB_CLIENT_ID}}' }] }
    const result = replaceAll(bp, { NOTION_DB_CLIENT_ID: 'abc-123' })
    expect(result.flow[0].id).toBe('abc-123')
  })

  it('remplace plusieurs placeholders dans le même objet', () => {
    const bp = { a: '{{FOO}}', b: '{{BAR}}', c: 'static' }
    const result = replaceAll(bp, { FOO: 'hello', BAR: 'world' })
    expect(result).toEqual({ a: 'hello', b: 'world', c: 'static' })
  })

  it('remplace les occurrences multiples du même placeholder', () => {
    const bp = { x: '{{ID}}', y: '{{ID}}' }
    const result = replaceAll(bp, { ID: '42' })
    expect(result.x).toBe('42')
    expect(result.y).toBe('42')
  })

  it('accepte un blueprint en string', () => {
    const bp = JSON.stringify({ val: '{{TOKEN}}' })
    const result = replaceAll(bp, { TOKEN: 'secret' })
    expect(result.val).toBe('secret')
  })

  it('placeholder non présent dans la map → remplacé par chaîne vide', () => {
    const bp = { x: '{{MISSING}}' }
    const result = replaceAll(bp, {})
    expect(result.x).toBe('')
  })
})

// ─── validateResolved ─────────────────────────────────────────────────────────

describe('validateResolved', () => {
  it('retourne valid:true quand aucun placeholder restant', () => {
    const bp = { a: 'ok', b: 'resolved' }
    expect(validateResolved(bp)).toEqual({ valid: true, remaining: [] })
  })

  it('détecte un placeholder non résolu', () => {
    const bp = { a: '{{STILL_HERE}}' }
    const res = validateResolved(bp)
    expect(res.valid).toBe(false)
    expect(res.remaining).toContain('STILL_HERE')
  })

  it('déduplique les placeholders restants', () => {
    const bp = { a: '{{X}}', b: '{{X}}', c: '{{Y}}' }
    const res = validateResolved(bp)
    expect(res.remaining).toHaveLength(2)
    expect(res.remaining).toContain('X')
    expect(res.remaining).toContain('Y')
  })
})

// ─── buildTallyUrl ────────────────────────────────────────────────────────────

describe('buildTallyUrl', () => {
  it('génère une URL de base sans params', () => {
    expect(buildTallyUrl('jaWeWJ')).toBe('https://tally.so/r/jaWeWJ')
  })

  it('ajoute les paramètres en query string', () => {
    const url = buildTallyUrl('jaWeWJ', { notion_page_id: 'abc', template_id: 'xyz' })
    expect(url).toContain('notion_page_id=abc')
    expect(url).toContain('template_id=xyz')
    expect(url).toMatch(/^https:\/\/tally\.so\/r\/jaWeWJ\?/)
  })

  it('encode les caractères spéciaux dans les valeurs', () => {
    const url = buildTallyUrl('form', { name: 'hello world' })
    expect(url).toContain('name=hello%20world')
  })

  it('ignore les valeurs null/undefined/vides', () => {
    const url = buildTallyUrl('form', { a: 'ok', b: null, c: undefined, d: '' })
    expect(url).toContain('a=ok')
    expect(url).not.toContain('b=')
    expect(url).not.toContain('c=')
    expect(url).not.toContain('d=')
  })
})

// ─── buildAllTemplateUrls ─────────────────────────────────────────────────────

describe('buildAllTemplateUrls', () => {
  it('retourne un objet avec une URL par template', () => {
    const templates = [
      { name: 'TEMPLATE_A', doc_id: 'doc1', page_id: 'page1' },
      { name: 'TEMPLATE_B', doc_id: 'doc2', page_id: 'page2' }
    ]
    const result = buildAllTemplateUrls('jaWeWJ', templates)
    expect(result).toHaveProperty('TEMPLATE_A')
    expect(result).toHaveProperty('TEMPLATE_B')
    expect(result.TEMPLATE_A).toContain('template_id=doc1')
  })
})

// ─── loadConfig ───────────────────────────────────────────────────────────────

describe('loadConfig', () => {
  const validConfig = {
    client: { nom: 'Test', slug: 'test', email: 'test@example.com' },
    make: { api_key: 'key', zone: 'eu2', team_id: null },
    notion: { token: 'tok', master_portal_id: 'p1', master_gallerie_id: 'g1' },
    google: { service_account_path: './creds.json', master_templates_folder_id: 'f1' },
    tally: { form_id: 'abc' },
    placeholders: {}
  }

  it('charge un config valide', async () => {
    readFile.mockResolvedValueOnce(JSON.stringify(validConfig))
    const config = await loadConfig('./config/test.json')
    expect(config.client.nom).toBe('Test')
  })

  it('lève une erreur si un champ requis est manquant', async () => {
    const bad = { ...validConfig }
    delete bad.make
    readFile.mockResolvedValueOnce(JSON.stringify(bad))
    await expect(loadConfig('./config/bad.json')).rejects.toThrow('make')
  })

  it('lève une erreur si client.slug est manquant', async () => {
    const bad = { ...validConfig, client: { nom: 'Test', email: 'x@y.com' } }
    readFile.mockResolvedValueOnce(JSON.stringify(bad))
    await expect(loadConfig('./config/bad.json')).rejects.toThrow('slug')
  })
})

// ─── DeployReport ─────────────────────────────────────────────────────────────

describe('DeployReport', () => {
  it('addStep enregistre une étape', () => {
    const r = new DeployReport('TestClient')
    r.addStep('drive', 'ok', { folderId: 'xyz' })
    expect(r.steps).toHaveLength(1)
    expect(r.steps[0].name).toBe('drive')
    expect(r.steps[0].data.folderId).toBe('xyz')
  })

  it('addError enregistre une erreur', () => {
    const r = new DeployReport('TestClient')
    r.addError('notion', new Error('404 Not Found'))
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0].step).toBe('notion')
    expect(r.errors[0].message).toContain('404')
  })

  it('data stocke les données par étape', () => {
    const r = new DeployReport('TestClient')
    r.addStep('make', 'ok', { teamId: 123, scenarios: 4 })
    expect(r.data.make.teamId).toBe(123)
  })

  it('save écrit le rapport JSON', async () => {
    const { writeFile, mkdir } = await import('fs/promises')
    writeFile.mockResolvedValueOnce()
    mkdir.mockResolvedValueOnce()
    const r = new DeployReport('TestClient')
    r.addStep('drive', 'ok', {})
    await r.save('./reports/test_1234.json')
    expect(writeFile).toHaveBeenCalled()
    const [path, content] = writeFile.mock.calls[0]
    expect(path).toBe('./reports/test_1234.json')
    const parsed = JSON.parse(content)
    expect(parsed.client).toBe('TestClient')
    expect(parsed.steps).toHaveLength(1)
  })
})
