import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { seedAudit, seedClaims, seedPublications, seedSources, seedVersions } from '../data/seed'
import type { AuditEntry, Claim, ClaimAnnotation, ClaimFact, FactConclusion, PublicationRecord, SharedSource, VersionRecord, WriteCheckpoint } from '../types'

export const conclusionColor: Record<FactConclusion, string> = {
  已证实: 'green',
  部分属实: 'yellow',
  证据不足: 'orange',
  不实: 'red'
}

interface NewSourceInput {
  title: string
  url: string
  publisher: string
  publishedAt: string
  kind: SharedSource['kind']
  chainOfCustody: string
  contentHash: string
  authorizationNo: string
  scope: string
  grantedBy: string
}

interface ClaimState {
  claims: Claim[]
  sourceLibrary: SharedSource[]
  versions: VersionRecord[]
  audit: AuditEntry[]
  publications: PublicationRecord[]
  checkpoint: WriteCheckpoint | null
  keyword: string
  status: Claim['status'] | '全部'
  setKeyword: (value: string) => void
  setStatus: (value: Claim['status'] | '全部') => void
  addClaim: (input: { title: string; summary: string; reporter: string; priority: Claim['priority'] }) => Claim
  updateFact: (claimId: string, factId: string, patch: Partial<ClaimFact>) => void
  addFact: (claimId: string, text: string) => void
  addAnnotation: (claimId: string, factId: string, annotation: Omit<ClaimAnnotation, 'id' | 'createdAt' | 'resolved'>) => void
  resolveAnnotation: (claimId: string, factId: string, annotationId: string) => void
  createSource: (claimId: string, factId: string, input: NewSourceInput, counter: boolean) => void
  linkSource: (claimId: string, factId: string, sourceId: string, counter: boolean) => void
  changeScope: (sourceId: string, newScope: string, reason: string) => { ok: boolean; message: string }
  revokeAuthorization: (sourceId: string, reason: string) => { ok: boolean; message: string }
  reconfirmFact: (claimId: string, factId: string) => { ok: boolean; message: string }
  backfillAuthorization: (sourceId: string, input: { authorizationNo: string; scope: string; grantedBy: string }) => { ok: boolean; message: string }
  transitionClaim: (claimId: string, status: Claim['status'], note: string) => { ok: boolean; message: string }
  resumePublication: (claimId: string, note: string) => { ok: boolean; message: string }
  startBulkImport: (claimId: string, texts: string[], crashAfter: number) => { ok: boolean; message: string }
  recoverCheckpoint: () => { ok: boolean; message: string }
  dismissCheckpoint: () => void
  reset: () => void
}

