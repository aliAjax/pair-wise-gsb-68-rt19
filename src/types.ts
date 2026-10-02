export type ClaimStatus = '核查中' | '待编辑复核' | '已发布' | '已撤回'
export type FactConclusion = '已证实' | '部分属实' | '证据不足' | '不实'
export type EvidenceKind = '原始证据' | '二次来源' | '待证信息'
export type AuthorizationStatus = '有效' | '已撤销'

/** 授权范围：法务维护，任何一次范围改动都会抬升 scopeVersion 并使旧范围支持的事实失效 */
export interface AuthorizationScope {
  topics: string[]
  interviewees: string[]
  usage: string
  validFrom: string
  validTo: string
}

export interface Authorization {
  id: string
  /** 授权编号，旧稿迁移时补录到共享来源上 */
  authNo: string
  grantedBy: string
  scope: AuthorizationScope
  status: AuthorizationStatus
  scopeVersion: number
  createdAt: string
  updatedAt: string
}

/** 一次授权范围/状态改动的留痕 */
export interface AuthorizationScopeChange {
  id: string
  authorizationId: string
  authNo: string
  changedAt: string
  changedBy: string
  reason: string
  previousVersion: number
  newVersion: number
  previousScope: AuthorizationScope | null
  newScope: AuthorizationScope | null
  newStatus: AuthorizationStatus | null
  affectedFactRefs: string[]
}

export interface SourceRecord {
  id: string
  title: string
  url: string
  publisher: string
  publishedAt: string
  capturedAt: string
  kind: EvidenceKind
  chainOfCustody: string
  contentHash: string
  version: number
  supersededBy?: string
  /** 共享库来源对应的授权编号；旧稿内嵌来源迁移前为空，迁移时补录 */
  authorizationNo?: string
}

export interface ClaimAnnotation {
  id: string
  author: string
  role: '记者' | '编辑' | '事实核查员'
  content: string
  createdAt: string
  resolved: boolean
}

export interface ClaimFact {
  id: string
  text: string
  conclusion: FactConclusion
  confidence: number
  unresolved: string[]
  /** 关联共享库来源（支持证据），只存 id */
  sources: string[]
  /** 关联共享库来源（相反证据），只存 id */
  counterSources: string[]
  /** 旧稿迁移前的内嵌支持证据，迁移后清空 */
  legacySources?: SourceRecord[]
  /** 旧稿迁移前的内嵌相反证据，迁移后清空 */
  legacyCounterSources?: SourceRecord[]
  /** 来源授权 -> 事实确认时所依据的 scopeVersion；低于当前版本即失效待重认 */
  confirmedScopeVersions?: Record<string, number>
  awaitingReconfirm?: boolean
  invalidateReason?: string
  invalidatedAt?: string
  annotations: ClaimAnnotation[]
}

export interface Claim {
  id: string
  title: string
  summary: string
  reporter: string
  editor: string
  status: ClaimStatus
  priority: '低' | '中' | '高'
  createdAt: string
  updatedAt: string
  version: number
  facts: ClaimFact[]
  /** 由旧系统草稿迁移补授权编号而来 */
  migratedLegacy?: boolean
  migratedAt?: string
  migrationCheckpointId?: string
}

export interface VersionRecord {
  id: string
  claimId: string
  version: number
  editor: string
  summary: string
  changedFactIds: string[]
  removedEvidence: string[]
  createdAt: string
}

export interface AuditEntry {
  id: string
  claimId: string
  action: string
  operator: string
  detail: string
  createdAt: string
}

/** 发布时锁定的单条事实及其来源记录快照 */
export interface PublishedFactSnapshot {
  fact: ClaimFact
  sources: SourceRecord[]
  counterSources: SourceRecord[]
}

/** 发布时锁定的不可变档案快照 */
export interface PublicationArchive {
  id: string
  claimId: string
  claimTitle: string
  publishedAt: string
  publishedBy: string
  claimVersion: number
  snapshot: Claim
  factSnapshots: PublishedFactSnapshot[]
  auditIds: string[]
}

/** 旧稿迁移检查点：按事实-来源粒度记录步骤，失败后只补未完成步骤 */
export interface MigrationStep {
  id: string
  claimId: string
  factId: string
  kind: '支持证据' | '相反证据'
  legacyTitle: string
  sharedSourceId: string
  authorizationId: string
  authorizationNo: string
  done: boolean
}

export interface MigrationCheckpoint {
  id: string
  startedAt: string
  updatedAt: string
  status: '进行中' | '失败待恢复' | '已完成'
  totalSteps: number
  completedSteps: number
  steps: MigrationStep[]
  log: { at: string; message: string; kind: 'info' | 'error' | 'success' }[]
}
