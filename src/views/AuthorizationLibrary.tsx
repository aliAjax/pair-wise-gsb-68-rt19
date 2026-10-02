import { useState } from 'react'
import { Badge, Box, Button, Divider, Flex, FormControl, FormLabel, Grid, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Table, Tbody, Td, Text, Textarea, Th, Thead, Tr, useDisclosure, useToast } from '@chakra-ui/react'
import { useClaimStore } from '../store/useClaimStore'
import type { Authorization, AuthorizationScope, EvidenceKind } from '../types'

export function AuthorizationLibrary() {
  const state = useClaimStore()
  const toast = useToast()
  const scopeModal = useDisclosure()
  const sourceModal = useDisclosure()
  const [editing, setEditing] = useState<Authorization | null>(null)
  const [scopeForm, setScopeForm] = useState<Omit<AuthorizationScope, 'topics' | 'interviewees'> & { topics: string; interviewees: string }>({ topics: '', interviewees: '', usage: '', validFrom: '', validTo: '' })
  const [reason, setReason] = useState('')
  const [sourceForm, setSourceForm] = useState({ title: '', url: '', publisher: '', publishedAt: '2026-09-30', kind: '原始证据' as EvidenceKind, chainOfCustody: '', contentHash: '', authorizationNo: state.authorizations[0]?.authNo ?? '' })

  const openScope = (authorization: Authorization) => {
    setEditing(authorization)
    setScopeForm({ topics: authorization.scope.topics.join('、'), interviewees: authorization.scope.interviewees.join('、'), usage: authorization.scope.usage, validFrom: authorization.scope.validFrom, validTo: authorization.scope.validTo })
    setReason('')
    scopeModal.onOpen()
  }
  const submitScope = (revoke = false) => {
    if (!editing) return
    if (!revoke && !reason.trim()) { toast({ title: '请填写范围变更原因（法务留痕）', status: 'warning' }); return }
    state.changeAuthorization(editing.id, revoke
      ? { status: '已撤销', reason: reason.trim() || '法务撤销授权', changedBy: '法务 周岚' }
      : { scope: { ...scopeForm, topics: toList(scopeForm.topics), interviewees: toList(scopeForm.interviewees) }, reason: reason.trim(), changedBy: '法务 周岚' })
    toast({ title: revoke ? '授权已撤销，关联事实立即失效待重认' : '授权范围已变更，旧范围支持的事实立即失效待重认', status: 'success' })
    scopeModal.onClose()
  }
  const addSource = () => {
    if (!sourceForm.title || !sourceForm.url || !sourceForm.authorizationNo) { toast({ title: '标题、地址与授权编号必填', status: 'warning' }); return }
    state.addSharedSource({ ...sourceForm, supersededBy: undefined })
    sourceModal.onClose()
    setSourceForm({ ...sourceForm, title: '', url: '', publisher: '', chainOfCustody: '', contentHash: '' })
    toast({ title: '来源已入库，可被多个事实复用', status: 'success' })
  }

  return <Box p="6" pb="16">
    <Box mb="5"><Text fontSize="xs" color="gray.600">法务授权 / 共享采访材料 / 范围版本</Text><Text fontSize="xl" fontWeight="700" mt="1">授权与共享来源库</Text><Text fontSize="sm" color="gray.600" mt="2" maxW="860px">采访材料一次入库、多条主张复用；法务改动授权范围后，旧范围支持的关联事实立即失效并等待重新确认，其他事实照常。已发布档案锁定当时快照，不受后续范围变更影响。</Text></Box>

    <Flex justify="space-between" align="center" mb="3"><Text fontWeight="700">授权登记</Text><Badge colorScheme="teal">{state.authorizations.length} 项授权 · 范围变更全程留痕</Badge></Flex>
    <Grid templateColumns="repeat(3,1fr)" gap="3" mb="6">
      {state.authorizations.map((authorization) => {
        const usedCount = state.sharedSources.filter((source) => source.authorizationNo === authorization.authNo).length
        return <Box key={authorization.id} bg="white" borderWidth="1px" p="4" opacity={authorization.status === '已撤销' ? 0.65 : 1}>
          <Flex justify="space-between" align="center"><Text fontFamily="mono" fontSize="xs" color="gray.500">{authorization.authNo}</Text><Badge colorScheme={authorization.status === '已撤销' ? 'red' : 'green'}>{authorization.status} V{authorization.scopeVersion}</Badge></Flex>
          <Text fontSize="sm" mt="2">{authorization.grantedBy}</Text>
          <Box mt="2" fontSize="xs" color="gray.700">
            <Text>授权主题：{authorization.scope.topics.join('、')}</Text>
            {authorization.scope.interviewees.length > 0 && <Text mt="1">受访者：{authorization.scope.interviewees.join('、')}</Text>}
            <Text mt="1">用途：{authorization.scope.usage}</Text>
            <Text mt="1" color="gray.500">有效期 {authorization.scope.validFrom} ~ {authorization.scope.validTo}</Text>
          </Box>
          <Divider my="2" />
          <Flex justify="space-between" align="center"><Text fontSize="xs" color="gray.500">共享来源 {usedCount} 条</Text><Flex gap="2"><Button size="xs" variant="outline" onClick={() => openScope(authorization)}>改授权范围</Button>{authorization.status === '有效' && <Button size="xs" colorScheme="red" variant="ghost" onClick={() => openScope(authorization)}>撤权</Button>}</Flex></Flex>
        </Box>
      })}
    </Grid>

    <Flex justify="space-between" align="center" mb="3"><Text fontWeight="700">共享来源库</Text><Button size="sm" colorScheme="teal" onClick={() => { setSourceForm({ ...sourceForm, authorizationNo: state.authorizations.find((item) => item.status === '有效')?.authNo ?? '' }); sourceModal.onOpen() }}>来源入库并登记授权编号</Button></Flex>
    <Box bg="white" borderWidth="1px" mb="6">
      <Table size="sm">
        <Thead><Tr><Th>编号</Th><Th>标题</Th><Th>发布机构</Th><Th>类型</Th><Th>授权编号</Th><Th>内容哈希</Th><Th>留档</Th></Tr></Thead>
        <Tbody>{state.sharedSources.map((source) => {
          const authorization = state.authorizations.find((item) => item.authNo === source.authorizationNo)
          return <Tr key={source.id}><Td fontFamily="mono" fontSize="xs">{source.id}</Td><Td><Text fontWeight="600" fontSize="sm">{source.title}</Text><Text fontSize="xs" color="blue.600" wordBreak="break-all">{source.url}</Text></Td><Td fontSize="xs">{source.publisher}</Td><Td><Badge colorScheme={source.kind === '原始证据' ? 'green' : source.kind === '二次来源' ? 'orange' : 'gray'}>{source.kind}</Badge></Td><Td><Badge colorScheme={authorization?.status === '已撤销' ? 'red' : 'purple'}>{source.authorizationNo ?? '未补授权编号'}</Badge></Td><Td fontFamily="mono" fontSize="xs">{source.contentHash}</Td><Td fontSize="xs" color="gray.600" maxW="220px">{source.chainOfCustody}</Td></Tr>
        })}</Tbody>
      </Table>
    </Box>

    <Text fontWeight="700" mb="3">授权范围变更记录</Text>
    {state.scopeChanges.length === 0 && <Box bg="white" borderWidth="1px" p="4"><Text fontSize="sm" color="gray.500">尚无范围变更。法务一旦改范围或撤权，旧范围支持的事实立即失效，此处与审计同步留痕。</Text></Box>}
    <Flex direction="column" gap="2">
      {state.scopeChanges.map((change) => <Box key={change.id} bg="white" borderWidth="1px" p="3" borderLeftWidth="4px" borderLeftColor={change.newStatus === '已撤销' ? 'red.400' : 'orange.400'}>
        <Flex justify="space-between"><Text fontSize="sm" fontWeight="700">{change.authNo} · V{change.previousVersion} → V{change.newVersion}{change.newStatus === '已撤销' && ' · 已撤销'}</Text><Text fontSize="xs" color="gray.500">{change.changedAt.replace('T', ' ').slice(0, 16)} · {change.changedBy}</Text></Flex>
        <Text fontSize="sm" mt="1">{change.reason}</Text>
        <Text fontSize="xs" color="gray.600" mt="1">受影响事实引用 {change.affectedFactRefs.length} 处：{change.affectedFactRefs.slice(0, 4).join('；')}{change.affectedFactRefs.length > 4 ? ' 等' : ''}</Text>
      </Box>)}
    </Flex>

    <Modal isOpen={scopeModal.isOpen} onClose={scopeModal.onClose} size="xl"><ModalOverlay /><ModalContent><ModalHeader>变更授权范围 · {editing?.authNo} <Badge ml="2" colorScheme="purple">当前 V{editing?.scopeVersion}</Badge></ModalHeader><ModalCloseButton /><ModalBody>
      <Grid templateColumns="1fr 1fr" gap="3">
        <FormControl><FormLabel fontSize="xs">授权主题（、分隔）</FormLabel><Input value={scopeForm.topics} onChange={(event) => setScopeForm({ ...scopeForm, topics: event.target.value })} /></FormControl>
        <FormControl><FormLabel fontSize="xs">受访者（、分隔，匿名可保留）</FormLabel><Input value={scopeForm.interviewees} onChange={(event) => setScopeForm({ ...scopeForm, interviewees: event.target.value })} /></FormControl>
        <FormControl gridColumn="1 / span 2"><FormLabel fontSize="xs">授权用途与限制</FormLabel><Input value={scopeForm.usage} onChange={(event) => setScopeForm({ ...scopeForm, usage: event.target.value })} /></FormControl>
        <FormControl><FormLabel fontSize="xs">生效日</FormLabel><Input value={scopeForm.validFrom} onChange={(event) => setScopeForm({ ...scopeForm, validFrom: event.target.value })} /></FormControl>
        <FormControl><FormLabel fontSize="xs">截止日</FormLabel><Input value={scopeForm.validTo} onChange={(event) => setScopeForm({ ...scopeForm, validTo: event.target.value })} /></FormControl>
      </Grid>
      <FormControl mt="4"><FormLabel fontSize="xs">变更/撤权原因（法务留痕，审计必录）</FormLabel><Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="例：补充协议缩小了公开用途，采访不得用于商业衍生发布" /></FormControl>
      <Text fontSize="xs" color="red.600" mt="2">保存后 scopeVersion 抬升，旧范围确认过的关联事实立即失效等待重新确认；其他事实照常，重认前停止导出。</Text>
    </ModalBody><ModalFooter><Button variant="ghost" mr="auto" colorScheme="red" isDisabled={editing?.status === '已撤销'} onClick={() => submitScope(true)}>撤销该授权</Button><Button variant="ghost" mr="2" onClick={scopeModal.onClose}>取消</Button><Button colorScheme="teal" onClick={() => submitScope(false)}>保存新范围并联动失效</Button></ModalFooter></ModalContent></Modal>

    <Modal isOpen={sourceModal.isOpen} onClose={sourceModal.onClose} size="xl"><ModalOverlay /><ModalContent><ModalHeader>共享来源入库</ModalHeader><ModalCloseButton /><ModalBody><Grid templateColumns="1fr 1fr" gap="3">
      <FormControl><FormLabel>来源标题</FormLabel><Input value={sourceForm.title} onChange={(event) => setSourceForm({ ...sourceForm, title: event.target.value })} /></FormControl>
      <FormControl><FormLabel>公开地址</FormLabel><Input value={sourceForm.url} onChange={(event) => setSourceForm({ ...sourceForm, url: event.target.value })} /></FormControl>
      <FormControl><FormLabel>发布机构</FormLabel><Input value={sourceForm.publisher} onChange={(event) => setSourceForm({ ...sourceForm, publisher: event.target.value })} /></FormControl>
      <FormControl><FormLabel>证据类型</FormLabel><Select value={sourceForm.kind} onChange={(event) => setSourceForm({ ...sourceForm, kind: event.target.value as EvidenceKind })}>{['原始证据', '二次来源', '待证信息'].map((value) => <option key={value}>{value}</option>)}</Select></FormControl>
      <FormControl><FormLabel>授权编号</FormLabel><Select value={sourceForm.authorizationNo} onChange={(event) => setSourceForm({ ...sourceForm, authorizationNo: event.target.value })}>{state.authorizations.map((item) => <option key={item.id} value={item.authNo} disabled={item.status === '已撤销'}>{item.authNo}（{item.status} V{item.scopeVersion}）</option>)}</Select></FormControl>
      <FormControl><FormLabel>发布日期</FormLabel><Input value={sourceForm.publishedAt} onChange={(event) => setSourceForm({ ...sourceForm, publishedAt: event.target.value })} /></FormControl>
      <FormControl><FormLabel>内容哈希</FormLabel><Input placeholder="sha256:..." value={sourceForm.contentHash} onChange={(event) => setSourceForm({ ...sourceForm, contentHash: event.target.value })} /></FormControl>
      <FormControl><FormLabel>保管链说明</FormLabel><Input value={sourceForm.chainOfCustody} onChange={(event) => setSourceForm({ ...sourceForm, chainOfCustody: event.target.value })} /></FormControl>
    </Grid></ModalBody><ModalFooter><Button variant="ghost" mr="3" onClick={sourceModal.onClose}>取消</Button><Button colorScheme="teal" isDisabled={!sourceForm.title || !sourceForm.url} onClick={addSource}>入库</Button></ModalFooter></ModalContent></Modal>
  </Box>
}

function toList(value: string): string[] {
  return value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean)
}
