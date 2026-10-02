import { useClaimStore, factAuthIssue } from '../src/store/useClaimStore'

let pass = 0; let fail = 0
const check = (name: string, cond: boolean, extra = '') => { if (cond) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }

const store = useClaimStore.getState()
const fresh = () => useClaimStore.getState()

// 1. 初始：F-4 / F-6 共享 S-6（采访材料），均已确认
check('初始 F-4 已确认授权', factAuthIssue(fresh().claims.find(c => c.id === 'FC-260928-03')!.facts.find(f => f.id === 'F-4')!, fresh().sourceLibrary) === null)
check('初始 F-6 已确认授权', factAuthIssue(fresh().claims.find(c => c.id === 'FC-260927-02')!.facts.find(f => f.id === 'F-6')!, fresh().sourceLibrary) === null)

// 2. 法务改 S-6 授权范围：F-4 与 F-6 立即失效，其他事实照常；已发布主张停发复审
const r1 = store.changeScope('S-6', '仅用于内部核验，不得署名直接引语', '受访人改变主意')
check('改范围返回成功', r1.ok)
const s2 = fresh()
const f4 = s2.claims.find(c => c.id === 'FC-260928-03')!.facts.find(f => f.id === 'F-4')!
const f6 = s2.claims.find(c => c.id === 'FC-260927-02')!.facts.find(f => f.id === 'F-6')!
check('F-4 待重认', f4.authState === '待重认')
check('F-6 待重认', f6.authState === '待重认')
check('已发布主张转为停发复审', s2.claims.find(c => c.id === 'FC-260927-02')!.status === '停发复审')
check('其他事实 F-1 不受影响', s2.claims.find(c => c.id === 'FC-260929-01')!.facts.find(f => f.id === 'F-1')!.authState === '已确认')
check('相反证据引用 C-1 的 F-2 不因授权变更（S-3未改）受影响', s2.claims.find(c => c.id === 'FC-260929-01')!.facts.find(f => f.id === 'F-2')!.authState === '已确认')
check('发布一侧撞车拦截：停发状态不能直接发布', store.transitionClaim('FC-260927-02', '已发布', '撞车测试').ok === false)

// 3. 历史发布快照不改写：PB-1 快照内 F-6 仍已确认、S-6 仍为 V1
const pb = fresh().publications.find(p => p.id === 'PB-1')!
check('发布快照内 F-6 仍已确认（不改写）', pb.snapshot.claim.facts.find(f => f.id === 'F-6')!.authState === '已确认')
check('发布快照内 S-6 仍为 V1（不改写）', pb.snapshot.sources.find(s => s.id === 'S-6')!.authorization.version === 1)
check('工作区 S-6 已 V2', fresh().sourceLibrary.find(s => s.id === 'S-6')!.authorization.version === 2)

// 4. 只重认 F-4：F-6 仍待重认；复审发布 F-6 所在主张应失败
const r4 = store.reconfirmFact('FC-260928-03', 'F-4')
check('F-4 重认成功', r4.ok)
check('F-4 重认后已确认且版本对齐V2', factAuthIssue(fresh().claims.find(c => c.id === 'FC-260928-03')!.facts.find(f => f.id === 'F-4')!, fresh().sourceLibrary) === null)
check('F-6 仍然待重认', fresh().claims.find(c => c.id === 'FC-260927-02')!.facts.find(f => f.id === 'F-6')!.authState === '待重认')
check('S-6 仍待重认状态（F-6未重认）', fresh().sourceLibrary.find(s => s.id === 'S-6')!.authorization.status === '范围变更待重认')
check('F-6 未重认时复审发布失败', store.resumePublication('FC-260927-02', 'x').ok === false)

// 5. 重认 F-6 后复审通过：新快照产生，旧 PB-1 标记停发且内容不改写
const r5a = store.reconfirmFact('FC-260927-02', 'F-6')
check('F-6 重认成功', r5a.ok)
const r5 = store.resumePublication('FC-260927-02', '重认完成')
check('复审重新发布成功', r5.ok, r5.message)
const after = fresh()
check('主张回到已发布', after.claims.find(c => c.id === 'FC-260927-02')!.status === '已发布')
const pb1 = after.publications.find(p => p.id === 'PB-1')!
check('旧档案 PB-1 标记停发复审', pb1.status === '停发复审')
check('旧档案快照仍为 V2 前版本（V1）', pb1.snapshot.sources.find(s => s.id === 'S-6')!.authorization.version === 1)
check('产生新的发布档案', after.publications.filter(p => p.claimId === 'FC-260927-02').length === 2)
check('新档案快照内 S-6 为 V2', after.publications[0].snapshot.sources.find(s => s.id === 'S-6')!.authorization.version === 2)

