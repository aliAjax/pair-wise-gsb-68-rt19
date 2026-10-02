import axios from 'axios'
import type { Authorization, Claim, SourceRecord } from '../types'
import { publishPreflight } from './authorization'

const client = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api', timeout: 5000 })

export async function loadClaimSnapshot(fallback: Claim[]): Promise<Claim[]> {
  if (!import.meta.env.VITE_API_BASE_URL) return fallback
  try { return (await client.get<Claim[]>('/claims')).data } catch { return fallback }
}

export async function preflightPublish(claim: Claim, authorizations: Authorization[] = [], sources: SourceRecord[] = []) {
  const blocking = publishPreflight(claim, authorizations, sources)
  return { allowed: blocking.length === 0, blocking }
}
