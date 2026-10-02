import axios from 'axios'
import type { Claim, SharedSource } from '../types'
import { claimAuthBlockers } from '../store/useClaimStore'

const client = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api', timeout: 5000 })

export async function loadClaimSnapshot(fallback: Claim[]): Promise<Claim[]> {
  if (!import.meta.env.VITE_API_BASE_URL) return fallback
  try { return (await client.get<Claim[]>('/claims')).data } catch { return fallback }
}

export function preflightPublish(claim: Claim, library: SharedSource[]) {
  const blocking: string[] = []
  if (claim.facts.some((fact) => fact.conclusion === '证据不足' && fact.unresolved.length)) blocking.push('仍有证据不足且未解决疑点的事实')
  if (claim.facts.some((fact) => fact.sourceIds.length + fact.counterSourceIds.length === 0)) blocking.push('存在没有来源记录的事实')
  if (claim.facts.flatMap((fact) => fact.sourceIds).some((id) => library.find((source) => source.id === id)?.kind === '待证信息')) blocking.push('待证信息尚未完成原始来源核验')
  // 撤权与发布在两个窗口撞车时，发布一侧先停复审
  if (claim.status === '停发复审') blocking.push('该主张已被撤权/授权变更打断，须在复核队列重认后重新发布')
  blocking.push(...claimAuthBlockers(claim, library))
  return { allowed: blocking.length === 0, blocking: Array.from(new Set(blocking)) }
}
