import type { AuditEntry, Authorization, Claim, PublicationArchive, SourceRecord, VersionRecord } from '../types'

/** 共享来源库：采访材料一次入库，多条主张的多个事实复用同一记录 */
export const seedAuthorizations: Authorization[] = [
  {
    id: 'AUTH-2026-018',
    authNo: 'AUTH-2026-018',
    grantedBy: '法务 周岚',
    status: '有效',
    scopeVersion: 1,
    createdAt: '2025-10-01T09:00:00',
    updatedAt: '2025-10-01T09:00:00',
    scope: {
      topics: ['数据中心', '环境影响评价', '设备采购', '环境监测'],
      interviewees: [],
      usage: '可用于公开发布，须注明出处',
      validFrom: '2025-10-01',
      validTo: '2027-09-30'
    }
  },
  {
    id: 'AUTH-2026-021',
    authNo: 'AUTH-2026-021',
    grantedBy: '法务 周岚',
    status: '有效',
    scopeVersion: 1,
    createdAt: '2026-09-20T10:30:00',
    updatedAt: '2026-09-20T10:30:00',
    scope: {
      topics: ['应急电源', '储能', '竣工验收'],
      interviewees: ['项目知情人士（匿名）'],
      usage: '公开报道须匿名化处理，不得披露受访者身份信息',
      validFrom: '2026-09-20',
      validTo: '2026-12-31'
    }
  },
  {
    id: 'AUTH-2026-007',
    authNo: 'AUTH-2026-007',
    grantedBy: '法务 周岚',
    status: '有效',
    scopeVersion: 1,
    createdAt: '2026-01-05T09:00:00',
    updatedAt: '2026-01-05T09:00:00',
    scope: {
      topics: ['供水水质', '异味排查', '排口监测'],
      interviewees: [],
      usage: '可用于公开发布，须注明出处',
      validFrom: '2026-01-05',
      validTo: '2028-01-04'
    }
  }
]

export const seedSharedSources: SourceRecord[] = [
  { id: 'S-1', title: '一期工程环境影响报告表', url: 'https://example.gov.cn/report/2025-1102', publisher: '市生态环境局', publishedAt: '2025-11-02', capturedAt: '2026-09-29T08:40:00', kind: '原始证据', chainOfCustody: '官网下载PDF，哈希时间戳已记录', contentHash: 'sha256:9d31f1...a42c', version: 1, authorizationNo: 'AUTH-2026-018' },
  { id: 'S-2', title: '项目设备采购公告', url: 'https://example.com/tender/8821', publisher: '公共资源交易平台', publishedAt: '2026-01-18', capturedAt: '2026-09-29T08:52:00', kind: '原始证据', chainOfCustody: '官网页面快照与原始附件同时留存', contentHash: 'sha256:7bc029...de10', version: 2, authorizationNo: 'AUTH-2026-018' },
  { id: 'S-3', title: '匿名用户上传的验收文件局部截图', url: 'https://social.example/post/9901', publisher: '社交平台账号', publishedAt: '2026-09-28', capturedAt: '2026-09-29T09:05:00', kind: '待证信息', chainOfCustody: '已保存原帖与图片EXIF，待向主管部门核验', contentHash: 'sha256:1fe210...67bd', version: 1, authorizationNo: 'AUTH-2026-021' },
  { id: 'S-4', title: '设备厂商技术白皮书', url: 'https://vendor.example/white-paper', publisher: '设备厂商', publishedAt: '2026-05-12', capturedAt: '2026-09-29T11:10:00', kind: '二次来源', chainOfCustody: '厂商官网PDF留存', contentHash: 'sha256:6a8d22...41ee', version: 1, authorizationNo: 'AUTH-2026-021' },
  { id: 'S-5', title: '市供水水质周报', url: 'https://example.gov.cn/water/0928', publisher: '市水务局', publishedAt: '2026-09-28', capturedAt: '2026-09-28T16:20:00', kind: '原始证据', chainOfCustody: '官网数据与PDF报告留存', contentHash: 'sha256:228a2...09cf', version: 1, authorizationNo: 'AUTH-2026-007' },
  { id: 'C-1', title: '储能系统招标文件仍列出柴发切换接口', url: 'https://example.com/tender/9102', publisher: '公共资源交易平台', publishedAt: '2026-03-04', capturedAt: '2026-09-29T14:10:00', kind: '原始证据', chainOfCustody: '附件原文留存，相关条款见第42页', contentHash: 'sha256:c7249a...001f', version: 1, authorizationNo: 'AUTH-2026-018' },
  { id: 'C-2', title: '上游排口在线监测与执法巡查记录', url: 'https://example.gov.cn/env/0929', publisher: '市生态环境局', publishedAt: '2026-09-29', capturedAt: '2026-09-29T12:00:00', kind: '原始证据', chainOfCustody: '官方接口导出CSV，记录数据签名', contentHash: 'sha256:ab45d...9c31', version: 1, authorizationNo: 'AUTH-2026-007' }
]

