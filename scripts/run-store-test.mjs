// 存储层规则测试运行器：为 zustand persist 提供 localStorage 垫片
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
try { mkdirSync(resolve(root, 'node_modules/.cache'), { recursive: true }) } catch { /* 已存在 */ }

globalThis.localStorage = {
  store: {},
  getItem(key) { return this.store[key] ?? null },
  setItem(key, value) { this.store[key] = String(value) },
  removeItem(key) { delete this.store[key] }
}

await import(resolve(root, 'node_modules/.cache/store-test.mjs'))
