import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Badge, Box, Button, Divider, Flex, FormControl, FormLabel, Grid, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Tab, TabList, TabPanel, TabPanels, Tabs, Text, Textarea, useDisclosure, useToast } from '@chakra-ui/react'
import { EvidenceGraph } from '../components/EvidenceGraph'
import { conclusionColor, factAuthIssue, useClaimStore } from '../store/useClaimStore'
import { preflightPublish } from '../services/api'
import type { ClaimFact, EvidenceKind, FactConclusion, SharedSource } from '../types'

export function ClaimWorkspace() {
  const { id } = useParams()
  const toast = useToast()
  const state = useClaimStore()
  const claim = state.claims.find((item) => item.id === id)
  const [selectedFactId, setSelectedFactId] = useState(claim?.facts[0]?.id ?? '')
  const selectedFact = claim?.facts.find((item) => item.id === selectedFactId) ?? claim?.facts[0]
  const [factText, setFactText] = useState('')
  const sourceModal = useDisclosure()
  const linkModal = useDisclosure()
  const versionModal = useDisclosure()
  const bulkModal = useDisclosure()
  const [counterSource, setCounterSource] = useState(false)
  const [transitionNote, setTransitionNote] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [sourceForm, setSourceForm] = useState({ title: '', url: '', publisher: '', publishedAt: '2026-09-29', kind: '原始证据' as EvidenceKind, chainOfCustody: '', contentHash: '', authorizationNo: '', scope: '', grantedBy: '' })

  if (!claim) return <Box p="10">未找到核查主张</Box>
  const resolve = (sourceId: string) => state.sourceLibrary.find((item) => item.id === sourceId)
  const setFact = (patch: Partial<ClaimFact>) => { if (selectedFact) state.updateFact(claim.id, selectedFact.id, patch) }
  const createSource = () => {
    if (!selectedFact || !sourceForm.title || !sourceForm.url || !sourceForm.authorizationNo) return
    state.createSource(claim.id, selectedFact.id, sourceForm, counterSource)
    sourceModal.onClose()
    setSourceForm({ title: '', url: '', publisher: '', publishedAt: '2026-09-29', kind: '原始证据', chainOfCustody: '', contentHash: '', authorizationNo: '', scope: '', grantedBy: '' })
    toast({ title: '来源已收入共享库并加入关系图', status: 'success' })
  }
  const linkSource = (sourceId: string) => {
    if (!selectedFact) return
    state.linkSource(claim.id, selectedFact.id, sourceId, counterSource)
    toast({ title: '已复用共享来源', status: 'success' })
  }
  const transition = (status: typeof claim.status) => {
    const result = state.transitionClaim(claim.id, status, transitionNote || `由${claim.status}流转至${status}`)
    toast({ title: result.message, status: result.ok ? 'success' : 'error' })
    if (result.ok) versionModal.onClose()
  }
  const resume = () => {
    const result = state.resumePublication(claim.id, transitionNote || '全部事实已按最新授权范围重新确认')
    toast({ title: result.message, status: result.ok ? 'success' : 'error' })
    if (result.ok) versionModal.onClose()
  }
  const reconfirm = (factId: string) => {
    const result = state.reconfirmFact(claim.id, factId)
    toast({ title: result.message, status: result.ok ? 'success' : 'error' })
  }
  const exportArchive = () => {
    // 重认前停止导出：授权链路存在问题或主张处于停发复审时，不导出当前档案
    const blockers = claim.facts.map((fact) => ({ fact, issue: factAuthIssue(fact, state.sourceLibrary) })).filter((item) => item.issue)
    if (claim.status === '停发复审' || blockers.length) {
      toast({ title: '重认前停止导出', description: blockers.map((item) => `${item.fact.id}：${item.issue}`).join('；') || '主张正在停发复审', status: 'error', duration: 6000 })
      return
    }
    const versions = state.versions.filter((item) => item.claimId === claim.id)
    const audit = state.audit.filter((item) => item.claimId === claim.id)
    const sources = state.sourceLibrary.filter((source) => claim.facts.some((fact) => fact.sourceIds.includes(source.id) || fact.counterSourceIds.includes(source.id)))
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), note: '当前工作区档案；发布时刻锁定快照见发布档案', claim, sources, versions, audit }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${claim.id}-当前档案.json`; anchor.click(); URL.revokeObjectURL(url)
  }
  const startBulk = (crash: boolean) => {
    const items = bulkText.split('\n').map((item) => item.trim()).filter(Boolean)
    if (items.length < 3 && crash) { toast({ title: '模拟失败至少需要 3 条事实', status: 'warning' }); return }
    const result = state.startBulkImport(claim.id, items, crash ? 2 : items.length)
    toast({ title: result.message, status: result.ok ? (crash ? 'warning' : 'success') : 'error', duration: 5000 })
    if (result.ok && !crash) { bulkModal.onClose(); setBulkText('') }
  }
  const preflight = useMemo(() => preflightPublish(claim, state.sourceLibrary), [claim, state.sourceLibrary])
  const publications = state.publications.filter((item) => item.claimId === claim.id)

  return <Box p="6" pb="16">
    <Flex justify="space-between" align="flex-start" mb="4"><Box><Text fontSize="xs" color="gray.600">{claim.id} · {claim.reporter} / {claim.editor} · V{claim.version}</Text><Text fontSize="xl" fontWeight="700" mt="1">{claim.title}</Text><Text color="gray.600" fontSize="sm" mt="2" maxW="760px">{claim.summary}</Text>{claim.status === '停发复审' && <Badge colorScheme="red" mt="2">停发复审：授权变更/撤权撞车，发布侧先停，重认前停止导出</Badge>}</Box><Flex gap="2"><Button variant="outline" onClick={exportArchive}>导出当前档案</Button><Button variant="outline" colorScheme="purple" onClick={bulkModal.onOpen}>批量补录/检查点</Button><Button colorScheme="teal" onClick={versionModal.onOpen}>状态与版本</Button></Flex></Flex>
    {publications.length > 0 && <Alert status="info" mb="3" variant="left-accent"><Text fontSize="sm">已有 {publications.length} 份发布档案锁定当时快照（最新 V{publications[0].version}，{publications[0].publishedAt.replace('T', ' ').slice(0, 16)}）；授权变更不改写历史档案，可在「档案与审计」导出。</Text></Alert>}
    <EvidenceGraph facts={claim.facts} />
    <Grid mt="4" templateColumns="320px 1fr" gap="4" alignItems="start">
      <Box bg="white" borderWidth="1px" p="3">
        <Flex justify="space-between" align="center" mb="3"><Text fontWeight="700">可验证事实树</Text><Badge>{claim.facts.length}</Badge></Flex>
        {claim.facts.map((fact) => {
          const issue = factAuthIssue(fact, state.sourceLibrary)
          return <Box key={fact.id} as="button" textAlign="left" w="100%" p="3" mb="2" borderWidth="1px" borderColor={fact.id === selectedFact?.id ? 'teal.600' : issue ? 'orange.400' : 'gray.200'} bg={fact.id === selectedFact?.id ? 'teal.50' : 'white'} onClick={() => setSelectedFactId(fact.id)}><Flex justify="space-between"><Text fontSize="xs" color="gray.500">{fact.id}</Text><Badge colorScheme={conclusionColor[fact.conclusion]}>{fact.conclusion}</Badge></Flex><Text fontSize="sm" mt="2" fontWeight="600">{fact.text}</Text><Text fontSize="xs" color="gray.500" mt="2">置信度 {fact.confidence}% · 疑点 {fact.unresolved.length}</Text>{issue && <Badge mt="2" colorScheme="orange">授权待重认</Badge>}</Box>
        })}
        <Flex mt="3" gap="2"><Input size="sm" placeholder="拆出新的可验证事实" value={factText} onChange={(event) => setFactText(event.target.value)} /><Button size="sm" colorScheme="teal" onClick={() => { state.addFact(claim.id, factText); setFactText('') }}>添加</Button></Flex>
      </Box>
      {selectedFact && <Box bg="white" borderWidth="1px" p="4">
        <Flex justify="space-between" align="flex-start"><Box><Text fontSize="xs" color="gray.500">{selectedFact.id}</Text><Text fontWeight="700" mt="1">{selectedFact.text}</Text></Box><Flex gap="2">{factAuthIssue(selectedFact, state.sourceLibrary)
          ? <Badge colorScheme="orange">待重认</Badge>
          : <Badge colorScheme="teal">授权已确认</Badge>}<Badge colorScheme={conclusionColor[selectedFact.conclusion]}>{selectedFact.conclusion}</Badge></Flex></Flex>
        {factAuthIssue(selectedFact, state.sourceLibrary) && <Alert status="warning" mt="3" variant="left-accent" flexDirection="column" alignItems="flex-start">
          <Text fontSize="sm">{factAuthIssue(selectedFact, state.sourceLibrary)}</Text>
          <Button size="sm" mt="2" colorScheme="orange" onClick={() => reconfirm(selectedFact.id)}>按当前授权范围重新确认</Button>
        </Alert>}
        <Grid templateColumns="1fr 1fr 1fr" gap="3" mt="4">
          <FormControl><FormLabel fontSize="xs">事实结论</FormLabel><Select size="sm" value={selectedFact.conclusion} onChange={(event) => setFact({ conclusion: event.target.value as FactConclusion })}>{['已证实', '部分属实', '证据不足', '不实'].map((value) => <option key={value}>{value}</option>)}</Select></FormControl>
          <FormControl><FormLabel fontSize="xs">置信程度 {selectedFact.confidence}%</FormLabel><Input size="sm" type="range" min="0" max="100" value={selectedFact.confidence} onChange={(event) => setFact({ confidence: Number(event.target.value) })} /></FormControl>
          <FormControl><FormLabel fontSize="xs">未解决疑点</FormLabel><Input size="sm" value={selectedFact.unresolved.join('；')} onChange={(event) => setFact({ unresolved: event.target.value ? event.target.value.split('；') : [] })} /></FormControl>
        </Grid>
        <Tabs mt="5" colorScheme="teal">
          <TabList><Tab>支持证据 {selectedFact.sourceIds.length}</Tab><Tab>相反证据 {selectedFact.counterSourceIds.length}</Tab><Tab>批注 {selectedFact.annotations.length}</Tab><Tab>来源时间线</Tab></TabList>
          <TabPanels>
            <TabPanel px="0"><EvidenceList sources={selectedFact.sourceIds.map(resolve).filter((item): item is SharedSource => !!item)} claimId={claim.id} onAdd={() => { setCounterSource(false); sourceModal.onOpen() }} onLink={() => { setCounterSource(false); linkModal.onOpen() }} /></TabPanel>
            <TabPanel px="0"><EvidenceList sources={selectedFact.counterSourceIds.map(resolve).filter((item): item is SharedSource => !!item)} claimId={claim.id} onAdd={() => { setCounterSource(true); sourceModal.onOpen() }} onLink={() => { setCounterSource(true); linkModal.onOpen() }} counter /></TabPanel>
            <TabPanel px="0"><AnnotationList fact={selectedFact} claimId={claim.id} /></TabPanel>
            <TabPanel px="0"><Box borderLeftWidth="2px" borderColor="gray.300" pl="4">{[...selectedFact.sourceIds, ...selectedFact.counterSourceIds].map(resolve).filter((item): item is SharedSource => !!item).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)).map((source) => <Box key={source.id} mb="4"><Text fontSize="xs" color="gray.500">{source.publishedAt} · {source.kind}</Text><Text fontWeight="600" mt="1">{source.title}</Text><Text fontSize="sm" color="gray.600">{source.publisher} · 留档 {source.capturedAt.replace('T', ' ').slice(0, 16)}</Text></Box>)}</Box></TabPanel>
          </TabPanels>
        </Tabs>
      </Box>}
    </Grid>

    <Modal isOpen={sourceModal.isOpen} onClose={sourceModal.onClose} size="xl"><ModalOverlay /><ModalContent><ModalHeader>{counterSource ? '关联相反证据（共享库）' : '关联支持证据（共享库）'}</ModalHeader><ModalCloseButton /><ModalBody><Grid templateColumns="1fr 1fr" gap="3"><FormControl><FormLabel>来源标题</FormLabel><Input value={sourceForm.title} onChange={(event) => setSourceForm({ ...sourceForm, title: event.target.value })} /></FormControl><FormControl><FormLabel>公开地址</FormLabel><Input value={sourceForm.url} onChange={(event) => setSourceForm({ ...sourceForm, url: event.target.value })} /></FormControl><FormControl><FormLabel>发布机构</FormLabel><Input value={sourceForm.publisher} onChange={(event) => setSourceForm({ ...sourceForm, publisher: event.target.value })} /></FormControl><FormControl><FormLabel>发布日期</FormLabel><Input value={sourceForm.publishedAt} onChange={(event) => setSourceForm({ ...sourceForm, publishedAt: event.target.value })} /></FormControl><FormControl><FormLabel>证据类型</FormLabel><Select value={sourceForm.kind} onChange={(event) => setSourceForm({ ...sourceForm, kind: event.target.value as EvidenceKind })}>{['原始证据', '二次来源', '待证信息'].map((value) => <option key={value}>{value}</option>)}</Select></FormControl><FormControl><FormLabel>授权编号（必填）</FormLabel><Input placeholder="AUTH-YYYY-XXXX / GK-..." value={sourceForm.authorizationNo} onChange={(event) => setSourceForm({ ...sourceForm, authorizationNo: event.target.value })} /></FormControl><FormControl><FormLabel>授权范围</FormLabel><Input value={sourceForm.scope} onChange={(event) => setSourceForm({ ...sourceForm, scope: event.target.value })} /></FormControl><FormControl><FormLabel>授权方</FormLabel><Input value={sourceForm.grantedBy} onChange={(event) => setSourceForm({ ...sourceForm, grantedBy: event.target.value })} /></FormControl><FormControl><FormLabel>内容哈希</FormLabel><Input placeholder="sha256:..." value={sourceForm.contentHash} onChange={(event) => setSourceForm({ ...sourceForm, contentHash: event.target.value })} /></FormControl><FormControl><FormLabel>留档说明</FormLabel><Input value={sourceForm.chainOfCustody} onChange={(event) => setSourceForm({ ...sourceForm, chainOfCustody: event.target.value })} /></FormControl></Grid></ModalBody><ModalFooter><Text fontSize="xs" color="gray.500" mr="auto">采访材料收入共享库后可被多条事实复用</Text><Button variant="ghost" mr="3" onClick={sourceModal.onClose}>取消</Button><Button colorScheme="teal" isDisabled={!sourceForm.title || !sourceForm.url || !sourceForm.authorizationNo} onClick={createSource}>收入共享库并关联</Button></ModalFooter></ModalContent></Modal>

    <Modal isOpen={linkModal.isOpen} onClose={linkModal.onClose} size="xl"><ModalOverlay /><ModalContent><ModalHeader>从共享库复用{counterSource ? '相反证据' : '支持来源'}</ModalHeader><ModalCloseButton /><ModalBody>{state.sourceLibrary.filter((source) => { const ids = counterSource ? selectedFact?.counterSourceIds : selectedFact?.sourceIds; return !ids?.includes(source.id) }).map((source) => <Box key={source.id} borderWidth="1px" p="3" mb="2"><Flex justify="space-between" align="center"><Box><Text fontWeight="600" fontSize="sm">{source.title}</Text><Text fontSize="xs" color="gray.500">{source.publisher} · 已被 {source.factRefs.length} 处引用 · 授权 V{source.authorization.version}</Text></Box><Flex gap="2" align="center"><Badge colorScheme={source.authorization.status === '有效' ? 'green' : source.authorization.status === '已撤权' ? 'red' : 'orange'}>{source.legacy || !source.authorization.authorizationNo ? '旧稿待补' : source.authorization.status}</Badge><Button size="xs" colorScheme="teal" isDisabled={!counterSource && (source.authorization.status !== '有效' || source.legacy || !source.authorization.authorizationNo)} onClick={() => linkSource(source.id)}>引用</Button></Flex></Flex></Box>)}</ModalBody><ModalFooter><Button variant="ghost" onClick={linkModal.onClose}>关闭</Button></ModalFooter></ModalContent></Modal>

    <Modal isOpen={versionModal.isOpen} onClose={versionModal.onClose}><ModalOverlay /><ModalContent><ModalHeader>状态流转与版本说明</ModalHeader><ModalCloseButton /><ModalBody><FormControl mb="4"><FormLabel>版本变更说明</FormLabel><Textarea rows={3} value={transitionNote} onChange={(event) => setTransitionNote(event.target.value)} /></FormControl>
      <Box bg="gray.50" p="3"><Text fontSize="xs" fontWeight="700" mb="2">发布前校验</Text>{preflight.allowed ? <Text fontSize="xs" color="green.600">校验通过：事实、疑点与授权范围均满足发布条件。</Text> : preflight.blocking.map((item) => <Text key={item} fontSize="xs" color="red.600">· {item}</Text>)}</Box>
      <Text fontSize="xs" color="gray.500" mt="3">发布档案锁定当时快照；撤权与发布撞车时发布一侧先停复审，重认前停止导出。</Text>
    </ModalBody><ModalFooter>{claim.status === '停发复审'
      ? <Button colorScheme="orange" isDisabled={!preflight.allowed} onClick={resume}>重认完成，复审通过并重新发布</Button>
      : <Flex gap="2" w="100%" justify="flex-end"><Button mr="2" onClick={() => transition('待编辑复核')}>提交编辑复核</Button><Button colorScheme="teal" isDisabled={!preflight.allowed} onClick={() => transition('已发布')}>发布正式版本</Button></Flex>}</ModalFooter></ModalContent></Modal>

    <Modal isOpen={bulkModal.isOpen} onClose={bulkModal.onClose}><ModalOverlay /><ModalContent><ModalHeader>批量补录事实（检查点演示）</ModalHeader><ModalCloseButton /><ModalBody><Text fontSize="xs" color="gray.500" mb="2">每行一条事实。模拟“本机写入失败”时前 2 条已落库并保留检查点，之后可从检查点恢复：只补未完成事实和审计，不重复记录。</Text><Textarea rows={8} placeholder={'事实一\n事实二\n事实三\n事实四'} value={bulkText} onChange={(event) => setBulkText(event.target.value)} />
      {state.checkpoint && !state.checkpoint.finished && <Alert status="warning" mt="3"><Text fontSize="xs">检查点 {state.checkpoint.id}：{state.checkpoint.completedItems.length}/{state.checkpoint.pendingItems.length} 已完成，可直接恢复。</Text></Alert>}
    </ModalBody><ModalFooter><Button variant="ghost" mr="3" onClick={bulkModal.onClose}>取消</Button><Button variant="outline" colorScheme="orange" onClick={() => startBulk(true)}>写入并在第3条模拟失败</Button><Button colorScheme="teal" onClick={() => startBulk(false)}>完整批量写入</Button></ModalFooter></ModalContent></Modal>
  </Box>
}

function EvidenceList({ sources, claimId, onAdd, onLink, counter = false }: { sources: SharedSource[]; claimId: string; onAdd: () => void; onLink: () => void; counter?: boolean }) {
  void claimId
  return <Box><Flex justify="space-between" mb="3"><Text fontSize="sm" color="gray.600">{counter ? '相反证据与支持证据并列保留，授权变更不影响相反证据' : '共享库来源，授权范围变更将级联到引用事实'}</Text><Flex gap="2"><Button size="sm" variant="outline" onClick={onLink}>复用共享库</Button><Button size="sm" colorScheme={counter ? 'red' : 'teal'} variant="outline" onClick={onAdd}>{counter ? '新增相反证据' : '新增支持证据'}</Button></Flex></Flex>{sources.map((source) => <Box key={source.id} borderWidth="1px" p="3" mb="2"><Flex justify="space-between"><Text fontWeight="600">{source.title}</Text><Flex gap="1"><Badge colorScheme={source.kind === '原始证据' ? 'green' : source.kind === '二次来源' ? 'orange' : 'gray'}>{source.kind}</Badge><Badge colorScheme={source.authorization.status === '有效' ? 'green' : source.authorization.status === '已撤权' ? 'red' : 'orange'}>{source.legacy || !source.authorization.authorizationNo ? '旧稿待补' : source.authorization.status} V{source.authorization.version}</Badge></Flex></Flex><Text fontSize="xs" color="gray.600" mt="2">{source.publisher} · {source.publishedAt} · 留档V{source.version}</Text><Text fontFamily="mono" fontSize="xs" mt="2">{source.contentHash}</Text><Divider my="2" /><Text fontSize="xs">授权号：{source.authorization.authorizationNo || '（旧稿待补）'} · 范围：{source.authorization.scope}</Text><Text fontSize="xs" mt="1">{source.chainOfCustody}</Text><Text fontSize="xs" color="blue.600" mt="1" wordBreak="break-all">{source.url}</Text></Box>)}</Box>
}

function AnnotationList({ fact, claimId }: { fact: ClaimFact; claimId: string }) {
  const addAnnotation = useClaimStore((state) => state.addAnnotation)
  const resolve = useClaimStore((state) => state.resolveAnnotation)
  const [text, setText] = useState('')
  return <Box><Flex gap="2" mb="3"><Input placeholder="添加事实核查批注" value={text} onChange={(event) => setText(event.target.value)} /><Button onClick={() => { addAnnotation(claimId, fact.id, { author: '陆衡', role: '事实核查员', content: text }); setText('') }}>添加</Button></Flex>{fact.annotations.map((item) => <Box key={item.id} borderLeftWidth="3px" borderColor={item.resolved ? 'green.400' : 'orange.400'} bg={item.resolved ? 'green.50' : 'orange.50'} p="3" mb="2"><Flex justify="space-between"><Text fontWeight="600" fontSize="sm">{item.role} {item.author}</Text><Button size="xs" variant="ghost" isDisabled={item.resolved} onClick={() => resolve(claimId, fact.id, item.id)}>{item.resolved ? '已解决' : '标记解决'}</Button></Flex><Text fontSize="sm" mt="2">{item.content}</Text><Text fontSize="xs" color="gray.500" mt="1">{item.createdAt.replace('T', ' ').slice(0, 16)}</Text></Box>)}</Box>
}
