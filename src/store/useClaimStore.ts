import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { seedAudit, seedAuthorizations, seedClaims, seedPublications, seedSharedSources, seedVersions } from '../data/seed'
import { claimInvalidFacts, factRefs, factValidity, linkedAuthNos, publishPreflight } from '../services/authorization'
import type { AuditEntry, Authorization, AuthorizationScope, AuthorizationScopeChange, Claim, ClaimAnnotation, ClaimFact, FactConclusion, MigrationCheckpoint, MigrationStep, PublicationArchive, SourceRecord, VersionRecord } from '../types'

/** 发布侧占锁：记录进入发布窗口时看到的授权 scopeVersion；与撤权窗口撞车时据此先停 */
interface PublishIntent {
  claimId: string
  operator: string
  startedAt: string
  authVersions: Record<string, number>
  authStatus: Record<string, Authorization['status']>
}

type OpResult = { ok: boolean; message: string }
type FailStep = { factId: string; kind: MigrationStep['kind']; title: string }

interface ClaimState {
  claims: Claim[]
  sharedSources: SourceRecord[]
  authorizations: Authorization[]
  scopeChanges: AuthorizationScopeChange[]
  versions: VersionRecord[]
  audit: AuditEntry[]
  publications: PublicationArchive[]
  checkpoints: MigrationCheckpoint[]
  publishIntents: PublishIntent[]
  keyword: string
  status: Claim['status'] | '全部'
  setKeyword: (value: string) => void
  setStatus: (value: Claim['status'] | '全部') => void
  addClaim: (input: { title: string; summary: string; reporter: string; priority: Claim['priority'] }) => Claim
  updateFact: (claimId: string, factId: string, patch: Partial<ClaimFact>) => void
  addFact: (claimId: string, text: string) => void
  addAnnotation: (claimId: string, factId: string, annotation: Omit<ClaimAnnotation, 'id' | 'createdAt' | 'resolved'>) => void
  resolveAnnotation: (claimId: string, factId: string, annotationId: string) => void
  addSharedSource: (source: Omit<SourceRecord, 'id' | 'capturedAt' | 'version'>) => SourceRecord
  linkSharedSource: (claimId: string, factId: string, sourceId: string, counter: boolean) => void
  /** 法务改授权范围：scopeVersion +1，旧范围确认过的关联事实立即失效等待重认；status=已撤销表示撤权 */
  changeAuthorization: (authorizationId: string, patch: { scope?: AuthorizationScope; status?: Authorization['status']; reason: string; changedBy: string }) => void
  /** 事实重新确认：按当前授权版本重新登记，其他事实照常 */
  reconfirmFact: (claimId: string, factId: string, operator: string) => OpResult
  transitionClaim: (claimId: string, status: Claim['status'], note: string) => OpResult
  /** 发布窗口进入：登记占锁快照；撞车检查在 publishClaim 内完成 */
  beginPublishIntent: (claimId: string, operator: string) => void
  publishClaim: (claimId: string, operator: string, note: string) => OpResult
  /** 旧稿迁移：内嵌来源收进共享库并补授权编号，写检查点；failStep 命中时模拟本机写入失败 */
  migrateLegacyDraft: (claimId: string, operator: string, failStep?: FailStep) => OpResult
  /** 从检查点恢复：只补未完成事实和审计，已完成步骤不重复记录 */
  resumeMigration: (claimId: string, operator: string) => OpResult
  /** 演示撤权窗口：撤销该主张关联的全部有效授权 */
  revokeAuthorizationsForClaim: (claimId: string, operator: string, reason: string) => void
  /** 导出尝试留痕：重认前被拦截也记录，锁定档案的导出不受影响 */
  recordExportAttempt: (claimId: string, operator: string, blocked: boolean, detail: string) => void
  reset: () => void
}

