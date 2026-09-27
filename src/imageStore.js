const DB_NAME = 'labelcheck-images'
const STORE = 'images'

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveImage(id, file) {
  const db = await database()
  await new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(file, id)
    request.onsuccess = resolve
    request.onerror = () => reject(request.error)
  })
  db.close()
}

export async function loadImage(id) {
  const db = await database()
  const value = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return value
}

export async function clearImages() {
  const db = await database()
  await new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).clear()
    request.onsuccess = resolve
    request.onerror = () => reject(request.error)
  })
  db.close()
}
