import { defineConfig } from 'vitest/config'
export default defineConfig({ test:{ environment:'jsdom', setupFiles:[], include:['tests/*.test.js','tests/*.test.jsx'] } })