let idSeed = 100
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idSeed++}`

const nowIso = () => new Date().toISOString()

function makeAudit(claimId: string, action: string, operator: string, detail: string): AuditEntry {
  return { id: nextId('AUD'), claimId, action, operator, detail, createdAt: nowIso() }
}

/** 事实在当前授权状态下的问题；返回 null 表示授权链路正常 */
export function factAuthIssue(fact: ClaimFact, library: SharedSource[]): string | null {
  if (fact.authState === '待重认') return fact.authIssue ?? '支持来源授权范围已变更，等待重新确认'
  for (const sourceId of fact.sourceIds) {
    const source = library.find((item) => item.id === sourceId)
    if (!source) return '引用的共享来源已不存在'
    if (source.legacy || !source.authorization.authorizationNo) return `来源「${source.title}」为旧稿来源，授权编号待补录`
    if (source.authorization.status === '已撤权') return `来源「${source.title}」已撤权，不得用于发布`
    const confirmed = fact.confirmedAuthVersions[sourceId]
    if (confirmed === undefined || confirmed < source.authorization.version) {
      return `来源「${source.title}」授权范围已由 V${confirmed ?? 0} 变更为 V${source.authorization.version}，需要重新确认`
    }
  }
  return null
}

export function claimAuthBlockers(claim: Claim, library: SharedSource[]): string[] {
  return claim.facts.map((fact) => ({ fact, issue: factAuthIssue(fact, library) })).filter((item) => item.issue).map((item) => `${item.fact.id}：${item.issue}`)
}

export const useClaimStore = create<ClaimState>()(persist((set, get) => {
  /** 授权范围变更 / 撤权的级联：只失效“支持证据”引用，相反证据照常；已发布主张先停发复审 */
  function cascadeAuthorization(set: (partial: Partial<ClaimState>) => void, get: () => ClaimState, source: SharedSource, reason: string) {
    const state = get()
    const affected: Array<{ claimId: string; factId: string }> = []
    const claims = state.claims.map((claim) => {
      let claimTouched = false
      const facts = claim.facts.map((fact) => {
        if (!fact.sourceIds.includes(source.id)) return fact
        if (fact.authState === '待重认' && (fact.authIssue ?? '').includes(source.title)) return fact
        claimTouched = true
        affected.push({ claimId: claim.id, factId: fact.id })
        return {
          ...fact,
          authState: '待重认' as const,
          authIssue: reason.includes('撤权')
            ? `支持来源「${source.title}」已撤权（授权号 ${source.authorization.authorizationNo || '无'}），须移除或替换后重新确认`
            : `支持来源「${source.title}」授权范围变更为 V${source.authorization.version}，旧范围下的事实失效，等待重新确认`
        }
      })
      if (!claimTouched) return claim
      const next: Claim = { ...claim, facts, updatedAt: nowIso() }
      if (claim.status === '已发布') next.status = '停发复审'
      return next
    })

    const audits = [...state.audit]
    const touchedClaims = new Set(affected.map((item) => item.claimId))
    touchedClaims.forEach((claimId) => {
      const claim = claims.find((item) => item.id === claimId)
      const factIds = affected.filter((item) => item.claimId === claimId).map((item) => item.factId).join('、')
      audits.unshift(makeAudit(claimId, source.authorization.status === '已撤权' ? '撤权级联停发' : '授权变更级联失效', '法务', `${source.title}：${reason}；事实 ${factIds} 立即失效待重认${claim?.status === '停发复审' ? '，已发布版本先停发复审' : ''}`))
    })

    set({ claims, audit: audits })
  }

  return {
    claims: seedClaims,
    sourceLibrary: seedSources,
    versions: seedVersions,
    audit: seedAudit,
    publications: seedPublications,
    checkpoint: null,
    keyword: '',
    status: '全部',
    setKeyword: (keyword) => set({ keyword }),
    setStatus: (status) => set({ status }),

    addClaim: (input) => {
      const now = nowIso()
      const claim: Claim = { id: nextId('FC'), ...input, editor: '宋卓', status: '核查中', createdAt: now, updatedAt: now, version: 1, facts: [] }
      set((state) => ({ claims: [claim, ...state.claims], audit: [makeAudit(claim.id, '建立核查主张', input.reporter, input.summary), ...state.audit] }))
      return claim
    },

    addFact: (claimId, text) => set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      if (!claim || !text.trim()) return {}
      const fact: ClaimFact = { id: nextId('F'), text, conclusion: '证据不足', confidence: 30, unresolved: ['尚未关联来源'], sourceIds: [], counterSourceIds: [], annotations: [], authState: '已确认', confirmedAuthVersions: {} }
      const claims = state.claims.map((item) => item.id === claimId ? { ...item, facts: [...item.facts, fact], version: item.version + 1, updatedAt: nowIso() } : item)
      return { claims, audit: [makeAudit(claimId, '拆分可验证事实', claim.reporter, text), ...state.audit] }
    }),

    updateFact: (claimId, factId, patch) => set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      const fact = claim?.facts.find((item) => item.id === factId)
      if (!claim || !fact) return {}
      if (patch.conclusion && patch.conclusion !== '证据不足' && fact.unresolved.length) {
        patch.confidence = Math.min(patch.confidence ?? fact.confidence, 75)
      }
      const claims = state.claims.map((item) => item.id === claimId
        ? { ...item, facts: item.facts.map((f) => f.id === factId ? { ...f, ...patch } : f), version: item.version + 1, updatedAt: nowIso() }
        : item)
      const updated = claims.find((item) => item.id === claimId)!.facts.find((item) => item.id === factId)!
      return { claims, audit: [makeAudit(claimId, '更新事实结论', '当前用户', `${updated.text}：${updated.conclusion}`), ...state.audit] }
    }),

    addAnnotation: (claimId, factId, input) => set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      if (!claim) return {}
      const annotation: ClaimAnnotation = { ...input, id: nextId('N'), createdAt: nowIso(), resolved: false }
      const claims = state.claims.map((item) => item.id === claimId
        ? { ...item, facts: item.facts.map((fact) => fact.id === factId ? { ...fact, annotations: [annotation, ...fact.annotations] } : fact) }
        : item)
      return { claims, audit: [makeAudit(claimId, '添加批注', input.author, input.content), ...state.audit] }
    }),

    resolveAnnotation: (claimId, factId, annotationId) => set((state) => {
      const annotation = state.claims.find((item) => item.id === claimId)?.facts.find((item) => item.id === factId)?.annotations.find((item) => item.id === annotationId)
      if (!annotation) return {}
      const claims = state.claims.map((item) => item.id === claimId
        ? { ...item, facts: item.facts.map((fact) => fact.id === factId ? { ...fact, annotations: fact.annotations.map((note) => note.id === annotationId ? { ...note, resolved: true } : note) } : fact) }
        : item)
      return { claims, audit: [makeAudit(claimId, '解决批注', '当前用户', annotation.content), ...state.audit] }
    }),

    createSource: (claimId, factId, input, counter) => {
      const state = get()
      const claim = state.claims.find((item) => item.id === claimId)
      const fact = claim?.facts.find((item) => item.id === factId)
      if (!claim || !fact) return
      const existing = state.sourceLibrary.find((item) => item.title === input.title && item.url === input.url)
      if (existing) { get().linkSource(claimId, factId, existing.id, counter); return }
      const source: SharedSource = {
        id: nextId(counter ? 'C' : 'S'), title: input.title, url: input.url, publisher: input.publisher, publishedAt: input.publishedAt,
        capturedAt: nowIso(), kind: input.kind, chainOfCustody: input.chainOfCustody, contentHash: input.contentHash, version: 1,
        authorization: { authorizationNo: input.authorizationNo, scope: input.scope, grantedBy: input.grantedBy, grantedAt: nowIso().slice(0, 10), version: 1, status: '有效', history: [] },
        factRefs: [{ claimId, factId, counter }]
      }
      const claims = attachRef(state.claims, claimId, factId, source.id, counter, true, state.sourceLibrary.concat(source))
      set({ sourceLibrary: [source, ...state.sourceLibrary], claims, audit: [makeAudit(claimId, counter ? '保留相反证据（共享库）' : '关联来源（共享库）', '当前用户', `${input.title}，授权号 ${input.authorizationNo || '无'}`), ...state.audit] })
    },

    linkSource: (claimId, factId, sourceId, counter) => set((state) => {
      const claim = state.claims.find((item) => item.id === claimId)
      const fact = claim?.facts.find((item) => item.id === factId)
      const source = state.sourceLibrary.find((item) => item.id === sourceId)
      if (!claim || !fact || !source) return {}
      const listKey = counter ? 'counterSourceIds' : 'sourceIds'
      if (fact[listKey].includes(sourceId)) return {}
      const library = state.sourceLibrary.map((item) => item.id === sourceId ? { ...item, factRefs: item.factRefs.some((ref) => ref.claimId === claimId && ref.factId === factId) ? item.factRefs : [...item.factRefs, { claimId, factId, counter }] } : item)
      const claims = attachRef(state.claims, claimId, factId, sourceId, counter, false, library)
      return { sourceLibrary: library, claims, audit: [makeAudit(claimId, counter ? '引用共享相反证据' : '复用共享来源', '当前用户', `事实 ${factId} 引用共享库来源「${source.title}」（共被 ${library.find((item) => item.id === sourceId)!.factRefs.length} 处引用）`), ...state.audit] }
    }),

    changeScope: (sourceId, newScope, reason) => {
      const state = get()
      const source = state.sourceLibrary.find((item) => item.id === sourceId)
      if (!source) return { ok: false, message: '来源不存在' }
      if (!newScope.trim()) return { ok: false, message: '新授权范围不能为空' }
      const nextVersion = source.authorization.version + 1
      const library = state.sourceLibrary.map((item) => item.id === sourceId ? {
        ...item,
        authorization: {
          ...item.authorization,
          version: nextVersion,
          status: '范围变更待重认' as const,
          scope: newScope,
          history: [...item.authorization.history, { version: nextVersion, scope: newScope, changedAt: nowIso(), reason }]
        }
      } : item)
      set({ sourceLibrary: library })
      const updated = library.find((item) => item.id === sourceId)!
      cascadeAuthorization(set, get, updated, `法务改授权范围至 V${nextVersion}：${newScope}（原因：${reason || '未填写'}）`)
      return { ok: true, message: `授权范围已更新至 V${nextVersion}，关联事实已失效待重认，其他事实照常` }
    },

    revokeAuthorization: (sourceId, reason) => {
      const state = get()
      const source = state.sourceLibrary.find((item) => item.id === sourceId)
      if (!source) return { ok: false, message: '来源不存在' }
      if (source.authorization.status === '已撤权') return { ok: false, message: '该来源已处于撤权状态' }
      const library = state.sourceLibrary.map((item) => item.id === sourceId ? {
        ...item,
        authorization: {
          ...item.authorization,
          status: '已撤权' as const,
          history: [...item.authorization.history, { version: item.authorization.version + 1, scope: item.authorization.scope, changedAt: nowIso(), reason: `撤权：${reason}` }]
        }
      } : item)
      set({ sourceLibrary: library })
      cascadeAuthorization(set, get, library.find((item) => item.id === sourceId)!, `撤权：${reason || '未填写'}`)
      return { ok: true, message: '已撤权：关联事实立即失效，发布窗口一侧将先停发复审' }
    },

    reconfirmFact: (claimId, factId) => {
      const state = get()
      const claim = state.claims.find((item) => item.id === claimId)
      const fact = claim?.facts.find((item) => item.id === factId)
      if (!claim || !fact) return { ok: false, message: '事实不存在' }
      if (fact.authState !== '待重认') return { ok: false, message: '该事实不需要重新确认' }
      const revoked = fact.sourceIds.map((id) => state.sourceLibrary.find((item) => item.id === id)).filter((source): source is SharedSource => !!source && source.authorization.status === '已撤权')
      if (revoked.length) return { ok: false, message: `仍有已撤权来源：${revoked.map((item) => item.title).join('、')}，请先移除或替换` }
      const legacy = fact.sourceIds.map((id) => state.sourceLibrary.find((item) => item.id === id)).filter((source): source is SharedSource => !!source && (source.legacy || !source.authorization.authorizationNo))
      if (legacy.length) return { ok: false, message: `旧稿来源授权编号尚未补录：${legacy.map((item) => item.title).join('、')}` }

      const confirmedVersions: Record<string, number> = {}
      fact.sourceIds.forEach((id) => { const source = state.sourceLibrary.find((item) => item.id === id); if (source) confirmedVersions[id] = source.authorization.version })
      let library = state.sourceLibrary
      // 该来源下所有引用事实都重认后，来源状态恢复“有效”（历史版本记录保留）
      const claims = state.claims.map((item) => item.id === claimId
        ? { ...item, facts: item.facts.map((f) => f.id === factId ? { ...f, authState: '已确认' as const, authIssue: undefined, confirmedAuthVersions: { ...f.confirmedAuthVersions, ...confirmedVersions } } : f), updatedAt: nowIso() }
        : item)
      const stillWaiting = (sourceId: string) => claims.some((item) => item.facts.some((f) => f.sourceIds.includes(sourceId) && f.authState === '待重认'))
      library = library.map((source) => source.authorization.status === '范围变更待重认' && !stillWaiting(source.id) ? { ...source, authorization: { ...source.authorization, status: '有效' as const } } : source)
      set({ claims, sourceLibrary: library, audit: [makeAudit(claimId, '事实重新确认', '陆衡', `事实 ${factId} 按最新授权范围重新确认：${fact.text}`), ...state.audit] })
      return { ok: true, message: '事实已按当前授权范围重新确认' }
    },

    backfillAuthorization: (sourceId, input) => {
      const state = get()
      const source = state.sourceLibrary.find((item) => item.id === sourceId)
      if (!source) return { ok: false, message: '来源不存在' }
      if (!source.legacy && source.authorization.authorizationNo) return { ok: false, message: '该来源已有授权编号，不属于补录范围' }
      if (!input.authorizationNo.trim()) return { ok: false, message: '授权编号不能为空' }
      // 补录授权编号不是范围变更：不级联失效；事实确认版本对齐到补录后的 V1
      const library = state.sourceLibrary.map((item) => item.id === sourceId ? {
        ...item, legacy: false,
        authorization: { ...item.authorization, authorizationNo: input.authorizationNo, scope: input.scope || item.authorization.scope, grantedBy: input.grantedBy || '法务补录', version: 1, status: '有效' as const }
      } : item)
      const claims = state.claims.map((claim) => ({
        ...claim,
        facts: claim.facts.map((fact) => fact.sourceIds.includes(sourceId)
          ? { ...fact, confirmedAuthVersions: { ...fact.confirmedAuthVersions, [sourceId]: 1 } }
          : fact)
      }))
      const audits = source.factRefs.filter((ref) => !ref.counter).reduce< AuditEntry[]>((acc, ref) => [makeAudit(ref.claimId, '旧稿授权补录', '法务', `迁移来源「${source.title}」补授权编号 ${input.authorizationNo}；历史发布档案不改写`), ...acc], state.audit)
      set({ sourceLibrary: library, claims, audit: audits })
      return { ok: true, message: `已补录授权编号 ${input.authorizationNo}，历史档案保持原样不改写` }
    },

    transitionClaim: (claimId, status, note) => {
      const state = get()
      const claim = state.claims.find((item) => item.id === claimId)
      if (!claim) return { ok: false, message: '主张不存在' }
      if (status === '待编辑复核' && claim.facts.length === 0) return { ok: false, message: '至少需要一项可验证事实' }
      if (status === '已发布') {
        if (claim.status === '停发复审') return { ok: false, message: '撤权/授权变更撞车的主张须在复核队列完成重新发布，不能直接发布' }
        if (claim.facts.some((fact) => fact.conclusion === '证据不足' && fact.unresolved.length)) return { ok: false, message: '仍有未解决疑点，不能发布' }
        if (!claim.editor) return { ok: false, message: '缺少编辑复核人' }
        // 发布窗口一侧始终按最新授权状态复审：重认未完成即拦截（处理两个窗口撞车）
        const blockers = claimAuthBlockers(claim, state.sourceLibrary)
        if (blockers.length) return { ok: false, message: `授权复审未通过，发布先停：${blockers.join('；')}` }
        if (state.publications.some((pub) => pub.claimId === claimId && pub.status === '已锁定')) return { ok: false, message: '已存在锁定的发布档案；如授权已变化请走复审重新发布' }
      }
      const updatedAt = nowIso()
      const claims = state.claims.map((item) => item.id === claimId ? { ...item, status, version: item.version + 1, updatedAt } : item)
      const version: VersionRecord = { id: nextId('V'), claimId, version: claim.version + 1, editor: claim.editor || '当前用户', summary: note, changedFactIds: [], removedEvidence: [], createdAt: updatedAt }
      let publications = state.publications
      if (status === '已发布') {
        // 发布档案锁定当时快照：工作区数据此后变化不影响该档案
        const usedSources = state.sourceLibrary.filter((source) => claim.facts.some((fact) => fact.sourceIds.includes(source.id) || fact.counterSourceIds.includes(source.id)))
        publications = [{
          id: nextId('PB'), claimId, claimTitle: claim.title, version: claim.version + 1, publisher: claim.editor, publishedAt: updatedAt, status: '已锁定', note,
          snapshot: {
            claim: structuredClone(claims.find((item) => item.id === claimId)!),
            sources: structuredClone(usedSources),
            versions: structuredClone(state.versions.filter((item) => item.claimId === claimId).concat(version))
          }
        }, ...publications]
      }
      set({ claims, versions: [version, ...state.versions], publications, audit: [makeAudit(claimId, `状态流转：${status}`, '当前用户', note), ...state.audit] })
      return { ok: true, message: `已流转至${status}${status === '已发布' ? '，发布档案已锁定快照' : ''}` }
    },

    resumePublication: (claimId, note) => {
      const state = get()
      const claim = state.claims.find((item) => item.id === claimId)
      if (!claim) return { ok: false, message: '主张不存在' }
      if (claim.status !== '停发复审') return { ok: false, message: '只有停发复审中的主张需要复审发布' }
      if (claim.facts.some((fact) => fact.conclusion === '证据不足' && fact.unresolved.length)) return { ok: false, message: '仍有未解决疑点，不能重新发布' }
      const blockers = claimAuthBlockers(claim, state.sourceLibrary)
      if (blockers.length) return { ok: false, message: `仍有事实未完成重认：${blockers.join('；')}` }
      const updatedAt = nowIso()
      const claims = state.claims.map((item) => item.id === claimId ? { ...item, status: '已发布' as const, version: item.version + 1, updatedAt } : item)
      const version: VersionRecord = { id: nextId('V'), claimId, version: claim.version + 1, editor: claim.editor, summary: `复审通过重新发布。${note}`, changedFactIds: [], removedEvidence: [], createdAt: updatedAt }
      // 旧发布档案保持锁定不改写；产生一份新的当时快照
      const usedSources = state.sourceLibrary.filter((source) => claim.facts.some((fact) => fact.sourceIds.includes(source.id) || fact.counterSourceIds.includes(source.id)))
      const publications = [
        {
          id: nextId('PB'), claimId, claimTitle: claim.title, version: claim.version + 1, publisher: claim.editor, publishedAt: updatedAt, status: '已锁定' as const, note,
          snapshot: { claim: structuredClone(claims.find((item) => item.id === claimId)!), sources: structuredClone(usedSources), versions: structuredClone(state.versions.filter((item) => item.claimId === claimId).concat(version)) }
        },
        ...state.publications.map((pub) => pub.claimId === claimId && pub.status === '已锁定' ? { ...pub, status: '停发复审' as const } : pub)
      ]
      set({ claims, versions: [version, ...state.versions], publications, audit: [makeAudit(claimId, '复审通过重新发布', claim.editor, `重认完成后锁定新快照；旧发布档案不改写，标记停发。${note}`), ...state.audit] })
      return { ok: true, message: '复审通过，已锁定新的发布快照；旧档案保持原样' }
    },

    // 本机批量写入：先落检查点，再逐项写；中断后从检查点恢复，只补未完成事实和审计，不重复记录
    startBulkImport: (claimId, texts, crashAfter) => {
      const state = get()
      const claim = state.claims.find((item) => item.id === claimId)
      if (!claim) return { ok: false, message: '主张不存在' }
      if (state.checkpoint && !state.checkpoint.finished) return { ok: false, message: '存在未完成的本机写入检查点，请先恢复' }
      const items = texts.map((text) => text.trim()).filter(Boolean)
      if (!items.length) return { ok: false, message: '没有需要写入的事实' }
      const checkpoint: WriteCheckpoint = { id: nextId('CP'), kind: '批量补录事实', claimId, startedAt: nowIso(), completedItems: [], pendingItems: items, auditIds: [], finished: false }
      const partial = items.slice(0, Math.max(0, crashAfter))
      const audits = [...state.audit]
      const newFacts: ClaimFact[] = partial.map((text) => ({ id: nextId('F'), text, conclusion: '证据不足', confidence: 30, unresolved: ['尚未关联来源'], sourceIds: [], counterSourceIds: [], annotations: [], authState: '已确认', confirmedAuthVersions: {} }))
      partial.forEach((text) => {
        const entry = makeAudit(claimId, '批量补录事实（检查点写入）', '陆衡', text)
        checkpoint.auditIds.push(entry.id)
        audits.unshift(entry)
        checkpoint.completedItems.push(text)
      })
      const claims = state.claims.map((item) => item.id === claimId ? { ...item, facts: [...item.facts, ...newFacts], version: item.version + 1, updatedAt: nowIso() } : item)
      if (crashAfter >= items.length) checkpoint.finished = true
      set({ claims, audit: audits, checkpoint })
      return { ok: true, message: checkpoint.finished ? `批量写入完成，共 ${items.length} 条，检查点已关闭` : `本机写入在第 ${crashAfter + 1} 条失败，检查点已保留 ${partial.length} 条，待恢复` }
    },

    recoverCheckpoint: () => {
      const state = get()
      const cp = state.checkpoint
      if (!cp || cp.finished) return { ok: false, message: '没有待恢复的检查点' }
      const claim = state.claims.find((item) => item.id === cp.claimId)
      if (!claim) return { ok: false, message: '检查点对应主张不存在' }
      // 幂等：以已完成事实文本和审计 id 为准，只补未完成的部分
      const existingTexts = new Set(claim.facts.map((fact) => fact.text))
      const toWrite = cp.pendingItems.filter((text) => !cp.completedItems.includes(text) && !existingTexts.has(text))
      const newFacts: ClaimFact[] = toWrite.map((text) => ({ id: nextId('F'), text, conclusion: '证据不足', confidence: 30, unresolved: ['尚未关联来源'], sourceIds: [], counterSourceIds: [], annotations: [], authState: '已确认', confirmedAuthVersions: {} }))
      const newAudits = toWrite.map((text) => {
        const entry = makeAudit(cp.claimId, '批量补录事实（检查点恢复补写）', '陆衡', text)
        cp.auditIds.push(entry.id)
        cp.completedItems.push(text)
        return entry
      })
      const claims = state.claims.map((item) => item.id === cp.claimId ? { ...item, facts: [...item.facts, ...newFacts], version: item.version + 1, updatedAt: nowIso() } : item)
      const finished: WriteCheckpoint = { ...cp, finished: true }
      set({ claims, audit: [...newAudits, ...state.audit], checkpoint: finished })
      return { ok: true, message: toWrite.length ? `已从检查点恢复，补写 ${toWrite.length} 条事实及审计，未重复记录` : '检查点内容均已存在，未重复写入' }
    },

    dismissCheckpoint: () => set({ checkpoint: null }),

    reset: () => set({ claims: structuredClone(seedClaims), sourceLibrary: structuredClone(seedSources), versions: structuredClone(seedVersions), audit: structuredClone(seedAudit), publications: structuredClone(seedPublications), checkpoint: null, keyword: '', status: '全部' })
  }

  /** 把来源引用挂到事实上（支持/相反），并同步确认版本 */
  function attachRef(claims: Claim[], claimId: string, factId: string, sourceId: string, counter: boolean, isNew: boolean, library: SharedSource[]): Claim[] {
    return claims.map((claim) => claim.id !== claimId ? claim : {
      ...claim,
      version: claim.version + 1,
      updatedAt: nowIso(),
      facts: claim.facts.map((fact) => {
        if (fact.id !== factId) return fact
        if (counter) return { ...fact, counterSourceIds: [...fact.counterSourceIds, sourceId] }
        const source = library.find((item) => item.id === sourceId)
        return { ...fact, sourceIds: [...fact.sourceIds, sourceId], authState: '已确认', confirmedAuthVersions: { ...fact.confirmedAuthVersions, [sourceId]: source?.authorization.version ?? 1 }, ...(isNew ? {} : {}) }
      })
    })
  }
}, {
  name: 'gsb68:fact-check-workbench',
  version: 2,
  migrate: () => ({
    claims: structuredClone(seedClaims), sourceLibrary: structuredClone(seedSources), versions: structuredClone(seedVersions),
    audit: structuredClone(seedAudit), publications: structuredClone(seedPublications), checkpoint: null, keyword: '', status: '全部' as const
  })
}))

