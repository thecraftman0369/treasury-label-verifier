const KEY = 'labelcheck-session-v1'
export function loadSession() { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
export function saveSession(value) { localStorage.setItem(KEY, JSON.stringify(value)) }
export function clearSession() { localStorage.removeItem(KEY) }