// 6. 撤权 S-3：F-2 失效，且重认被拒（须先移除）
const r6 = store.revokeAuthorization('S-3', '受访人撤回全部授权')
check('撤权成功', r6.ok)
check('F-2 待重认（撤权级联）', fresh().claims.find(c => c.id === 'FC-260929-01')!.facts.find(f => f.id === 'F-2')!.authState === '待重认')
const r6b = store.reconfirmFact('FC-260929-01', 'F-2')
check('撤权来源未移除前不能重认', r6b.ok === false)

// 7. 旧稿补授权编号：S-7 补录后 F-7 不再拦截；历史档案不产生改写（旧稿无发布档案）
const before7 = JSON.stringify(fresh().publications)
const r7 = store.backfillAuthorization('S-7', { authorizationNo: 'AUTH-2024-0815', scope: '旧稿采访笔记可用于内部核查', grantedBy: '受访人（法务回访补签）' })
check('旧稿补录成功', r7.ok)
check('补录后 F-7 无授权阻断', factAuthIssue(fresh().claims.find(c => c.id === 'FC-240815-07')!.facts.find(f => f.id === 'F-7')!, fresh().sourceLibrary) === null)
check('补录不触碰任何发布快照', JSON.stringify(fresh().publications) === before7)
check('已有授权编号的来源不能补录', store.backfillAuthorization('S-1', { authorizationNo: 'X', scope: '', grantedBy: '' }).ok === false)
check('补录产生审计', fresh().audit.some(a => a.action === '旧稿授权补录'))

// 8. 检查点：模拟第3条失败 -> 恢复只补未完成、不重复
store.reset()
const st = useClaimStore.getState()
const claimId = 'FC-260928-03'
const beforeFacts = st.claims.find(c => c.id === claimId)!.facts.length
const beforeAudit = st.audit.length
const r8 = st.startBulkImport(claimId, ['检查点事实A', '检查点事实B', '检查点事实C', '检查点事实D'], 2)
check('批量写入模拟失败成功落检查点', r8.ok && r8.message.includes('失败'), r8.message)
const mid = fresh()
check('已写入 2 条事实', mid.claims.find(c => c.id === claimId)!.facts.length === beforeFacts + 2)
check('检查点完成数为2', mid.checkpoint?.completedItems.length === 2)
check('检查点待办为4', mid.checkpoint?.pendingItems.length === 4)
const r9 = fresh().recoverCheckpoint()
check('恢复成功', r9.ok, r9.message)
const done = fresh()
check('恢复后共 4 条新事实', done.claims.find(c => c.id === claimId)!.facts.length === beforeFacts + 4)
check('恢复后审计只增加4条（含失败前2+恢复2，无重复）', done.audit.length === beforeAudit + 4)
check('检查点标记完成', done.checkpoint?.finished === true)
// 幂等：再恢复不应新增
const r10 = done.recoverCheckpoint()
check('已完成检查点再次恢复被拒', r10.ok === false)
// 模拟重复恢复：手工把 finished 置回 false，再恢复 -> 无新增
useClaimStore.setState({ checkpoint: { ...done.checkpoint!, finished: false } })
const factsBefore2 = fresh().claims.find(c => c.id === claimId)!.facts.length
const auditBefore2 = fresh().audit.length
const r11 = fresh().recoverCheckpoint()
check('崩溃后重放恢复不重复写入', r11.ok && fresh().claims.find(c => c.id === claimId)!.facts.length === factsBefore2 && fresh().audit.length === auditBefore2)

// 9. 未重认时发布校验阻断（新主张发布路径）
store.reset()
const s9 = useClaimStore.getState()
s9.changeScope('S-5', '仅周报正文可引用，附件禁用', '法务收窄')
const r9b = s9.transitionClaim('FC-260927-02', '已发布', '尝试发布')
check('停发复审主张直接发布被拒', r9b.ok === false)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
