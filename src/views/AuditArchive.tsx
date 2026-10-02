import { useMemo, useState } from 'react'
import { Badge, Box, Button, Flex, Input, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react'
import { useClaimStore } from '../store/useClaimStore'
import { claimInvalidFacts } from '../services/authorization'

function download(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function AuditArchive() {
  const state = useClaimStore()
  const [keyword, setKeyword] = useState('')
  const rows = useMemo(() => state.audit.filter((item) => `${item.claimId} ${item.action} ${item.operator} ${item.detail}`.toLowerCase().includes(keyword.toLowerCase())), [state.audit, keyword])
  // 全量导出遵循同一闸口：存在失效待重认事实时停止；已锁定档案可单独导出，不受影响
  const pendingClaims = state.claims.filter((claim) => claimInvalidFacts(claim, state.authorizations, state.sharedSources).length > 0)
  const fullExportLocked = pendingClaims.length > 0

  const exportAll = () => {
    if (fullExportLocked) { state.recordExportAttempt('全部档案', '宋卓', true, `待重认主张 ${pendingClaims.map((item) => item.id).join('、')}，重认前停止导出`); return }
    download('事实核查档案与审计.json', { generatedAt: new Date().toISOString(), claims: state.claims, sharedSources: state.sharedSources, authorizations: state.authorizations, scopeChanges: state.scopeChanges, versions: state.versions, audit: state.audit, publications: state.publications.map((item) => item.id), migrationCheckpoints: state.checkpoints })
    state.recordExportAttempt('全部档案', '宋卓', false, '导出全部档案（发布档案以锁定快照导出）')
  }
  const exportPublication = (publicationId: string) => {
    const publication = state.publications.find((item) => item.id === publicationId)
    if (!publication) return
    download(`${publication.claimId}-发布锁定档案-V${publication.claimVersion}.json`, { archive: '发布时锁定快照，此后授权与来源变更不改写本档案', ...publication })
    state.recordExportAttempt(publication.claimId, '宋卓', false, `导出锁定档案 ${publication.id}（不受待重认状态影响）`)
  }

  return <Box p="6" pb="16">
    <Flex justify="space-between" align="center" mb="5"><Box><Text fontSize="xs" color="gray.600">主张 / 授权变更 / 迁移检查点 / 发布版本 / 不可变审计</Text><Text fontSize="xl" fontWeight="700" mt="1">核查档案与审计</Text></Box><Button colorScheme="teal" isDisabled={fullExportLocked} onClick={exportAll}>{fullExportLocked ? '有待重认事实，停止导出全部' : '导出全部档案'}</Button></Flex>
    {fullExportLocked && <Box bg="red.50" borderWidth="1px" borderColor="red.300" p="3" mb="4"><Text fontSize="sm" color="red.700" fontWeight="600">重认前停止导出：{pendingClaims.map((claim) => `${claim.id}（${claimInvalidFacts(claim, state.authorizations, state.sharedSources).map((item) => item.fact.id).join('、')}）`).join('；')}</Text><Text fontSize="xs" color="red.600" mt="1">下方已发布档案锁定的是当时快照，仍可单独导出；历史档案不改写。</Text></Box>}

    <Text fontWeight="700" mb="2">已发布档案（发布当时锁定快照）</Text>
    <Box bg="white" borderWidth="1px" mb="5">
      <Table size="sm"><Thead><Tr><Th>档案号</Th><Th>主张</Th><Th>发布时间</Th><Th>发布人</Th><Th>锁定版本</Th><Th>快照事实数</Th><Th /></Tr></Thead><Tbody>
        {state.publications.map((publication) => <Tr key={publication.id}><Td fontFamily="mono" fontSize="xs">{publication.id}</Td><Td>{publication.claimTitle}</Td><Td fontSize="xs">{publication.publishedAt.replace('T', ' ').slice(0, 16)}</Td><Td>{publication.publishedBy}</Td><Td>V{publication.claimVersion}</Td><Td>{publication.factSnapshots.length}</Td><Td><Button size="xs" variant="outline" colorScheme="blue" onClick={() => exportPublication(publication.id)}>导出锁定快照</Button></Td></Tr>)}
      </Tbody></Table>
    </Box>

    {state.checkpoints.length > 0 && <>
      <Text fontWeight="700" mb="2">旧稿迁移检查点（本机写入失败后据此恢复，只补未完成）</Text>
      <Box bg="white" borderWidth="1px" mb="5">
        <Table size="sm"><Thead><Tr><Th>检查点</Th><Th>主张</Th><Th>状态</Th><Th>进度</Th><Th>最近日志</Th></Tr></Thead><Tbody>
          {state.checkpoints.map((checkpoint) => {
            const claimId = checkpoint.steps[0]?.claimId ?? ''
            return <Tr key={checkpoint.id}><Td fontFamily="mono" fontSize="xs">{checkpoint.id}</Td><Td fontFamily="mono" fontSize="xs">{claimId}</Td><Td><Badge colorScheme={checkpoint.status === '已完成' ? 'green' : 'red'}>{checkpoint.status}</Badge></Td><Td>{checkpoint.completedSteps}/{checkpoint.totalSteps}</Td><Td fontSize="xs" color="gray.600">{checkpoint.log[checkpoint.log.length - 1]?.message}</Td></Tr>
          })}
        </Tbody></Table>
      </Box>
    </>}

    <Flex gap="3" mb="3"><Input maxW="460px" placeholder="搜索主张、动作、操作人或说明" value={keyword} onChange={(event) => setKeyword(event.target.value)} /><Text alignSelf="center" fontSize="xs" color="gray.500">共{rows.length}条不可变审计事件</Text></Flex>
    <Box bg="white" borderWidth="1px"><Table size="sm"><Thead><Tr><Th>时间</Th><Th>对象</Th><Th>动作</Th><Th>操作人</Th><Th>说明</Th></Tr></Thead><Tbody>{rows.map((item) => <Tr key={item.id}><Td fontSize="xs">{item.createdAt.replace('T', ' ').slice(0, 16)}</Td><Td fontFamily="mono" fontSize="xs">{item.claimId}</Td><Td><Badge colorScheme={item.action.includes('撤销') || item.action.includes('失效') || item.action.includes('撞车') || item.action.includes('拦截') || item.action.includes('失败') ? 'red' : item.action.includes('发布') || item.action.includes('迁移') ? 'green' : item.action.includes('确认') ? 'purple' : 'blue'}>{item.action}</Badge></Td><Td>{item.operator}</Td><Td fontSize="sm">{item.detail}</Td></Tr>)}</Tbody></Table></Box>
    <Box mt="5" bg="white" borderWidth="1px" p="4"><Text fontWeight="700">版本与档案原则</Text><Text fontSize="sm" color="gray.600" mt="2">共享来源一改授权范围，旧范围支持的事实立即失效待重认，其他事实照常；发布档案锁定当时快照，重认前停止导出；旧稿迁移只补授权编号，历史档案不改写；迁移/审计按检查点去重，不重复记录。</Text></Box>
  </Box>
}
