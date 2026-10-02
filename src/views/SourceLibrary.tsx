import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Box, Button, Flex, FormControl, FormLabel, Grid, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Table, Tbody, Td, Text, Textarea, Th, Thead, Tr, useDisclosure, useToast } from '@chakra-ui/react'
import { useClaimStore } from '../store/useClaimStore'
import type { SharedSource } from '../types'

type ModalKind = 'scope' | 'revoke' | 'backfill' | null

export function SourceLibrary() {
  const navigate = useNavigate()
  const state = useClaimStore()
  const toast = useToast()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [kind, setKind] = useState<ModalKind>(null)
  const [scope, setScope] = useState('')
  const [reason, setReason] = useState('')
  const [backfill, setBackfill] = useState({ authorizationNo: '', scope: '', grantedBy: '法务' })
  const [filter, setFilter] = useState<'全部' | SharedSource['authorization']['status'] | '旧稿待补'>('全部')
  const active = state.sourceLibrary.find((item) => item.id === activeId)

  const open = (source: SharedSource, next: ModalKind) => {
    setActiveId(source.id); setKind(next)
    setScope(next === 'scope' ? source.authorization.scope : '')
    setReason('')
    setBackfill({ authorizationNo: '', scope: source.authorization.scope === '（旧稿来源，授权编号待补录）' ? '' : source.authorization.scope, grantedBy: '法务' })
  }
  const close = () => { setKind(null); setActiveId(null) }
  const submit = () => {
    if (!active) return
    const result = kind === 'scope'
      ? state.changeScope(active.id, scope, reason)
      : kind === 'revoke'
        ? state.revokeAuthorization(active.id, reason)
        : state.backfillAuthorization(active.id, backfill)
    toast({ title: result.message, status: result.ok ? 'success' : 'error' })
    if (result.ok) close()
  }

  const rows = state.sourceLibrary.filter((source) => {
    if (filter === '全部') return true
    if (filter === '旧稿待补') return source.legacy || !source.authorization.authorizationNo
    return source.authorization.status === filter
  })

  return <Box p="6" pb="16">
    <Box mb="5"><Text fontSize="xs" color="gray.600">共享来源库 / 授权范围 / 撤权 / 旧稿补录</Text><Text fontSize="xl" fontWeight="700" mt="1">共享来源与授权</Text><Text fontSize="sm" color="gray.600" mt="2">采访材料收入共享库后被多条事实复用；授权范围一改，旧范围支持的事实立即失效并等待重新确认，其他事实照常。</Text></Box>
    <Flex gap="3" mb="3" align="center">
      <Select maxW="200px" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>{['全部', '有效', '范围变更待重认', '已撤权', '旧稿待补'].map((value) => <option key={value}>{value}</option>)}</Select>
      <Text fontSize="xs" color="gray.500">共 {rows.length} 个共享来源 · 旧稿待补 {state.sourceLibrary.filter((s) => s.legacy || !s.authorization.authorizationNo).length}</Text>
    </Flex>
    <Box bg="white" borderWidth="1px">
      <Table size="sm">
        <Thead><Tr><Th>来源</Th><Th>类型</Th><Th>授权编号 / 范围</Th><Th>引用</Th><Th>授权状态</Th><Th>操作</Th></Tr></Thead>
        <Tbody>{rows.map((source) => {
          const support = source.factRefs.filter((ref) => !ref.counter).length
          const counter = source.factRefs.length - support
          const status = source.legacy || !source.authorization.authorizationNo ? '旧稿待补' : source.authorization.status
          return <Tr key={source.id}>
            <Td><Text fontWeight="600">{source.title}</Text><Text fontSize="xs" color="gray.500">{source.publisher} · {source.publishedAt} · {source.id}</Text><Text fontFamily="mono" fontSize="xs" color="gray.400">{source.contentHash}</Text></Td>
            <Td><Badge colorScheme={source.kind === '原始证据' ? 'green' : source.kind === '二次来源' ? 'orange' : 'gray'}>{source.kind}</Badge></Td>
            <Td maxW="280px"><Text fontFamily="mono" fontSize="xs" color={source.authorization.authorizationNo ? 'gray.700' : 'red.500'}>{source.authorization.authorizationNo || '（无授权编号）'}</Text><Text fontSize="xs" color="gray.500" noOfLines={2}>{source.authorization.scope}</Text><Text fontSize="xs" color="gray.400">V{source.authorization.version} · {source.authorization.grantedBy || '—'}</Text></Td>
            <Td>
              <Text fontSize="xs">支持 {support} · 相反 {counter}</Text>
              {source.factRefs.slice(0, 3).map((ref) => <Badge key={`${ref.claimId}-${ref.factId}-${ref.counter}`} as="button" onClick={() => navigate(`/claims/${ref.claimId}`)} colorScheme={ref.counter ? 'red' : 'teal'} variant="outline" mr="1" mt="1">{ref.factId}</Badge>)}
              {source.factRefs.length > 3 && <Text fontSize="xs" color="gray.400" mt="1">另 {source.factRefs.length - 3} 处</Text>}
            </Td>
            <Td><Badge colorScheme={status === '有效' ? 'green' : status === '已撤权' ? 'red' : status === '旧稿待补' ? 'purple' : 'orange'}>{status}</Badge></Td>
            <Td>
              <Flex gap="1">
                <Button size="xs" variant="outline" isDisabled={source.authorization.status === '已撤权'} onClick={() => open(source, 'scope')}>改授权范围</Button>
                <Button size="xs" variant="outline" colorScheme="red" isDisabled={source.authorization.status === '已撤权'} onClick={() => open(source, 'revoke')}>撤权</Button>
                {(source.legacy || !source.authorization.authorizationNo) && <Button size="xs" variant="solid" colorScheme="purple" onClick={() => open(source, 'backfill')}>补授权编号</Button>}
              </Flex>
            </Td>
          </Tr>
        })}</Tbody>
      </Table>
    </Box>

    <Modal isOpen={kind !== null} onClose={close}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{kind === 'scope' ? '法务修改授权范围' : kind === 'revoke' ? '撤销来源授权' : '旧稿迁移：补授权编号'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {active && <Box bg="gray.50" p="3" mb="4"><Text fontSize="sm" fontWeight="600">{active.title}</Text><Text fontSize="xs" color="gray.500">当前范围（V{active.authorization.version}）：{active.authorization.scope}</Text></Box>}
          {kind === 'backfill' ? <Grid gap="3">
            <FormControl><FormLabel fontSize="xs">授权编号</FormLabel><Input placeholder="AUTH-YYYY-XXXX" value={backfill.authorizationNo} onChange={(event) => setBackfill({ ...backfill, authorizationNo: event.target.value })} /></FormControl>
            <FormControl><FormLabel fontSize="xs">授权范围</FormLabel><Textarea rows={2} value={backfill.scope} onChange={(event) => setBackfill({ ...backfill, scope: event.target.value })} /></FormControl>
            <FormControl><FormLabel fontSize="xs">授权方</FormLabel><Input value={backfill.grantedBy} onChange={(event) => setBackfill({ ...backfill, grantedBy: event.target.value })} /></FormControl>
            <Text fontSize="xs" color="purple.600">仅补录共享库来源；历史发布档案不改写。</Text>
          </Grid> : <Grid gap="3">
            {kind === 'scope' && <FormControl><FormLabel fontSize="xs">新授权范围</FormLabel><Textarea rows={3} value={scope} onChange={(event) => setScope(event.target.value)} /></FormControl>}
            <FormControl><FormLabel fontSize="xs">{kind === 'revoke' ? '撤权原因' : '变更原因'}</FormLabel><Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></FormControl>
            <Text fontSize="xs" color="orange.600">{kind === 'revoke'
              ? '撤权后引用该来源的事实立即失效；发布窗口一侧先停发复审，重认前停止导出。'
              : '保存后引用该来源的支持事实立即失效待重认（相反证据与其他事实照常），已发布主张转为停发复审。'}</Text>
          </Grid>}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr="3" onClick={close}>取消</Button>
          <Button colorScheme={kind === 'revoke' ? 'red' : kind === 'backfill' ? 'purple' : 'teal'} onClick={submit} isDisabled={kind === 'scope' ? !scope.trim() : kind === 'backfill' ? !backfill.authorizationNo.trim() : false}>{kind === 'scope' ? '保存并级联失效' : kind === 'revoke' ? '确认撤权' : '补录编号'}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  </Box>
}
