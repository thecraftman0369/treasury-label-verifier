import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { recognizeLabel } from './ocr.js'
import { DEFAULT_WARNING, FIELD_DEFS, verifyLabel } from './verification.js'
import { clearSession, loadSession, saveSession } from './storage.js'
import { clearImages, loadImage, saveImage } from './imageStore.js'
import './styles.css'
import './extras.css'

const copy = {
  en: { verify:'Verify labels', dashboard:'Session dashboard', ref:'Application data', upload:'Add label images', run:'Run verification', results:'Batch results', manual:'Manual text entry', defer:'Defer', resume:'Resume', replace:'Replace image', export:'Export CSV', reset:'New session' },
  es: { verify:'Verificar etiquetas', dashboard:'Panel de sesión', ref:'Datos de la solicitud', upload:'Agregar imágenes', run:'Ejecutar verificación', results:'Resultados del lote', manual:'Entrada manual de texto', defer:'Posponer', resume:'Reanudar', replace:'Reemplazar imagen', export:'Exportar CSV', reset:'Nueva sesión' }
}
const blankReference = { brandName:'', classType:'', netContents:'', responsibleParty:'', address:'', role:'', countryOfOrigin:'', governmentWarning:DEFAULT_WARNING, isImport:false, warningStyleConfirmed:false }
const initial = { reference: blankReference, labels: [], language:'en', activity:[] }
const statusText = { pass:'Pass', review:'Review', error:'Error', queued:'Ready', processing:'Reading', deferred:'Deferred' }