let idSeed = 100
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idSeed++}`
const nowIso = () => new Date().toISOString()

function makeAudit(claimId: string, action: string, operator: string, detail: string): AuditEntry {
  return { id: nextId('AUD'), claimId, action, operator, detail, createdAt: nowIso() }
}

/** 某主张全部事实对某授权的引用清单，用于范围变更留痕 */
function collectAffectedRefs(claims: Claim[], sharedSources: SourceRecord[], authorizationNo: string) {
  const refs: string[] = []
  for (const claim of claims) {
    for (const fact of claim.facts) {
      for (const ref of factRefs(fact)) {
        const source = sharedSources.find((item) => item.id === ref.sourceId)
        if (source?.authorizationNo === authorizationNo) refs.push(`${claim.id}/${fact.id}/${ref.sourceId}（${ref.kind}）`)
      }
    }
  }
  return refs
}

function buildLegacySteps(claim: Claim): MigrationStep[] {
  const steps: MigrationStep[] = []
  for (const fact of claim.facts) {
    for (const legacy of fact.legacySources ?? []) {
      steps.push({ id: `STEP-${claim.id}-${fact.id}-${legacy.id}`, claimId: claim.id, factId: fact.id, kind: '支持证据', legacyTitle: legacy.title, sharedSourceId: '', authorizationId: '', authorizationNo: '', done: false })
    }
    for (const legacy of fact.legacyCounterSources ?? []) {
      steps.push({ id: `STEP-${claim.id}-${fact.id}-${legacy.id}`, claimId: claim.id, factId: fact.id, kind: '相反证据', legacyTitle: legacy.title, sharedSourceId: '', authorizationId: '', authorizationNo: '', done: false })
    }
  }
  return steps
}

const seedState = () => ({
  claims: structuredClone(seedClaims),
  sharedSources: structuredClone(seedSharedSources),
  authorizations: structuredClone(seedAuthorizations),
  scopeChanges: [] as AuthorizationScopeChange[],
  versions: structuredClone(seedVersions),
  audit: structuredClone(seedAudit),
  publications: structuredClone(seedPublications),
  checkpoints: [] as MigrationCheckpoint[],
  publishIntents: [] as PublishIntent[]
})

export const useClaimStore = create<ClaimState>()(persist((set, get) => {
  /**
   * 范围变更核心：更新授权、写范围变更留痕、旧范围确认过的关联事实立即失效、逐主张补审计。
   * 在调用方给出的可变 state 快照上原地修改，最终由调用方一次性 set。
   */
  function applyAuthorizationChange(
    state: ReturnType<typeof get>,
    authorization: Authorization,
    patch: { scope?: AuthorizationScope; status?: Authorization['status']; reason: string; changedBy: string }
  ): void {
    const previousVersion = authorization.scopeVersion
    const previousScope = structuredClone(authorization.scope)
    const previousStatus = authorization.status
    if (patch.scope) {
      authorization.scope = patch.scope
      authorization.scopeVersion = previousVersion + 1
    }
    if (patch.status) authorization.status = patch.status
    authorization.updatedAt = nowIso()
    const newVersion = authorization.scopeVersion
    const actuallyRevoked = authorization.status === '已撤销' && previousStatus === '有效'

    const affectedRefs = collectAffectedRefs(state.claims, state.sharedSources, authorization.authNo)
    state.scopeChanges.unshift({
      id: nextId('CHG'),
      authorizationId: authorization.id,
      authNo: authorization.authNo,
      changedAt: authorization.updatedAt,
      changedBy: patch.changedBy,
      reason: patch.reason,
      previousVersion,
      newVersion,
      previousScope,
      newScope: structuredClone(authorization.scope),
      newStatus: patch.status ?? null,
      affectedFactRefs: affectedRefs
    })

    // 旧范围支持的关联事实立即失效、等待重新确认；其他事实照常
    const invalidatedByClaim = new Map<string, string[]>()
    for (const claim of state.claims) {
      for (const fact of claim.facts) {
        const linked = factRefs(fact).some((ref) => state.sharedSources.find((item) => item.id === ref.sourceId)?.authorizationNo === authorization.authNo)
        if (!linked) continue
        const reason = actuallyRevoked
          ? `授权 ${authorization.authNo} 已撤销，关联事实立即失效，等待重新确认`
          : `授权 ${authorization.authNo} 范围由 V${previousVersion} 变更为 V${newVersion}，旧范围支持的事实立即失效，等待重新确认`
        fact.awaitingReconfirm = true
        fact.invalidateReason = reason
        fact.invalidatedAt = authorization.updatedAt
        claim.updatedAt = authorization.updatedAt
        invalidatedByClaim.set(claim.id, [...(invalidatedByClaim.get(claim.id) ?? []), fact.id])
      }
    }

    for (const [claimId, factIds] of invalidatedByClaim) {
      state.audit.unshift(makeAudit(claimId, actuallyRevoked ? '授权撤销导致事实失效' : '授权范围变更导致事实失效', patch.changedBy, `${patch.reason}；受影响事实 ${factIds.join('、')} 已等待重新确认，其余事实照常；重认前停止导出`))
    }
    state.audit.unshift(makeAudit('共享来源库', actuallyRevoked ? '撤销授权' : '变更授权范围', patch.changedBy, `授权 ${authorization.authNo}${actuallyRevoked ? ' 已撤销' : ` V${previousVersion}→V${newVersion}`}；影响 ${affectedRefs.length} 处事实引用`))
  }

  /** 单个迁移步骤（幂等：共享来源已存在则复用、事实关联已存在则跳过、审计去重） */
  function runMigrationStep(state: ReturnType<typeof get>, step: MigrationStep, authorizationNo: string, operator: string, auditOut: AuditEntry[]): void {
    const claim = state.claims.find((item) => item.id === step.claimId)!
    const fact = claim.facts.find((item) => item.id === step.factId)!
    const bucket = step.kind === '支持证据' ? fact.legacySources! : fact.legacyCounterSources!
    const legacy = bucket.find((item) => item.title === step.legacyTitle)
    if (!legacy || step.done) return

    const authorization = state.authorizations.find((item) => item.authNo === authorizationNo)
    if (!authorization) throw new Error(`授权编号 ${authorizationNo} 不存在`)

    const existing = state.sharedSources.find((item) => item.contentHash === legacy.contentHash)
    const source: SourceRecord = existing ?? { ...legacy, id: nextId('S'), authorizationNo, capturedAt: nowIso(), version: 1 }
    if (!existing) state.sharedSources.unshift(source)

    const linked = step.kind === '支持证据' ? fact.sources : fact.counterSources
    if (!linked.includes(source.id)) linked.push(source.id)
    if (step.kind === '支持证据') fact.legacySources = bucket.filter((item) => item !== legacy)
    else fact.legacyCounterSources = bucket.filter((item) => item !== legacy)
    fact.confirmedScopeVersions = { ...(fact.confirmedScopeVersions ?? {}), [source.id]: authorization.scopeVersion }
    step.sharedSourceId = source.id
    step.authorizationId = authorization.id
    step.authorizationNo = authorizationNo
    step.done = true

    const dedupeKey = `旧稿迁移:${step.id}`
    if (!state.audit.some((item) => item.id === dedupeKey) && !auditOut.some((item) => item.id === dedupeKey)) {
      auditOut.push({ ...makeAudit(claim.id, '旧稿迁移补授权编号', operator, `${step.legacyTitle} 收入共享库并补录 ${authorizationNo}（${step.kind}）`), id: dedupeKey })
    }
  }

  /** 统一迁移入口：无检查点则新建；失败后从检查点恢复，只补未完成事实和审计 */
  function executeMigration(state: ReturnType<typeof get>, claimId: string, operator: string, failStep?: FailStep): OpResult {
    const claim = state.claims.find((item) => item.id === claimId)
    if (!claim) return { ok: false, message: '主张不存在' }
    if (claim.status === '已发布') return { ok: false, message: '已发布历史档案不可迁移、不改写' }

    let checkpoint = state.checkpoints.find((item) => item.steps.some((step) => step.claimId === claimId) && item.status !== '已完成')
    if (!checkpoint) {
      const steps = buildLegacySteps(claim)
      if (steps.length === 0) return { ok: false, message: '没有待迁移的旧稿内嵌来源' }
      const startedAt = nowIso()
      checkpoint = { id: nextId('CP'), startedAt, updatedAt: startedAt, status: '进行中', totalSteps: steps.length, completedSteps: 0, steps, log: [{ at: startedAt, message: `检查点建立：${steps.length} 个待迁移来源`, kind: 'info' }] }
      state.checkpoints.unshift(checkpoint)
      state.audit.unshift(makeAudit(claimId, '旧稿迁移开始', operator, `建立检查点 ${checkpoint.id}`))
    } else {
      checkpoint.log.push({ at: nowIso(), message: '从检查点恢复，仅执行未完成步骤与未记录审计', kind: 'info' })
    }

    const auditOut: AuditEntry[] = []
    let failed: MigrationStep | null = null
    for (const step of checkpoint.steps) {
      if (step.done) continue // 恢复时跳过已完成事实，不重复记录
      const authorizationNo = state.authorizations[0]?.authNo ?? 'AUTH-2026-018'
      if (failStep && step.factId === failStep.factId && step.kind === failStep.kind && step.legacyTitle === failStep.title) {
        failed = step
        checkpoint.status = '失败待恢复'
        checkpoint.updatedAt = nowIso()
        checkpoint.log.push({ at: checkpoint.updatedAt, message: `本机写入失败：${step.legacyTitle}（${step.kind}），检查点已保存`, kind: 'error' })
        state.audit.unshift(...auditOut)
        state.audit.unshift(makeAudit(claimId, '本机写入失败', operator, `迁移中断于 ${step.legacyTitle}，可从检查点 ${checkpoint.id} 恢复，只补未完成事实和审计`))
        set({ claims: [...state.claims], sharedSources: [...state.sharedSources], checkpoints: [...state.checkpoints], audit: [...state.audit] })
        return { ok: false, message: `本机写入失败，已保存检查点（${checkpoint.completedSteps}/${checkpoint.totalSteps}）；恢复时只补未完成事实和审计，不重复记录` }
      }
      try {
        runMigrationStep(state, step, authorizationNo, operator, auditOut)
        checkpoint.completedSteps = checkpoint.steps.filter((item) => item.done).length
        checkpoint.updatedAt = nowIso()
        checkpoint.log.push({ at: checkpoint.updatedAt, message: `已完成：${step.legacyTitle} → ${authorizationNo}`, kind: 'success' })
      } catch (error) {
        failed = step
        checkpoint.status = '失败待恢复'
        checkpoint.updatedAt = nowIso()
        checkpoint.log.push({ at: checkpoint.updatedAt, message: `写入异常：${(error as Error).message}`, kind: 'error' })
        break
      }
    }

    if (failed) {
      state.audit.unshift(...auditOut)
      set({ claims: [...state.claims], sharedSources: [...state.sharedSources], checkpoints: [...state.checkpoints], audit: [...state.audit] })
      return { ok: false, message: `写入异常，已保存检查点（${checkpoint.completedSteps}/${checkpoint.totalSteps}）` }
    }

    checkpoint.status = '已完成'
    checkpoint.updatedAt = nowIso()
    claim.migratedLegacy = true
    claim.migratedAt = checkpoint.updatedAt
    claim.migrationCheckpointId = checkpoint.id
    claim.version += 1
    claim.updatedAt = checkpoint.updatedAt
    state.versions.unshift({ id: nextId('V'), claimId, version: claim.version, editor: claim.editor, summary: '旧稿迁移：内嵌采访材料收入共享来源库并补授权编号，历史档案不改写。', changedFactIds: Array.from(new Set(checkpoint.steps.map((step) => step.factId))), removedEvidence: [], createdAt: checkpoint.updatedAt })
    state.audit.unshift(...auditOut)
    state.audit.unshift(makeAudit(claimId, '旧稿迁移完成', operator, `检查点 ${checkpoint.id}：${checkpoint.totalSteps} 个来源全部补授权编号；步骤与审计去重，不重复记录`))
    set({ claims: [...state.claims], sharedSources: [...state.sharedSources], checkpoints: [...state.checkpoints], versions: [...state.versions], audit: [...state.audit] })
    return { ok: true, message: `迁移完成：${checkpoint.totalSteps} 个来源已收入共享库并补授权编号` }
  }

  // —— 以下为对外 actions（具名函数 + 显式返回类型，避免 zustand v5 柯里重载对内联返回对象的推断问题）——

  function addClaim(input: { title: string; summary: string; reporter: string; priority: Claim['priority'] }): Claim {
    const now = nowIso()
    const claim: Claim = { id: nextId('FC'), ...input, editor: '宋卓', status: '核查中', createdAt: now, updatedAt: now, version: 1, facts: [] }
    set((state) => ({ claims: [claim, ...state.claims], audit: [makeAudit(claim.id, '建立核查主张', input.reporter, input.summary), ...state.audit] }))
    return claim
  }

  function addFact(claimId: string, text: string): void {
    set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      if (!claim || !text.trim()) return state
      claim.facts.push({ id: nextId('F'), text, conclusion: '证据不足', confidence: 30, unresolved: ['尚未关联来源'], sources: [], counterSources: [], annotations: [] })
      claim.version += 1
      claim.updatedAt = nowIso()
      return { claims: [...state.claims], audit: [makeAudit(claimId, '拆分可验证事实', claim.reporter, text), ...state.audit] }
    })
  }

  function updateFact(claimId: string, factId: string, patch: Partial<ClaimFact>): void {
    set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      const fact = claim?.facts.find((item) => item.id === factId)
      if (!claim || !fact) return state
      if (patch.conclusion && patch.conclusion !== '证据不足' && fact.unresolved.length) patch.confidence = Math.min(patch.confidence ?? fact.confidence, 75)
      Object.assign(fact, patch)
      claim.version += 1
      claim.updatedAt = nowIso()
      return { claims: [...state.claims], audit: [makeAudit(claimId, '更新事实结论', '当前用户', `${fact.text}：${fact.conclusion}`), ...state.audit] }
    })
  }

  function addAnnotation(claimId: string, factId: string, input: Omit<ClaimAnnotation, 'id' | 'createdAt' | 'resolved'>): void {
    set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      const fact = claim?.facts.find((item) => item.id === factId)
      if (!claim || !fact) return state
      fact.annotations.unshift({ ...input, id: nextId('N'), createdAt: nowIso(), resolved: false })
      return { claims: [...state.claims], audit: [makeAudit(claimId, '添加批注', input.author, input.content), ...state.audit] }
    })
  }

  function resolveAnnotation(claimId: string, factId: string, annotationId: string): void {
    set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      const annotation = claim?.facts.find((item) => item.id === factId)?.annotations.find((item) => item.id === annotationId)
      if (!claim || !annotation) return state
      annotation.resolved = true
      return { claims: [...state.claims], audit: [makeAudit(claimId, '解决批注', '当前用户', annotation.content), ...state.audit] }
    })
  }

  function addSharedSource(input: Omit<SourceRecord, 'id' | 'capturedAt' | 'version'>): SourceRecord {
    const source: SourceRecord = { ...input, id: nextId('S'), capturedAt: nowIso(), version: 1 }
    set((state) => ({ sharedSources: [source, ...state.sharedSources], audit: [makeAudit('共享来源库', '来源入库', '当前用户', `${input.title} 关联授权 ${input.authorizationNo ?? '未填写'}`), ...state.audit] }))
    return source
  }

  function linkSharedSource(claimId: string, factId: string, sourceId: string, counter: boolean): void {
    set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      const fact = claim?.facts.find((item) => item.id === factId)
      const source = state.sharedSources.find((item) => item.id === sourceId)
      if (!claim || !fact || !source) return state
      const list = counter ? fact.counterSources : fact.sources
      if (list.includes(sourceId)) return state
      list.push(sourceId)
      const authorization = state.authorizations.find((item) => item.authNo === source.authorizationNo)
      fact.confirmedScopeVersions = { ...(fact.confirmedScopeVersions ?? {}), [sourceId]: authorization?.scopeVersion ?? 1 }
      claim.version += 1
      claim.updatedAt = nowIso()
      return { claims: [...state.claims], audit: [makeAudit(claimId, counter ? '关联相反证据' : '关联共享来源', '当前用户', `${source.title}（授权 ${source.authorizationNo ?? '缺失'}，${counter ? '相反证据' : '支持证据'}）`), ...state.audit] }
    })
  }

  function changeAuthorization(authorizationId: string, patch: { scope?: AuthorizationScope; status?: Authorization['status']; reason: string; changedBy: string }): void {
    const state = get()
    const authorization = state.authorizations.find((item) => item.id === authorizationId || item.authNo === authorizationId)
    if (!authorization) return
    applyAuthorizationChange(state, authorization, patch)
    set({ claims: [...state.claims], sharedSources: [...state.sharedSources], authorizations: [...state.authorizations], scopeChanges: [...state.scopeChanges], audit: [...state.audit] })
  }

  function revokeAuthorizationsForClaim(claimId: string, operator: string, reason: string): void {
    const state = get()
    const claim = state.claims.find((item) => item.id === claimId)
    if (!claim) return
    const nos = linkedAuthNos(claim, state.sharedSources)
    for (const no of nos) {
      const authorization = state.authorizations.find((item) => item.authNo === no)
      if (authorization && authorization.status === '有效') applyAuthorizationChange(state, authorization, { status: '已撤销', reason, changedBy: operator })
    }
    set({ claims: [...state.claims], sharedSources: [...state.sharedSources], authorizations: [...state.authorizations], scopeChanges: [...state.scopeChanges], audit: [...state.audit] })
  }

  function reconfirmFact(claimId: string, factId: string, operator: string): OpResult {
    const state = get()
    const claim = state.claims.find((item) => item.id === claimId)
    const fact = claim?.facts.find((item) => item.id === factId)
    if (!claim || !fact) return { ok: false, message: '事实不存在' }
    const validity = factValidity(fact, state.authorizations, state.sharedSources)
    if (!validity.awaitingReconfirm) return { ok: false, message: '该事实当前授权范围有效，无需重认' }
    if (validity.invalid.some((item) => !item.authorization || item.authorization.status === '已撤销')) {
      return { ok: false, message: '存在已撤销或缺失的授权，无法重认，请先更换来源或恢复授权' }
    }
    const confirmed: Record<string, number> = {}
    for (const ref of factRefs(fact)) {
      const source = state.sharedSources.find((item) => item.id === ref.sourceId)
      const authorization = state.authorizations.find((item) => item.authNo === source?.authorizationNo)
      if (authorization) confirmed[ref.sourceId] = authorization.scopeVersion
    }
    fact.confirmedScopeVersions = confirmed
    fact.awaitingReconfirm = false
    fact.invalidateReason = undefined
    fact.invalidatedAt = undefined
    claim.version += 1
    claim.updatedAt = nowIso()
    set({ claims: [...state.claims], audit: [makeAudit(claimId, '事实重新确认授权范围', operator, `${fact.id} 已按当前授权版本重新确认，其他事实照常`), ...state.audit] })
    return { ok: true, message: `${fact.id} 已按当前授权范围重新确认` }
  }

  function beginPublishIntent(claimId: string, operator: string): void {
    const state = get()
    const claim = state.claims.find((item) => item.id === claimId)
    if (!claim) return
    const authVersions: Record<string, number> = {}
    const authStatus: Record<string, Authorization['status']> = {}
    for (const no of linkedAuthNos(claim, state.sharedSources)) {
      const authorization = state.authorizations.find((item) => item.authNo === no)
      if (authorization) {
        authVersions[no] = authorization.scopeVersion
        authStatus[no] = authorization.status
      }
    }
    set({ publishIntents: [{ claimId, operator, startedAt: nowIso(), authVersions, authStatus }, ...state.publishIntents.filter((item) => item.claimId !== claimId)] })
  }

  function publishClaim(claimId: string, operator: string, note: string): OpResult {
    const state = get()
    const claim = state.claims.find((item) => item.id === claimId)
    if (!claim) return { ok: false, message: '主张不存在' }

    // 撤权与发布两个窗口撞车：发布窗口占锁后授权被动过 → 发布一侧先停、回到复审（优先于常规校验）
    const intent = state.publishIntents.find((item) => item.claimId === claimId)
    if (intent) {
      const collisions: string[] = []
      for (const no of Object.keys(intent.authVersions)) {
        const authorization = state.authorizations.find((item) => item.authNo === no)
        if (!authorization) continue
        if (authorization.status === '已撤销') collisions.push(`授权 ${no} 已在撤权窗口撤销`)
        else if (authorization.scopeVersion > intent.authVersions[no]) collisions.push(`授权 ${no} 在发布窗口打开期间变更了范围`)
      }
      if (collisions.length) {
        claim.status = '待编辑复核'
        claim.updatedAt = nowIso()
        const reason = collisions.join('；')
        state.audit.unshift(makeAudit(claimId, '发布撞车先停复审', operator, `撤权/范围变更与发布窗口并发：${reason}；发布一侧已先停止并退回编辑复核，重认前停止导出`))
        set({ claims: [...state.claims], audit: [...state.audit], publishIntents: state.publishIntents.filter((item) => item.claimId !== claimId) })
        return { ok: false, message: `发布已先停：${reason}，已退回编辑复核` }
      }
    }

    const blocking = publishPreflight(claim, state.authorizations, state.sharedSources)
    if (blocking.length) return { ok: false, message: `发布前校验未通过：${blocking.join('；')}` }

    claim.status = '已发布'
    claim.version += 1
    claim.updatedAt = nowIso()
    state.versions.unshift({ id: nextId('V'), claimId, version: claim.version, editor: claim.editor || operator, summary: note, changedFactIds: claim.facts.map((fact) => fact.id), removedEvidence: [], createdAt: claim.updatedAt })
    const publishedClaim = structuredClone(claim)
    const archive: PublicationArchive = {
      id: nextId('PUB'),
      claimId,
      claimTitle: claim.title,
      publishedAt: claim.updatedAt,
      publishedBy: operator,
      claimVersion: claim.version,
      snapshot: publishedClaim,
      factSnapshots: publishedClaim.facts.map((fact) => ({
        fact: structuredClone(fact),
        sources: fact.sources.map((sourceId) => structuredClone(state.sharedSources.find((item) => item.id === sourceId)!)).filter(Boolean),
        counterSources: fact.counterSources.map((sourceId) => structuredClone(state.sharedSources.find((item) => item.id === sourceId)!)).filter(Boolean)
      })),
      auditIds: []
    }
    state.audit.unshift(makeAudit(claimId, '发布并锁定档案快照', operator, `正式版本 V${claim.version} 已发布，档案快照 ${archive.id} 锁定当时事实与来源；此后授权变化不影响本档案`))
    state.publications.unshift(archive)
    set({ claims: [...state.claims], versions: [...state.versions], audit: [...state.audit], publications: [...state.publications], publishIntents: state.publishIntents.filter((item) => item.claimId !== claimId) })
    return { ok: true, message: `已发布并锁定档案快照 ${archive.id}` }
  }

  function transitionClaim(claimId: string, status: Claim['status'], note: string): OpResult {
    const state = get()
    const claim = state.claims.find((item) => item.id === claimId)
    if (!claim) return { ok: false, message: '主张不存在' }
    if (status === '待编辑复核' && claim.facts.length === 0) return { ok: false, message: '至少需要一项可验证事实' }
    claim.status = status
    claim.version += 1
    claim.updatedAt = nowIso()
    if (status === '待编辑复核') beginPublishIntent(claimId, '当前用户')
    const version: VersionRecord = { id: nextId('V'), claimId, version: claim.version, editor: claim.editor || '当前用户', summary: note, changedFactIds: [], removedEvidence: [], createdAt: claim.updatedAt }
    set((current) => ({ claims: [...current.claims], versions: [version, ...current.versions], publishIntents: current.publishIntents, audit: [makeAudit(claimId, `状态流转：${status}`, '当前用户', note), ...current.audit] }))
    return { ok: true, message: `已流转至${status}` }
  }

  function migrateLegacyDraft(claimId: string, operator: string, failStep?: FailStep): OpResult {
    return executeMigration(get(), claimId, operator, failStep)
  }

  function resumeMigration(claimId: string, operator: string): OpResult {
    const checkpoint = get().checkpoints.find((item) => item.steps.some((step) => step.claimId === claimId) && item.status === '失败待恢复')
    if (!checkpoint) return { ok: false, message: '没有失败待恢复的检查点' }
    return executeMigration(get(), claimId, operator)
  }

  function recordExportAttempt(claimId: string, operator: string, blocked: boolean, detail: string): void {
    set((state) => ({ audit: [makeAudit(claimId, blocked ? '导出拦截：事实待重认' : '导出核查档案', operator, detail), ...state.audit] }))
  }

  function reset(): void {
    set({ ...seedState(), keyword: '', status: '全部' })
  }

  return {
    ...seedState(),
    keyword: '',
    status: '全部',
    setKeyword: (keyword) => set({ keyword }),
    setStatus: (status) => set({ status }),
    addClaim,
    updateFact,
    addFact,
    addAnnotation,
    resolveAnnotation,
    addSharedSource,
    linkSharedSource,
    changeAuthorization,
    reconfirmFact,
    transitionClaim,
    beginPublishIntent,
    publishClaim,
    migrateLegacyDraft,
    resumeMigration,
    revokeAuthorizationsForClaim,
    recordExportAttempt,
    reset
  }
}, {
  name: 'gsb68:fact-check-workbench',
  version: 2,
  // 旧持久化结构与新的共享库/授权模型不兼容：整体重置为种子状态
  migrate: () => seedState()
}))

/**
 * 跨窗口：其他标签页提交撤权/范围变更后，storage 事件携带其持久化结果。
 * 同步对方写入的授权与事实失效态；本窗口若正占着发布锁，提交发布时即撞车先停。
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== 'gsb68:fact-check-workbench' || !event.newValue) return
    try {
      const persisted = JSON.parse(event.newValue)?.state
      if (!persisted) return
      const current = useClaimStore.getState()
      const ownIntents = current.publishIntents
      useClaimStore.setState({
        claims: persisted.claims ?? current.claims,
        sharedSources: persisted.sharedSources ?? current.sharedSources,
        authorizations: persisted.authorizations ?? current.authorizations,
        scopeChanges: persisted.scopeChanges ?? current.scopeChanges,
        versions: persisted.versions ?? current.versions,
        audit: persisted.audit ?? current.audit,
        publications: persisted.publications ?? current.publications,
        checkpoints: persisted.checkpoints ?? current.checkpoints,
        // 发布占锁与本窗口的筛选条件保留，不被另一窗口覆盖
        publishIntents: ownIntents,
        keyword: current.keyword,
        status: current.status
      })
    } catch {
      // 持久化内容无法解析时忽略，等下一次同步
    }
  })
}

export { factValidity, claimInvalidFacts }

export const conclusionColor: Record<FactConclusion, string> = {
  已证实: 'green',
  部分属实: 'yellow',
  证据不足: 'orange',
  不实: 'red'
}