export const seedClaims: Claim[] = [
  {
    id: 'FC-260929-01', title: '某地新建数据中心停用全部柴油应急电源', summary: '社交平台流传项目验收文件截图，称数据中心取消柴油发电机改为纯储能供电。',
    reporter: '沈言', editor: '宋卓', status: '待编辑复核', priority: '高', createdAt: '2026-09-29T08:10:00', updatedAt: '2026-09-29T15:30:00', version: 4,
    facts: [
      {
        id: 'F-1', text: '项目规划文件中曾包含2台柴油发电机组。', conclusion: '已证实', confidence: 98, unresolved: [],
        sources: ['S-1', 'S-2'], counterSources: [],
        confirmedScopeVersions: { 'S-1': 1, 'S-2': 1 },
        annotations: [{ id: 'N-1', author: '宋卓', role: '编辑', content: '请补充规划变更批复，不能用采购公告单独代表最终方案。', createdAt: '2026-09-29T10:20:00', resolved: false }]
      },
      {
        id: 'F-2', text: '最终验收已取消柴油应急电源。', conclusion: '证据不足', confidence: 42, unresolved: ['缺少竣工验收备案原件', '网传截图无文件编号与签章页'],
        sources: ['S-3'], counterSources: ['C-1'],
        confirmedScopeVersions: { 'S-3': 1, 'C-1': 1 },
        annotations: [{ id: 'N-2', author: '陆衡', role: '事实核查员', content: '该结论不得以匿名截图单独成立，需取得主管部门书面确认。', createdAt: '2026-09-29T14:25:00', resolved: false }]
      },
      {
        id: 'F-3', text: '纯储能方案足以覆盖消防和一级负荷供电。', conclusion: '证据不足', confidence: 31, unresolved: ['缺少负荷计算书', '缺少消防验收文件'],
        sources: ['S-4'], counterSources: [],
        confirmedScopeVersions: { 'S-4': 1 },
        annotations: []
      }
    ]
  },
  {
    id: 'FC-260928-03', title: '城区供水异味来自河道藻类暴发', summary: '居民投诉自来水异味，网络传言指向上游工业排放，需核查水质报告与采样链。',
    reporter: '顾薇', editor: '宋卓', status: '已发布', priority: '中', createdAt: '2026-09-28T09:00:00', updatedAt: '2026-09-29T18:00:00', version: 3,
    facts: [
      { id: 'F-4', text: '多个采样点的2-甲基异莰醇检测值超过嗅阈值。', conclusion: '已证实', confidence: 93, unresolved: [], sources: ['S-5'], counterSources: [], confirmedScopeVersions: { 'S-5': 1 }, annotations: [] },
      { id: 'F-5', text: '异味由上游企业偷排直接造成。', conclusion: '不实', confidence: 88, unresolved: [], sources: [], counterSources: ['C-2'], confirmedScopeVersions: { 'C-2': 1 }, annotations: [] }
    ]
  },
  {
    id: 'FC-260930-04', title: '城北高架声屏障改造招标被指提前内定', summary: '旧系统迁移来的核查草稿，采访材料仍内嵌在事实项下，尚未补授权编号。',
    reporter: '孟潮', editor: '宋卓', status: '核查中', priority: '高', createdAt: '2026-09-30T09:20:00', updatedAt: '2026-09-30T09:20:00', version: 1,
    migratedLegacy: false,
    facts: [
      {
        id: 'F-6', text: '招标公告发布前，投标方案已在多家供应商之间流传。', conclusion: '证据不足', confidence: 38, unresolved: ['聊天记录无法核验当事人身份'],
        sources: [], counterSources: [],
        legacySources: [
          { id: 'L-1', title: '供应商群聊截图（来源系统未编号）', url: 'https://social.example/thread/7720', publisher: '匿名聊天群', publishedAt: '2026-09-29', capturedAt: '2026-09-30T08:40:00', kind: '待证信息', chainOfCustody: '旧系统手工导出，未记录哈希时间戳', contentHash: 'sha256:legacy-aa10...77', version: 1 },
          { id: 'L-2', title: '声屏障改造工程招标公告', url: 'https://example.com/tender/9910', publisher: '公共资源交易平台', publishedAt: '2026-09-25', capturedAt: '2026-09-30T08:50:00', kind: '原始证据', chainOfCustody: '旧系统留存网页快照', contentHash: 'sha256:legacy-bb21...03', version: 1 }
        ],
        legacyCounterSources: [],
        annotations: []
      },
      {
        id: 'F-7', text: '中标供应商与招标代理机构存在共同股东。', conclusion: '部分属实', confidence: 56, unresolved: ['工商截图出具日期早于招标，需重新调取'],
        sources: [], counterSources: [],
        legacySources: [
          { id: 'L-3', title: '企业工商信息与股权穿透截图', url: 'https://credits.example/company/33081', publisher: '企业信用信息平台', publishedAt: '2026-09-20', capturedAt: '2026-09-30T09:05:00', kind: '原始证据', chainOfCustody: '旧系统截图留存，未补原始导出文件', contentHash: 'sha256:legacy-cc32...e8', version: 1 }
        ],
        legacyCounterSources: [],
        annotations: []
      }
    ]
  }
]