function uid() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}` }
function stamp(action) { return { id:uid(), at:new Date().toISOString(), action } }

export function App() {
  const restored = useMemo(() => loadSession(), [])
  const hydrated = restored ? { ...restored, labels:(restored.labels || []).map(label => ({ ...label, file:null, preview:'' })) } : initial
  const [session, setSession] = useState(hydrated)
  const [active, setActive] = useState('verify')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [notice, setNotice] = useState(restored ? 'Previous session restored.' : '')
  const inputRef = useRef(null)
  const t = copy[session.language]
  useEffect(() => saveSession(session), [session])
  useEffect(() => {
    if (!restored?.labels?.length) return
    Promise.all(restored.labels.map(async label => {
      const file = await loadImage(label.id)
      return file ? { id:label.id, file, preview:URL.createObjectURL(file) } : null
    })).then(items => setSession(s => ({ ...s, labels:s.labels.map(label => {
      const item=items.find(x=>x?.id===label.id); return item ? { ...label, file:item.file, preview:item.preview } : label
    }) }))).catch(() => setNotice('Session data was restored. Reattach images if you need to rerun OCR.'))
  }, [])

  function updateReference(key, value) { setSession(s => ({ ...s, reference:{ ...s.reference, [key]:value } })) }
  function addFiles(files) {
    const room = Math.max(0, 12 - session.labels.length)
    const additions = [...files].slice(0, room).map(file => ({ id:uid(), file, name:file.name, size:file.size, preview:URL.createObjectURL(file), status:'queued', rawText:'', ocrRuns:[], confidence:null, corrected:{}, verification:null, resolution:'open', attempts:0, timeline:[stamp('Label added')] }))
    if (!additions.length) return setNotice('This prototype supports up to 12 labels per session.')
    additions.forEach(label => saveImage(label.id, label.file).catch(() => {}))
    setSession(s => ({ ...s, labels:[...s.labels, ...additions], activity:[stamp(`${additions.length} label(s) added`), ...s.activity] }))
  }
  function patchLabel(id, patch) { setSession(s => ({ ...s, labels:s.labels.map(l => l.id === id ? { ...l, ...patch } : l) })) }
  async function processAll() {
    const queued = session.labels.filter(l => l.status === 'queued' || l.status === 'review' || l.status === 'error')
    if (!queued.length) return setNotice('Add at least one label image first.')
    setBusy(true); setNotice('')
    for (const label of queued) {
      patchLabel(label.id, { status:'processing', attempts:label.attempts + 1, timeline:[...label.timeline, stamp('OCR started')] })
      try {
        let rawText = label.rawText
        let confidence = label.confidence
        if (label.file) {
          const result = await recognizeLabel(label.file, m => setProgress(`${label.name}: ${m.status}${m.progress ? ` ${Math.round(m.progress * 100)}%` : ''}`))
          rawText = result.text; confidence = result.confidence
        }
        const verification = verifyLabel(session.reference, rawText, { isImport:session.reference.isImport, warningStyleConfirmed:session.reference.warningStyleConfirmed })
        patchLabel(label.id, { rawText, ocrRuns:[...(label.ocrRuns || []),{ id:uid(), at:new Date().toISOString(), text:rawText, confidence }], confidence, verification, status:verification.state, resolution:'open', timeline:[...label.timeline, stamp('OCR completed'), stamp(`Verification: ${statusText[verification.state]}`)] })
      } catch (error) {
        patchLabel(label.id, { status:'review', verification:null, failure:String(error.message || error), timeline:[...label.timeline, stamp('OCR could not complete; sent to review')] })
      }
    }
    setBusy(false); setProgress(''); setSession(s => ({ ...s, activity:[stamp('Batch verification completed'), ...s.activity] }))
  }
  function applyManual(id, text) {
    const label = session.labels.find(l => l.id === id)
    const verification = verifyLabel(session.reference, text, { isImport:session.reference.isImport, warningStyleConfirmed:session.reference.warningStyleConfirmed })
    patchLabel(id, { corrected:{ ...label.corrected, manualText:text }, verification, status:verification.state, timeline:[...label.timeline, stamp('Manual text added; original OCR preserved'), stamp(`Verification: ${statusText[verification.state]}`)] })
  }
  function exportCsv() {
    const rows = [['file','status','resolution','ocr_confidence','unresolved_fields','raw_ocr']]
    session.labels.forEach(l => rows.push([l.name,l.status,l.resolution,l.confidence ?? '',Object.entries(l.verification?.fields || {}).filter(([,v]) => v.state !== 'pass').map(([k]) => k).join('|'),l.rawText]))
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n')
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='labelcheck-session.csv'; a.click(); URL.revokeObjectURL(a.href)
  }
  function reset() { if (confirm('Start a new session? This clears saved work on this device.')) { clearSession(); clearImages().catch(()=>{}); setSession(initial); setNotice('New session started.') } }
  const issueCounts = useMemo(() => { const c={}; session.labels.forEach(l => Object.entries(l.verification?.fields || {}).forEach(([k,v]) => { if(v.state !== 'pass') c[k]=(c[k]||0)+1 })); return c }, [session.labels])
  const counts = useMemo(() => session.labels.reduce((a,l)=>(a[l.status]=(a[l.status]||0)+1,a),{}),[session.labels])

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="seal">LC</span><div><strong>LabelCheck</strong><small>Alcohol label verification</small></div></div><nav aria-label="Primary"><button className={active==='verify'?'active':''} onClick={()=>setActive('verify')}>{t.verify}</button><button className={active==='dashboard'?'active':''} onClick={()=>setActive('dashboard')}>{t.dashboard}</button></nav><div className="top-actions"><label className="language"><span className="sr-only">Language</span><select aria-label="Language" value={session.language} onChange={e=>setSession(s=>({...s,language:e.target.value}))}><option value="en">English</option><option value="es">Español</option></select></label><button className="quiet" onClick={reset}>{t.reset}</button></div></header>
    {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss" onClick={()=>setNotice('')}>×</button></div>}
    <main>
    {active==='verify' ? <>
      <section className="intro"><div><p className="eyebrow">LIVE SESSION</p><h1>Compare application data to label text</h1><p>Images and session data stay in this browser. OCR may require a one-time language download.</p></div><div className="privacy-badge">Local processing<br/><strong>No account required</strong></div></section>
      <div className="workspace">
        <section className="panel reference-panel" aria-labelledby="reference-title"><div className="panel-head"><div><span className="step">1</span><h2 id="reference-title">{t.ref}</h2></div><button className="help" title="Enter the approved application values. Harmless punctuation and spacing differences are normalized.">?</button></div>
          <div className="form-grid">
            <Field label="Brand name" value={session.reference.brandName} onChange={v=>updateReference('brandName',v)} required />
            <Field label="Class or type" value={session.reference.classType} onChange={v=>updateReference('classType',v)} required />
            <Field label="Net contents" value={session.reference.netContents} onChange={v=>updateReference('netContents',v)} placeholder="750 mL" required />
            <Field label="Responsible party" value={session.reference.responsibleParty} onChange={v=>updateReference('responsibleParty',v)} required />
            <Field label="Address" value={session.reference.address} onChange={v=>updateReference('address',v)} required wide />
            <Field label="Role, if shown" value={session.reference.role} onChange={v=>updateReference('role',v)} placeholder="Bottled by" />
            <label className="check wide"><input type="checkbox" checked={session.reference.isImport} onChange={e=>updateReference('isImport',e.target.checked)}/><span>This is an imported product</span></label>
            {session.reference.isImport && <Field label="Country of origin" value={session.reference.countryOfOrigin} onChange={v=>updateReference('countryOfOrigin',v)} required wide />}
            <label className="wide"><span>Expected government warning <em>Exact text match</em></span><textarea rows="5" value={session.reference.governmentWarning} onChange={e=>updateReference('governmentWarning',e.target.value)} /></label>
            <label className="check wide attention"><input type="checkbox" checked={session.reference.warningStyleConfirmed} onChange={e=>updateReference('warningStyleConfirmed',e.target.checked)}/><span>I will visually confirm that only <b>GOVERNMENT WARNING</b> is uppercase and bold. OCR cannot prove bold styling.</span></label>
          </div>
        </section>
        <section className="panel upload-panel" aria-labelledby="upload-title"><div className="panel-head"><div><span className="step">2</span><h2 id="upload-title">{t.upload}</h2></div><span className="muted">Up to 12</span></div>
          <div className="dropzone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addFiles(e.dataTransfer.files)}}><input ref={inputRef} type="file" accept="image/*" multiple onChange={e=>addFiles(e.target.files)} /><div className="upload-icon">↑</div><strong>Drop images here or choose files</strong><span>JPG, PNG, WEBP · clear, straight-on photos work best</span><button onClick={()=>inputRef.current.click()}>Choose images</button></div>
          <div className="tips"><strong>For a readable image</strong><span>Fill the frame, avoid glare, and keep text upright. If OCR fails, replace the image or enter text manually.</span></div>
          <button className="primary run" onClick={processAll} disabled={busy || !session.labels.length}>{busy ? 'Processing batch…' : t.run}</button>{progress && <p className="progress" role="status">{progress}</p>}
        </section>
      </div>
      <section className="results" aria-labelledby="results-title"><div className="section-title"><div><span className="step">3</span><h2 id="results-title">{t.results}</h2><span className="count">{session.labels.length}</span></div><button onClick={exportCsv} disabled={!session.labels.length}>{t.export}</button></div>
        {!session.labels.length ? <Empty /> : <div className="result-list">{session.labels.map(label=><ResultCard key={label.id} label={label} t={t} onPatch={patchLabel} onManual={applyManual} />)}</div>}
      </section>
    </> : <Dashboard labels={session.labels} counts={counts} issueCounts={issueCounts} activity={session.activity} onExport={exportCsv} />}
    </main><footer>Prototype · OCR results require human review before a compliance decision.</footer>
  </div>
}

function Field({label,value,onChange,placeholder,required,wide}) { return <label className={wide?'wide':''}><span>{label}{required && <b aria-label="required"> *</b>}</span><input value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} /></label> }
function Empty(){return <div className="empty"><div className="empty-mark">▤</div><h3>No labels in this session</h3><p>Add one image or a small batch. Each label keeps its own OCR text, status, and audit timeline.</p></div>}
function Status({value}){return <span className={`status ${value}`}><span aria-hidden="true">{value==='pass'?'✓':value==='error'?'!':value==='processing'?'…':'?'}</span>{statusText[value]||value}</span>}
function ResultCard({label,t,onPatch,onManual}) {
  const [open,setOpen]=useState(false); const [manual,setManual]=useState(label.corrected?.manualText || '')
  function replaceImage(file) { if (!file) return; saveImage(label.id,file).catch(()=>{}); onPatch(label.id,{file,name:file.name,size:file.size,preview:URL.createObjectURL(file),status:'queued',resolution:'open',timeline:[...label.timeline,stamp('Image replaced')]}) }
  return <article className="result-card"><div className="result-summary">{label.preview?<img src={label.preview} alt={`Uploaded label ${label.name}`} />:<div className="missing-preview" aria-label="Image must be reattached">▧</div>}<div className="file-meta"><strong>{label.name}</strong><span>{Math.round(label.size/1024)} KB {label.confidence!=null && `· OCR ${Math.round(label.confidence)}%`} {label.resolution==='resolved' && '· Resolved'}</span></div><Status value={label.status}/><div className="result-actions"><button onClick={()=>setOpen(!open)} aria-expanded={open}>{open?'Close details':'Review details'}</button><button onClick={()=>onPatch(label.id,{status:label.status==='deferred'?(label.verification?.state||'review'):'deferred',resolution:label.status==='deferred'?'open':'deferred',timeline:[...label.timeline,stamp(label.status==='deferred'?'Resumed':'Deferred')]})}>{label.status==='deferred'?t.resume:t.defer}</button></div></div>
    {open && <div className="details"><div className="comparison"><h3>Field comparison</h3>{FIELD_DEFS.map(([key,name])=>{const v=label.verification?.fields?.[key];return <div className="field-result" key={key}><strong>{name}</strong><Status value={v?.state||'review'}/><span>{v?.reason||'Run verification to compare this field.'}</span>{v?.extracted && <code>{v.extracted}</code>}</div>})}</div><div className="ocr-column"><h3>OCR and corrections</h3><p className="muted">Original OCR is permanent. Manual text is stored separately.</p><details><summary>Original OCR text ({label.ocrRuns?.length || (label.rawText?1:0)} run(s))</summary>{label.ocrRuns?.length ? label.ocrRuns.map((run,index)=><div key={run.id}><small>Run {index+1} · {new Date(run.at).toLocaleString()} · {Math.round(run.confidence||0)}%</small><pre>{run.text}</pre></div>) : <pre>{label.rawText || 'No OCR text captured.'}</pre>}</details><label><span>{t.manual}</span><textarea rows="7" value={manual} onChange={e=>setManual(e.target.value)} placeholder="Paste or type what the label says"/></label><button className="secondary" onClick={()=>onManual(label.id,manual)} disabled={!manual.trim()}>Compare manual text</button>{label.attempts>=10 && <div className="warning">Ten attempts recorded. Switch to manual entry or replace the image.</div>}<h3>Audit timeline</h3><ol className="timeline">{label.timeline.map(e=><li key={e.id}><time>{new Date(e.at).toLocaleString()}</time>{e.action}</li>)}</ol><div className="detail-actions"><label className="replace-button">{t.replace}<input className="sr-only" type="file" accept="image/*" onChange={e=>replaceImage(e.target.files?.[0])}/></label><button className="secondary" onClick={()=>onPatch(label.id,{resolution:label.resolution==='resolved'?'open':'resolved',timeline:[...label.timeline,stamp(label.resolution==='resolved'?'Resolution reopened':'Marked resolved')]})}>{label.resolution==='resolved'?'Reopen resolution':'Mark resolved'}</button></div></div></div>}</article>
}
function Dashboard({labels,counts,issueCounts,activity,onExport}) { const frequent=Object.entries(issueCounts).filter(([,n])=>n>=5); const unresolved=labels.filter(l=>l.resolution!=='resolved' && ['review','deferred'].includes(l.status)).length; return <><section className="intro"><div><p className="eyebrow">CURRENT BROWSER SESSION</p><h1>Session dashboard</h1><p>Monitor batch progress, unresolved work, and recurring label issues.</p></div><button className="primary" onClick={onExport} disabled={!labels.length}>Export all results</button></section><div className="metrics"><Metric name="Total labels" value={labels.length}/><Metric name="Passed" value={counts.pass||0}/><Metric name="Needs review" value={unresolved}/><Metric name="Errors" value={counts.error||0}/></div><div className="dashboard-grid"><section className="panel"><h2>Frequent issues</h2><p className="muted">Shown when the same field needs attention on five or more labels.</p>{frequent.length?<ul className="issue-list">{frequent.map(([k,n])=><li key={k}><span>{FIELD_DEFS.find(f=>f[0]===k)?.[1]}</span><strong>{n} labels</strong></li>)}</ul>:<div className="empty compact"><p>No issue has reached the five-label threshold.</p></div>}</section><section className="panel"><h2>Session activity</h2>{activity.length?<ol className="timeline">{activity.slice(0,12).map(e=><li key={e.id}><time>{new Date(e.at).toLocaleString()}</time>{e.action}</li>)}</ol>:<div className="empty compact"><p>Activity will appear after labels are added.</p></div>}</section></div></> }
function Metric({name,value}){return <div className="metric"><span>{name}</span><strong>{value}</strong></div>}

const root = document.getElementById('root')
if (root) createRoot(root).render(<React.StrictMode><App/></React.StrictMode>)
