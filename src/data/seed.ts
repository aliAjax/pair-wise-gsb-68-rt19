import type { AuditEntry, Claim, PublicationRecord, SharedSource, VersionRecord } from '../types'

export const seedSources: SharedSource[] = [
  {
    id: 'S-1', title: '一期工程环境影响报告表', url: 'https://example.gov.cn/report/2025-1102', publisher: '市生态环境局', publishedAt: '2025-11-02', capturedAt: '2026-09-29T08:40:00', kind: '原始证据', chainOfCustody: '官网下载PDF，哈希时间戳已记录', contentHash: 'sha256:9d31f1...a42c', version: 1,
    authorization: { authorizationNo: 'GK-2025-1102', scope: '政府主动公开信息，全文可引用', grantedBy: '市生态环境局（主动公开）', grantedAt: '2025-11-02', version: 1, status: '有效', history: [] },
    factRefs: [{ claimId: 'FC-260929-01', factId: 'F-1', counter: false }]
  },
  {
    id: 'S-2', title: '项目设备采购公告', url: 'https://example.com/tender/8821', publisher: '公共资源交易平台', publishedAt: '2026-01-18', capturedAt: '2026-09-29T08:52:00', kind: '原始证据', chainOfCustody: '官网页面快照与原始附件同时留存', contentHash: 'sha256:7bc029...de10', version: 2,
    authorization: { authorizationNo: 'GK-2026-0118', scope: '招标采购平台公开信息，可引用公告原文', grantedBy: '公共资源交易平台（主动公开）', grantedAt: '2026-01-18', version: 1, status: '有效', history: [] },
    factRefs: [{ claimId: 'FC-260929-01', factId: 'F-1', counter: false }]
  },
  {
    id: 'S-3', title: '匿名用户上传的验收文件局部截图', url: 'https://social.example/post/9901', publisher: '社交平台账号', publishedAt: '2026-09-28', capturedAt: '2026-09-29T09:05:00', kind: '待证信息', chainOfCustody: '已保存原帖与图片EXIF，待向主管部门核验', contentHash: 'sha256:1fe210...67bd', version: 1,
    authorization: { authorizationNo: 'AUTH-2026-0928-AN', scope: '仅授权内部核验，不得公开账号信息与原图', grantedBy: '匿名受访人', grantedAt: '2026-09-28', version: 1, status: '有效', history: [] },
    factRefs: [{ claimId: 'FC-260929-01', factId: 'F-2', counter: false }]
  },
  {
    id: 'S-4', title: '设备厂商技术白皮书', url: 'https://vendor.example/white-paper', publisher: '设备厂商', publishedAt: '2026-05-12', capturedAt: '2026-09-29T11:10:00', kind: '二次来源', chainOfCustody: '厂商官网PDF留存', contentHash: 'sha256:6a8d22...41ee', version: 1,
    authorization: { authorizationNo: 'GK-2026-0512', scope: '厂商公开发布资料，可标注出处引用', grantedBy: '设备厂商（官网公开）', grantedAt: '2026-05-12', version: 1, status: '有效', history: [] },
    factRefs: [{ claimId: 'FC-260929-01', factId: 'F-3', counter: false }]
  },
  {
    id: 'C-1', title: '储能系统招标文件仍列出柴发切换接口', url: 'https://example.com/tender/9102', publisher: '公共资源交易平台', publishedAt: '2026-03-04', capturedAt: '2026-09-29T14:10:00', kind: '原始证据', chainOfCustody: '附件原文留存，相关条款见第42页', contentHash: 'sha256:c7249a...001f', version: 1,
    authorization: { authorizationNo: 'GK-2026-0304', scope: '招标采购平台公开信息，可引用公告原文', grantedBy: '公共资源交易平台（主动公开）', grantedAt: '2026-03-04', version: 1, status: '有效', history: [] },
    factRefs: [{ claimId: 'FC-260929-01', factId: 'F-2', counter: true }]
  },
  {
    id: 'S-5', title: '市供水水质周报', url: 'https://example.gov.cn/water/0928', publisher: '市水务局', publishedAt: '2026-09-28', capturedAt: '2026-09-28T16:20:00', kind: '原始证据', chainOfCustody: '官网数据与PDF报告留存', contentHash: 'sha256:228a2...09cf', version: 1,
    authorization: { authorizationNo: 'GK-2026-0928', scope: '政府主动公开信息，全文可引用', grantedBy: '市水务局（主动公开）', grantedAt: '2026-09-28', version: 1, status: '有效', history: [] },
    factRefs: [{ claimId: 'FC-260928-03', factId: 'F-4', counter: false }, { claimId: 'FC-260927-02', factId: 'F-6', counter: false }]
  },
  {
    id: 'S-6', title: '周明采访录音整理稿（9月25日）', url: 'file://interview/zhouming-0925', publisher: '本台采访库', publishedAt: '2026-09-25', capturedAt: '2026-09-25T20:10:00', kind: '原始证据', chainOfCustody: '采访录音与逐字稿一并留档，受访人电话回访确认', contentHash: 'sha256:5b0e77...88a2', version: 1,
    authorization: { authorizationNo: 'AUTH-2026-0312', scope: '本人陈述用于供水异味系列报道，可署名直接引语', grantedBy: '受访人 周明（供水工程师）', grantedAt: '2026-09-25', version: 1, status: '有效', history: [] },
    factRefs: [{ claimId: 'FC-260928-03', factId: 'F-4', counter: false }, { claimId: 'FC-260927-02', factId: 'F-6', counter: false }]
  },
  {
    id: 'C-2', title: '上游排口在线监测与执法巡查记录', url: 'https://example.gov.cn/env/0929', publisher: '市生态环境局', publishedAt: '2026-09-29', capturedAt: '2026-09-29T12:00:00', kind: '原始证据', chainOfCustody: '官方接口导出CSV，记录数据签名', contentHash: 'sha256:ab45d...9c31', version: 1,
    authorization: { authorizationNo: 'GK-2026-0929', scope: '政府主动公开信息，全文可引用', grantedBy: '市生态环境局（主动公开）', grantedAt: '2026-09-29', version: 1, status: '有效', history: [] },
    factRefs: [{ claimId: 'FC-260928-03', factId: 'F-5', counter: true }]
  },
  {
    id: 'S-7', title: '2024年演练采访手写笔记扫描件', url: 'file://archive/drill-2024-notes', publisher: '本台旧稿资料库', publishedAt: '2024-08-15', capturedAt: '2024-08-15T15:30:00', kind: '原始证据', chainOfCustody: '旧稿纸箱编号A-17，扫描件迁移入共享库，授权编号待法务补录', contentHash: 'sha256:31c9d0...77be', version: 1, legacy: true,
    authorization: { authorizationNo: '', scope: '（旧稿来源，授权编号待补录）', grantedBy: '', grantedAt: '2024-08-15', version: 0, status: '有效', history: [] },
    factRefs: [{ claimId: 'FC-240815-07', factId: 'F-7', counter: false }]
  }
]

