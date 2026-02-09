/**
 * Copy frontend dist/ into backend/static for single-URL deployment.
 * Run from project root after: npm run build
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const dist = path.join(root, 'dist')
const target = path.join(root, 'backend', 'static')

if (!fs.existsSync(dist)) {
  console.error('Run "npm run build" first.')
  process.exit(1)
}

if (fs.existsSync(target)) {
  fs.rmSync(target, { recursive: true })
}
fs.mkdirSync(target, { recursive: true })
fs.cpSync(dist, target, { recursive: true })
console.log('Copied dist/ to backend/static')