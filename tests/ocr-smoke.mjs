import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createWorker } from 'tesseract.js'

const outputDir = new URL('../test-results/', import.meta.url)
await mkdir(outputDir, { recursive:true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport:{ width:1200, height:1500 }, deviceScaleFactor:1 })
await page.setContent(`<!doctype html><style>body{margin:0;background:#eee;font-family:Arial}main{box-sizing:border-box;width:1000px;margin:50px auto;padding:65px;background:#fff;color:#111;text-align:center;border:10px double #111}h1{font-size:74px;margin:0 0 25px;letter-spacing:3px}h2{font-size:44px;margin:15px}.details{font-size:30px;line-height:1.5}.warning{text-align:left;margin-top:50px;font-size:23px;line-height:1.45}.warning b{font-size:25px}</style><main><h1>OLD TOM DISTILLERY</h1><h2>LONDON DRY GIN</h2><div class="details">750 mL<br>Bottled by Old Tom Spirits LLC<br>10 Cooper Street, Boston, MA<br>Product of United Kingdom</div><div class="warning"><b>GOVERNMENT WARNING:</b> (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.</div></main>`)
const fixturePath = new URL('../test-results/old-tom-label.png', import.meta.url).pathname.replace(/^\/(.:)/, '$1')
await page.screenshot({ path:fixturePath, fullPage:true })
await browser.close()

const started = performance.now()
const worker = await createWorker('eng')
const { data } = await worker.recognize(fixturePath)
await worker.terminate()
const elapsed = Math.round(performance.now() - started)
if (!data.text.toUpperCase().includes('750 ML') || !data.text.toUpperCase().includes('GOVERNMENT WARNING') || !data.text.toUpperCase().includes('OLD TOM SPIRITS')) {
  throw new Error(`OCR smoke test failed. OCR output:\n${data.text}`)
}
console.log(`OCR smoke passed in ${elapsed} ms at ${Math.round(data.confidence)}% confidence.`)