export const seedClaims: Claim[] = [
  {
    id: 'FC-260929-01', title: '某地新建数据中心停用全部柴油应急电源', summary: '社交平台流传项目验收文件截图，称数据中心取消柴油发电机改为纯储能供电。',
    reporter: '沈言', editor: '宋卓', status: '待编辑复核', priority: '高', createdAt: '2026-09-29T08:10:00', updatedAt: '2026-09-29T15:30:00', version: 4,
    facts: [
      {
        id: 'F-1', text: '项目规划文件中曾包含2台柴油发电机组。', conclusion: '已证实', confidence: 98, unresolved: [],
        sourceIds: ['S-1', 'S-2'], counterSourceIds: [],
        annotations: [{ id: 'N-1', author: '宋卓', role: '编辑', content: '请补充规划变更批复，不能用采购公告单独代表最终方案。', createdAt: '2026-09-29T10:20:00', resolved: false }],
        authState: '已确认', confirmedAuthVersions: { 'S-1': 1, 'S-2': 1 }
      },
      {
        id: 'F-2', text: '最终验收已取消柴油应急电源。', conclusion: '证据不足', confidence: 42, unresolved: ['缺少竣工验收备案原件', '网传截图无文件编号与签章页'],
        sourceIds: ['S-3'], counterSourceIds: ['C-1'],
        annotations: [{ id: 'N-2', author: '陆衡', role: '事实核查员', content: '该结论不得以匿名截图单独成立，需取得主管部门书面确认。', createdAt: '2026-09-29T14:25:00', resolved: false }],
        authState: '已确认', confirmedAuthVersions: { 'S-3': 1 }
      },
      {
        id: 'F-3', text: '纯储能方案足以覆盖消防和一级负荷供电。', conclusion: '证据不足', confidence: 31, unresolved: ['缺少负荷计算书', '缺少消防验收文件'],
        sourceIds: ['S-4'], counterSourceIds: [], annotations: [],
        authState: '已确认', confirmedAuthVersions: { 'S-4': 1 }
      }
    ]
  },
  {
    id: 'FC-260928-03', title: '城区供水异味来自河道藻类暴发', summary: '居民投诉自来水异味，网络传言指向上游工业排放，需核查水质报告与采样链。',
    reporter: '顾薇', editor: '宋卓', status: '核查中', priority: '中', createdAt: '2026-09-28T09:00:00', updatedAt: '2026-09-29T13:10:00', version: 2,
    facts: [
      { id: 'F-4', text: '多个采样点的2-甲基异莰醇检测值超过嗅阈值。', conclusion: '已证实', confidence: 93, unresolved: [], sourceIds: ['S-5', 'S-6'], counterSourceIds: [], annotations: [], authState: '已确认', confirmedAuthVersions: { 'S-5': 1, 'S-6': 1 } },
      { id: 'F-5', text: '异味由上游企业偷排直接造成。', conclusion: '不实', confidence: 88, unresolved: [], sourceIds: [], counterSourceIds: ['C-2'], annotations: [], authState: '已确认', confirmedAuthVersions: {} }
    ]
  },
  {
    id: 'FC-260927-02', title: '供水公司在投诉前已监测到嗅味异常', summary: '采访材料与官方周报显示运营方在公开投诉前已记录异味，报道追问信息披露时间线。',
    reporter: '顾薇', editor: '宋卓', status: '已发布', priority: '中', createdAt: '2026-09-26T10:00:00', updatedAt: '2026-09-27T18:00:00', version: 2,
    facts: [
      { id: 'F-6', text: '运营方在9月25日前的内部检测中已记录嗅味异常。', conclusion: '已证实', confidence: 90, unresolved: [], sourceIds: ['S-6', 'S-5'], counterSourceIds: [], annotations: [], authState: '已确认', confirmedAuthVersions: { 'S-6': 1, 'S-5': 1 } }
    ]
  },
  {
    id: 'FC-240815-07', title: '2024年供水应急演练物资调用记录（旧稿迁移）', summary: '旧稿库迁移的采访稿，事实仍引用旧来源，需由法务补录授权编号后才能继续使用。',
    reporter: '顾薇', editor: '宋卓', status: '核查中', priority: '低', createdAt: '2024-08-15T09:00:00', updatedAt: '2026-10-01T09:30:00', version: 1,
    facts: [
      { id: 'F-7', text: '2024年8月演练中调用的活性炭包数量为1200包。', conclusion: '部分属实', confidence: 65, unresolved: ['数字与通报口径差200包，待复核'], sourceIds: ['S-7'], counterSourceIds: [], annotations: [], authState: '已确认', confirmedAuthVersions: { 'S-7': 0 } }
    ]
  }
]

