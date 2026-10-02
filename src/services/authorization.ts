import type { Authorization, Claim, ClaimFact, SourceRecord } from '../types'

export interface FactSourceRef {
  sourceId: string
  kind: '支持证据' | '相反证据'
}

export interface InvalidRef {
  ref: FactSourceRef
  source?: SourceRecord
  authorization?: Authorization
  reason: string
}

/** 事实引用的全部共享库来源（支持 + 相反） */
export function factRefs(fact: ClaimFact): FactSourceRef[] {
  return [
    ...fact.sources.map((sourceId) => ({ sourceId, kind: '支持证据' as const })),
    ...fact.counterSources.map((sourceId) => ({ sourceId, kind: '相反证据' as const }))
  ]
}

export function resolveSource(sourceId: string, sources: SourceRecord[]): SourceRecord | undefined {
  return sources.find((item) => item.id === sourceId)
}

export function resolveAuthorization(source: SourceRecord | undefined, authorizations: Authorization[]): Authorization | undefined {
  if (!source?.authorizationNo) return undefined
  return authorizations.find((item) => item.authNo === source.authorizationNo)
}

/**
 * 实时计算事实下失效的来源引用：
 * 授权撤销、scopeVersion 高于事实确认时的版本、来源缺少授权编号，均判失效。
 */
export function invalidRefs(fact: ClaimFact, authorizations: Authorization[], sources: SourceRecord[]): InvalidRef[] {
  const confirmed = fact.confirmedScopeVersions ?? {}
  const result: InvalidRef[] = []
  for (const ref of factRefs(fact)) {
    const source = resolveSource(ref.sourceId, sources)
    if (!source) {
      result.push({ ref, reason: '共享库中找不到该来源记录' })
      continue
    }
    if (!source.authorizationNo) {
      result.push({ ref, source, reason: '来源尚未补授权编号' })
      continue
    }
    const authorization = resolveAuthorization(source, authorizations)
    if (!authorization) {
      result.push({ ref, source, reason: `授权 ${source.authorizationNo} 不存在` })
      continue
    }
    const seenVersion = confirmed[ref.sourceId]
    if (authorization.status === '已撤销') {
      result.push({ ref, source, authorization, reason: `授权 ${authorization.authNo} 已撤销` })
    } else if (seenVersion === undefined) {
      result.push({ ref, source, authorization, reason: `授权 ${authorization.authNo} 当前范围尚未经事实确认` })
    } else if (seenVersion < authorization.scopeVersion) {
      result.push({ ref, source, authorization, reason: `授权 ${authorization.authNo} 范围已变更（V${seenVersion}→V${authorization.scopeVersion}）` })
    }
  }
  return result
}

export interface FactValidity {
  awaitingReconfirm: boolean
  reasons: string[]
  invalid: InvalidRef[]
}

/** 动态判定 + 失效标记双保险：授权范围一改，无需等待即可算出失效态 */
export function factValidity(fact: ClaimFact, authorizations: Authorization[], sources: SourceRecord[]): FactValidity {
  const invalid = invalidRefs(fact, authorizations, sources)
  const reasons = invalid.map((item) => item.reason)
  if (invalid.length === 0 && fact.awaitingReconfirm && fact.invalidateReason) {
    return { awaitingReconfirm: true, reasons: [fact.invalidateReason], invalid: [] }
  }
  const unique = Array.from(new Set(reasons))
  return { awaitingReconfirm: invalid.length > 0 || !!fact.awaitingReconfirm, reasons: unique, invalid }
}

export function claimInvalidFacts(claim: Claim, authorizations: Authorization[], sources: SourceRecord[]) {
  return claim.facts
    .map((fact) => ({ fact, validity: factValidity(fact, authorizations, sources) }))
    .filter((item) => item.validity.awaitingReconfirm)
}

export function hasLegacySources(claim: Claim): boolean {
  return claim.facts.some((fact) => (fact.legacySources?.length ?? 0) + (fact.legacyCounterSources?.length ?? 0) > 0)
}

/** 发布前校验：失效待重认、旧稿未迁移、未解决疑点、待证信息、空来源等任一命中即阻断 */
export function publishPreflight(claim: Claim, authorizations: Authorization[], sources: SourceRecord[]): string[] {
  const blocking: string[] = []
  const invalid = claimInvalidFacts(claim, authorizations, sources)
  if (invalid.length) blocking.push(`事实 ${invalid.map((item) => item.fact.id).join('、')} 的授权范围已变更或撤销，等待重新确认`)
  if (hasLegacySources(claim)) blocking.push('存在旧稿内嵌来源，需先迁移到共享库并补授权编号')
  if (claim.facts.some((fact) => fact.conclusion === '证据不足' && fact.unresolved.length)) blocking.push('仍有证据不足且未解决疑点的事实')
  if (claim.facts.some((fact) => fact.sources.length + fact.counterSources.length === 0)) blocking.push('存在没有来源记录的事实')
  if (claim.facts.flatMap((fact) => fact.sources).some((sourceId) => sources.find((item) => item.id === sourceId)?.kind === '待证信息')) blocking.push('待证信息尚未完成原始来源核验')
  if (!claim.editor) blocking.push('缺少编辑复核人')
  return blocking
}

/** 导出闸口：仅“重认前停止导出”这一条；已锁定的发布档案不受此限制 */
export function exportBlockers(claim: Claim, authorizations: Authorization[], sources: SourceRecord[]): string[] {
  return claimInvalidFacts(claim, authorizations, sources).flatMap(({ fact, validity }) =>
    validity.reasons.map((reason) => `${fact.id}：${reason}`))
}

/** 收集事实引用到的全部授权编号 */
export function linkedAuthNos(claim: Claim, sources: SourceRecord[]): string[] {
  const nos: string[] = []
  for (const fact of claim.facts) {
    for (const ref of factRefs(fact)) {
      const no = resolveSource(ref.sourceId, sources)?.authorizationNo
      if (no && !nos.includes(no)) nos.push(no)
    }
  }
  return nos
}
