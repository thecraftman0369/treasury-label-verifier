import { describe, expect, it } from 'vitest'
import { DEFAULT_WARNING, normalizeText, parseVolume, verifyField, verifyLabel } from '../src/verification.js'

describe('semantic normalization', () => {
  it('ignores harmless punctuation, case, accents, and ampersands', () => expect(normalizeText('José & Sons, LLC')).toBe('jose and sons llc'))
  it('converts common volume units', () => { expect(parseVolume('750 mL')).toBe(750); expect(parseVolume('.75 liters')).toBe(750) })
})

describe('verification', () => {
  const ref={brandName:'Old Tom Distillery',classType:'London Dry Gin',netContents:'750 mL',responsibleParty:'Old Tom Spirits LLC',address:'10 Cooper Street, Boston, MA',role:'Bottled by',countryOfOrigin:'United Kingdom',governmentWarning:DEFAULT_WARNING}
  const label=`OLD TOM DISTILLERY\nLONDON DRY GIN\n750 ml\nBottled by Old Tom Spirits, LLC\n10 Cooper Street Boston MA\nProduct of United Kingdom\n${DEFAULT_WARNING}`
  it('passes equivalent application values with confirmed warning style',()=>expect(verifyLabel(ref,label,{warningStyleConfirmed:true,isImport:true}).state).toBe('pass'))
  it('requires human confirmation for warning typography',()=>expect(verifyField('governmentWarning',DEFAULT_WARNING,label,{}).state).toBe('review'))
  it('treats a known mismatch as error',()=>expect(verifyField('netContents','1 L',label,{}).state).toBe('error'))
  it('treats unreadable values as review, never error',()=>expect(verifyField('brandName','Old Tom','',{}).state).toBe('review'))
  it('marks import origin not applicable on domestic products',()=>expect(verifyField('countryOfOrigin','',label,{isImport:false}).reason).toBe('Not applicable'))
})