export const seedVersions: VersionRecord[] = [
  { id: 'V-1', claimId: 'FC-260929-01', version: 4, editor: '沈言', summary: '补充储能系统招标文件和相反证据，降低第二、第三项事实置信度。', changedFactIds: ['F-2', 'F-3'], removedEvidence: ['匿名聊天记录截图'], createdAt: '2026-09-29T15:30:00' },
  { id: 'V-2', claimId: 'FC-260929-01', version: 3, editor: '陆衡', summary: '补充匿名截图保管链和未解决疑点。', changedFactIds: ['F-2'], removedEvidence: [], createdAt: '2026-09-29T14:25:00' },
  { id: 'V-3', claimId: 'FC-260927-02', version: 2, editor: '宋卓', summary: '发布正式版本：内部检测时间线经受访人与周报交叉证实。', changedFactIds: ['F-6'], removedEvidence: [], createdAt: '2026-09-27T18:00:00' }
]

export const seedAudit: AuditEntry[] = [
  { id: 'A-1', claimId: 'FC-260929-01', action: '建立核查主张', operator: '沈言', detail: '创建3项可验证事实', createdAt: '2026-09-29T08:10:00' },
  { id: 'A-2', claimId: 'FC-260929-01', action: '关联原始证据', operator: '沈言', detail: '关联环评报告和设备采购公告', createdAt: '2026-09-29T08:55:00' },
  { id: 'A-3', claimId: 'FC-260929-01', action: '添加相反证据', operator: '陆衡', detail: '储能招标附件与纯储能结论冲突，保留争议', createdAt: '2026-09-29T14:10:00' },
  { id: 'A-4', claimId: 'FC-240815-07', action: '旧稿迁移', operator: '系统迁移任务', detail: '旧稿事实与来源 S-7 迁入共享库，授权编号待法务补录，历史档案不改写', createdAt: '2026-10-01T09:30:00' }
]

// 发布档案：发布时刻锁定的完整快照（含当时的来源对象），之后任何授权变更都不改写它
const publishedClaim = structuredClone(seedClaims.find((item) => item.id === 'FC-260927-02')!)
export const seedPublications: PublicationRecord[] = [
  {
    id: 'PB-1', claimId: 'FC-260927-02', claimTitle: publishedClaim.title, version: 2, publisher: '宋卓', publishedAt: '2026-09-27T18:05:00', status: '已锁定', note: '发布前校验通过：事实均有来源授权，无未解决疑点。',
    snapshot: {
      claim: publishedClaim,
      sources: structuredClone(seedSources.filter((source) => ['S-6', 'S-5'].includes(source.id))),
      versions: structuredClone(seedVersions.filter((version) => version.claimId === 'FC-260927-02'))
    }
  }
]
