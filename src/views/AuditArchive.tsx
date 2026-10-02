import { useState } from 'react'
import { Badge, Box, Button, Flex, Input, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react'
import { useClaimStore } from '../store/useClaimStore'
import type { PublicationRecord } from '../types'

export function AuditArchive() {
  const state = useClaimStore()
  const [keyword, setKeyword] = useState('')
  const rows = state.audit.filter((item) => `${item.claimId} ${item.action} ${item.operator} ${item.detail}`.toLowerCase().includes(keyword.toLowerCase()))
  const exportAll = () => {
    const payload = { generatedAt: new Date().toISOString(), claims: state.claims, sources: state.sourceLibrary, versions: state.versions, publications: state.publications, audit: state.audit }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = '事实核查档案与审计.json'; anchor.click(); URL.revokeObjectURL(url)
  }
  const exportPublication = (pub: PublicationRecord) => {
    const payload = { archiveNote: '发布时刻锁定快照，授权范围后续变更不改写本档案', exportedAt: new Date().toISOString(), publication: pub }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${pub.claimId}-V${pub.version}-发布快照.json`; anchor.click(); URL.revokeObjectURL(url)
  }
  return <Box p="6" pb="16">
    <Flex justify="space-between" align="center" mb="5"><Box><Text fontSize="xs" color="gray.600">主张 / 授权级联 / 批注 / 发布快照 / 旧稿补录</Text><Text fontSize="xl" fontWeight="700" mt="1">核查档案与审计</Text></Box><Button colorScheme="teal" onClick={exportAll}>导出全部档案</Button></Flex>

    <Text fontWeight="700" mb="2">发布档案（锁定当时快照）</Text>
    <Box bg="white" borderWidth="1px" mb="6"><Table size="sm"><Thead><Tr><Th>发布档案</Th><Th>主张</Th><Th>版本</Th><Th>发布时间</Th><Th>发布人</Th><Th>状态</Th><Th /></Tr></Thead><Tbody>{state.publications.map((pub) => <Tr key={pub.id} opacity={pub.status === '已锁定' ? 1 : 0.75}>
      <Td fontFamily="mono" fontSize="xs">{pub.id}</Td>
      <Td><Text fontWeight="600" fontSize="sm">{pub.claimTitle}</Text><Text fontFamily="mono" fontSize="xs" color="gray.500">{pub.claimId}</Text></Td>
      <Td>V{pub.version}</Td>
      <Td fontSize="xs">{pub.publishedAt.replace('T', ' ').slice(0, 16)}</Td>
      <Td>{pub.publisher}</Td>
      <Td><Badge colorScheme={pub.status === '已锁定' ? 'green' : 'red'}>{pub.status}</Badge></Td>
      <Td><Button size="xs" variant="outline" onClick={() => exportPublication(pub)}>导出锁定快照</Button></Td>
    </Tr>)}</Tbody></Table></Box>

    <Flex gap="3" mb="3"><Input maxW="460px" placeholder="搜索主张、动作、操作人或说明" value={keyword} onChange={(event) => setKeyword(event.target.value)} /><Text alignSelf="center" fontSize="xs" color="gray.500">共{rows.length}条不可变审计事件</Text></Flex>
    <Box bg="white" borderWidth="1px"><Table size="sm"><Thead><Tr><Th>时间</Th><Th>主张</Th><Th>动作</Th><Th>操作人</Th><Th>说明</Th></Tr></Thead><Tbody>{rows.map((item) => <Tr key={item.id}><Td fontSize="xs">{item.createdAt.replace('T', ' ').slice(0, 16)}</Td><Td fontFamily="mono" fontSize="xs">{item.claimId}</Td><Td><Badge colorScheme={item.action.includes('撤权') || item.action.includes('停发') ? 'red' : item.action.includes('发布') || item.action.includes('重认') ? 'green' : item.action.includes('补录') || item.action.includes('迁移') ? 'purple' : 'blue'}>{item.action}</Badge></Td><Td>{item.operator}</Td><Td fontSize="sm">{item.detail}</Td></Tr>)}</Tbody></Table></Box>
    <Box mt="5" bg="white" borderWidth="1px" p="4"><Text fontWeight="700">版本差异与授权原则</Text><Text fontSize="sm" color="gray.600" mt="2">发布档案锁定当时快照，授权范围变更只让工作区事实失效待重认，历史发布档案不改写；旧稿迁移仅向共享库来源补授权编号；撤权与发布撞车时发布一侧先停复审，重认前停止导出；被替换证据仍保留在版本记录中，不能隐藏相反证据或覆盖既有批注。</Text></Box>
  </Box>
}
