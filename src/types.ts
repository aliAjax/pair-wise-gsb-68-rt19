export type ClaimStatus = '核查中' | '待编辑复核' | '停发复审' | '已发布' | '已撤回'
export type FactConclusion = '已证实' | '部分属实' | '证据不足' | '不实'
export type EvidenceKind = '原始证据' | '二次来源' | '待证信息'
export type AuthorizationStatus = '有效' | '范围变更待重认' | '已撤权'
export type FactAuthState = '已确认' | '待重认'

export interface AuthorizationInfo {
  /** 授权编号；旧稿来源在迁移补录前为空 */
  authorizationNo: string
  scope: string
  grantedBy: string
  grantedAt: string
  /** 授权范围版本，范围变更时 +1，用于与事实重认时的版本做比对（撞车检测） */
  version: number
  status: AuthorizationStatus
  /** 历史授权范围留痕，只增不改 */
  history: Array<{ version: number; scope: string; changedAt: string; reason: string }>
}

export interface SharedSource {
  id: string
  title: string
  url: string
  publisher: string
  publishedAt: string
  capturedAt: string
  kind: EvidenceKind
  chainOfCustody: string
  contentHash: string
  /** 留档版本（同一标题的来源文件版本，与授权范围版本相互独立） */
  version: number
  supersededBy?: string
  /** 旧稿迁移来源：授权编号补录前为 true */
  legacy?: boolean
  authorization: AuthorizationInfo
  /** 被哪些事实的支持/相反证据引用（共享库维护） */
  factRefs: Array<{ claimId: string; factId: string; counter: boolean }>
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
  /** 支持证据：引用共享来源库 */
  sourceIds: string[]
  /** 相反证据：引用共享来源库 */
  counterSourceIds: string[]
  annotations: ClaimAnnotation[]
  /** 授权确认状态：授权范围变更后引用该来源的事实立即失效，等待重新确认 */
  authState: FactAuthState
  /** 事实最近一次确认时，各支持来源的授权版本；用于发布撞车检测 */
  confirmedAuthVersions: Record<string, number>
  /** 待重认原因（哪些来源的授权发生了什么） */
  authIssue?: string
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

/**
 * 发布档案：发布时刻的完整快照，锁定后不再改写。
 * 授权范围变更只影响工作区当前数据，历史快照保持发布时原样。
 */
export interface PublicationRecord {
  id: string
  claimId: string
  claimTitle: string
  version: number
  publisher: string
  publishedAt: string
  status: '已锁定' | '停发复审'
  note: string
  snapshot: {
    claim: Claim
    sources: SharedSource[]
    versions: VersionRecord[]
  }
}

/** 本机写入检查点：批量写入中断后从检查点恢复，只补未完成部分，不重复记录 */
export interface WriteCheckpoint {
  id: string
  kind: '批量补录事实'
  claimId: string
  startedAt: string
  /** 已完成写入的事实文本（顺序），恢复时据此跳过 */
  completedItems: string[]
  /** 本次写入的全部待办事实文本，随检查点持久化，恢复时据此只补未完成项 */
  pendingItems: string[]
  /** 已写入的审计条目 id，恢复时不重复记录 */
  auditIds: string[]
  finished: boolean
}
