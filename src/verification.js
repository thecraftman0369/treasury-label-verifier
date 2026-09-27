export const FIELD_DEFS = [
  ['brandName', 'Brand name'],
  ['classType', 'Class or type'],
  ['netContents', 'Net contents'],
  ['responsibleParty', 'Responsible party'],
  ['address', 'Address'],
  ['role', 'Role'],
  ['countryOfOrigin', 'Country of origin'],
  ['governmentWarning', 'Government warning'],
]

export const DEFAULT_WARNING = 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'

export function normalizeText(value = '') {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function normalizeWarning(value = '') {
  return value.replace(/\s+/g, ' ').trim()
}

const units = { ml: 1, milliliter: 1, milliliters: 1, l: 1000, liter: 1000, liters: 1000, cl: 10, oz: 29.5735, floz: 29.5735 }

export function parseVolume(value = '') {
  const cleaned = value.toLowerCase().replace(/fluid\s*ounces?/g, 'oz').replace(/fl\.?\s*oz\.?/g, 'floz')
  const match = cleaned.match(/(\d*\.?\d+)\s*(ml|milliliters?|l|liters?|cl|oz|floz)\b/)
  if (!match) return null
  const unit = match[2].replace(/s$/, '')
  return Number(match[1]) * (units[unit] || units[match[2]])
}

export function similarity(a = '', b = '') {
  a = normalizeText(a); b = normalizeText(b)
  if (!a || !b) return 0
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return 1 - rows[a.length][b.length] / Math.max(a.length, b.length)
}

function bestLine(raw, expected) {
  const lines = raw.split(/\n+/).map(x => x.trim()).filter(Boolean)
  return lines.sort((a, b) => similarity(b, expected) - similarity(a, expected))[0] || ''
}

export function verifyField(key, expected, rawText, options = {}) {
  if ((key === 'role' && !expected) || (key === 'countryOfOrigin' && !options.isImport)) return { state: 'review', reason: 'Not applicable', extracted: '' }
  if (!expected.trim()) return { state: 'review', reason: 'Reference value is missing', extracted: '' }
  if (!rawText.trim()) return { state: 'review', reason: 'Label text is unreadable or missing', extracted: '' }
  if (key === 'governmentWarning') {
    const compactRaw = normalizeWarning(rawText)
    const exact = compactRaw.includes(normalizeWarning(expected))
    if (!exact) return { state: compactRaw.toLowerCase().includes('government warning') ? 'error' : 'review', reason: compactRaw.toLowerCase().includes('government warning') ? 'Warning text does not match exactly' : 'Warning could not be read', extracted: bestLine(rawText, 'government warning') }
    if (!options.warningStyleConfirmed) return { state: 'review', reason: 'Confirm that only “GOVERNMENT WARNING” is uppercase and bold', extracted: expected }
    return { state: 'pass', reason: 'Exact text and heading format confirmed', extracted: expected }
  }
  if (key === 'netContents') {
    const expectedMl = parseVolume(expected)
    const found = rawText.match(/\d+(?:\.\d+)?\s*(?:ml|milliliters?|l|liters?|cl|fl\.?\s*oz\.?|fluid\s*ounces?)/i)?.[0] || ''
    const foundMl = parseVolume(found)
    if (expectedMl && foundMl) return Math.abs(expectedMl - foundMl) < 1 ? { state: 'pass', reason: 'Equivalent volume', extracted: found } : { state: 'error', reason: 'Volume differs', extracted: found }
    return { state: 'review', reason: 'Net contents could not be read reliably', extracted: found }
  }
  const normalizedRaw = normalizeText(rawText)
  const normalizedExpected = normalizeText(expected)
  if (normalizedRaw.includes(normalizedExpected)) return { state: 'pass', reason: 'Matched after harmless formatting differences', extracted: bestLine(rawText, expected) }
  const candidate = bestLine(rawText, expected)
  const score = similarity(candidate, expected)
  if (score >= .82) return { state: 'review', reason: 'Possible match; OCR is uncertain', extracted: candidate, confidence: score }
  return { state: 'error', reason: 'Value differs from application', extracted: candidate, confidence: score }
}

export function verifyLabel(reference, rawText, options = {}) {
  const fields = Object.fromEntries(FIELD_DEFS.map(([key]) => [key, verifyField(key, reference[key] || '', rawText, options)]))
  const states = Object.values(fields).map(f => f.state)
  return { fields, state: states.includes('error') ? 'error' : states.includes('review') ? 'review' : 'pass' }
}