/** 已发布档案：发布当时锁定的快照，此后授权或来源变化均不改写 */
function sealPublished(claim: Claim, publishedAt: string, publishedBy: string): PublicationArchive {
  const sourceMap = new Map(seedSharedSources.map((item) => [item.id, item]))
  return {
    id: `PUB-${claim.id}`,
    claimId: claim.id,
    claimTitle: claim.title,
    publishedAt,
    publishedBy,
    claimVersion: claim.version,
    snapshot: structuredClone(claim),
    auditIds: ['A-4', 'A-5', 'A-6'],
    factSnapshots: claim.facts.map((fact) => ({
      fact: structuredClone(fact),
      sources: fact.sources.map((sourceId) => structuredClone(sourceMap.get(sourceId)!)).filter(Boolean),
      counterSources: fact.counterSources.map((sourceId) => structuredClone(sourceMap.get(sourceId)!)).filter(Boolean)
    }))
  }
}

export const seedPublications: PublicationArchive[] = [
  sealPublished(seedClaims[1] as Extract<Claim, { status: '已发布' }>, '2026-09-29T18:00:00', '宋卓')
]

export const seedVersions: VersionRecord[] = [
  { id: 'V-3', claimId: 'FC-260928-03', version: 3, editor: '宋卓', summary: '编辑复核通过，发布正式版本并锁定档案快照。', changedFactIds: ['F-4', 'F-5'], removedEvidence: [], createdAt: '2026-09-29T18:00:00' },
  { id: 'V-1', claimId: 'FC-260929-01', version: 4, editor: '沈言', summary: '补充储能系统招标文件和相反证据，降低第二、第三项事实置信度。', changedFactIds: ['F-2', 'F-3'], removedEvidence: ['匿名聊天记录截图'], createdAt: '2026-09-29T15:30:00' },
  { id: 'V-2', claimId: 'FC-260929-01', version: 3, editor: '陆衡', summary: '补充匿名截图保管链和未解决疑点。', changedFactIds: ['F-2'], removedEvidence: [], createdAt: '2026-09-29T14:25:00' }
]

export const seedAudit: AuditEntry[] = [
  { id: 'A-6', claimId: 'FC-260928-03', action: '发布并锁定档案快照', operator: '宋卓', detail: '正式版本 V3 已发布，档案快照 PUB-FC-260928-03 不可改写', createdAt: '2026-09-29T18:00:00' },
  { id: 'A-1', claimId: 'FC-260929-01', action: '建立核查主张', operator: '沈言', detail: '创建3项可验证事实', createdAt: '2026-09-29T08:10:00' },
  { id: 'A-2', claimId: 'FC-260929-01', action: '关联原始证据', operator: '沈言', detail: '从共享来源库关联环评报告和设备采购公告（AUTH-2026-018）', createdAt: '2026-09-29T08:55:00' },
  { id: 'A-3', claimId: 'FC-260929-01', action: '添加相反证据', operator: '陆衡', detail: '储能招标附件与纯储能结论冲突，保留争议', createdAt: '2026-09-29T14:10:00' },
  { id: 'A-4', claimId: 'FC-260928-03', action: '建立核查主张', operator: '顾薇', detail: '创建2项可验证事实并关联水质与排口监测来源', createdAt: '2026-09-28T09:10:00' },
  { id: 'A-5', claimId: 'FC-260928-03', action: '关联原始证据', operator: '顾薇', detail: '关联市供水水质周报（AUTH-2026-007）', createdAt: '2026-09-28T16:30:00' }
]
