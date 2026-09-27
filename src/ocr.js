import { createWorker } from 'tesseract.js'

let workerPromise

async function getWorker(onProgress) {
  if (!workerPromise) workerPromise = createWorker('eng', 1, { logger: message => onProgress?.(message) })
  return workerPromise
}

export async function recognizeLabel(file, onProgress) {
  const worker = await getWorker(onProgress)
  const result = await worker.recognize(file)
  return { text: result.data.text, confidence: result.data.confidence }
}
