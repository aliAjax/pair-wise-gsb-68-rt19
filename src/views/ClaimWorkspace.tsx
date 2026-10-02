import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, AlertDescription, AlertIcon, AlertTitle, Badge, Box, Button, Divider, Flex, FormControl, FormLabel, Grid, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Tab, TabList, TabPanel, TabPanels, Tabs, Text, Textarea, useDisclosure, useToast } from '@chakra-ui/react'
import { EvidenceGraph } from '../components/EvidenceGraph'
import { conclusionColor, useClaimStore } from '../store/useClaimStore'
import { exportBlockers, factValidity, hasLegacySources, resolveAuthorization, resolveSource } from '../services/authorization'
import type { ClaimFact, FactConclusion } from '../types'

export function ClaimWorkspace() {
  const { id } = useParams()
  const toast = useToast()
  const state = useClaimStore()
  const claim = state.claims.find((item) => item.id === id)
  const [selectedFactId, setSelectedFactId] = useState(claim?.facts[0]?.id ?? '')
  const selectedFact = claim?.facts.find((item) => item.id === selectedFactId) ?? claim?.facts[0]
  const [factText, setFactText] = useState('')
  const sourceModal = useDisclosure()
  const versionModal = useDisclosure()
  const [counterSource, setCounterSource] = useState(false)
  const [linkSourceId, setLinkSourceId] = useState('')
  const [transitionNote, setTransitionNote] = useState('')
  useEffect(() => { if (!selectedFactId && claim?.facts[0]) setSelectedFactId(claim.facts[0].id) }, [selectedFactId, claim])
  if (!claim) return <Box p="10">未找到核查主张</Box>

  const invalidFacts = claim.facts.map((fact) => ({ fact, validity: factValidity(fact, state.authorizations, state.sharedSources) })).filter((item) => item.validity.awaitingReconfirm)
  const blockers = exportBlockers(claim, state.authorizations, state.sharedSources)
  const exportLocked = blockers.length > 0
  const checkpoint = state.checkpoints.find((item) => item.steps.some((step) => step.claimId === claim.id) && item.status !== '已完成')
  const sealedArchive = state.publications.find((item) => item.claimId === claim.id)
  const isPublished = claim.status === '已发布'

  const setFact = (patch: Partial<ClaimFact>) => { if (selectedFact) state.updateFact(claim.id, selectedFact.id, patch) }
  const linkSource = () => {
    if (!selectedFact || !linkSourceId) return
    state.linkSharedSource(claim.id, selectedFact.id, linkSourceId, counterSource)
    sourceModal.onClose()
    toast({ title: '已从共享来源库关联，并按当前授权版本确认', status: 'success' })
  }
  const transition = (status: typeof claim.status) => {
    const result = state.transitionClaim(claim.id, status, transitionNote || `由${claim.status}流转至${status}`)
    toast({ title: result.message, status: result.ok ? 'success' : 'error' })
    if (result.ok) versionModal.onClose()
  }
  const reconfirm = (factId: string) => {
    const result = state.reconfirmFact(claim.id, factId, '陆衡')
    toast({ title: result.message, status: result.ok ? 'success' : 'error' })
  }
  const runMigration = (withFailure: boolean) => {
    const firstLegacy = claim.facts.flatMap((fact) => (fact.legacySources ?? []).map((legacy) => ({ fact, legacy })))[0]
    const failStep = withFailure && firstLegacy ? { factId: firstLegacy.fact.id, kind: '支持证据' as const, title: firstLegacy.legacy.title } : undefined
    const result = state.migrateLegacyDraft(claim.id, '陆衡', failStep)
    toast({ title: result.message, status: result.ok ? 'success' : 'error', duration: 6000 })
  }
  const resumeMigration = () => {
    const result = state.resumeMigration(claim.id, '陆衡')
    toast({ title: result.message, status: result.ok ? 'success' : 'error', duration: 6000 })
  }
  const exportArchive = () => {
    if (exportLocked) { state.recordExportAttempt(claim.id, '陆衡', true, blockers.join('；')); toast({ title: `重认前停止导出：${blockers.join('；')}`, status: 'error', duration: 6000 }); return }
    const versions = state.versions.filter((item) => item.claimId === claim.id)
    const audit = state.audit.filter((item) => item.claimId === claim.id)
    const blob = new Blob([JSON.stringify({ claim, versions, audit, sealedArchive: sealedArchive ?? null }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${claim.id}-核查档案.json`; anchor.click(); URL.revokeObjectURL(url)
    state.recordExportAttempt(claim.id, '陆衡', exportLocked, exportLocked ? '重认前停止导出' : '按当前数据导出（发布档案另以锁定快照为准）')
  }

  return <Box p="6" pb="16">
    <Flex justify="space-between" align="flex-start" mb="4">
      <Box>
        <Text fontSize="xs" color="gray.600">{claim.id} · {claim.reporter} / {claim.editor} · V{claim.version}{claim.migratedLegacy && <Badge ml="2" colorScheme="purple">旧稿已迁移补授权编号</Badge>}</Text>
        <Text fontSize="xl" fontWeight="700" mt="1">{claim.title}</Text>
        <Text color="gray.600" fontSize="sm" mt="2" maxW="760px">{claim.summary}</Text>
      </Box>
      <Flex gap="2">
        {sealedArchive && <Badge colorScheme="blue" px="2" py="1">发布档案 {sealedArchive.id} 已锁定 V{sealedArchive.claimVersion}</Badge>}
        <Button variant="outline" isDisabled={exportLocked} onClick={exportArchive}>{exportLocked ? '重认前停止导出' : '导出档案'}</Button>
        {!isPublished && <Button colorScheme="teal" onClick={versionModal.onOpen}>状态与版本</Button>}
      </Flex>
    </Flex>

    {exportLocked && <Alert status="error" mb="4" borderRadius="4px"><AlertIcon /><Box><AlertTitle fontSize="sm">授权范围已变更或撤销，发布档案停止导出</AlertTitle><AlertDescription fontSize="xs">{blockers.join('；')}。请在事实卡片上完成重新确认后再导出；其他未受影响事实照常工作。</AlertDescription></Box></Alert>}
    {isPublished && <Alert status="info" mb="4" borderRadius="4px"><AlertIcon /><Box><AlertTitle fontSize="sm">已发布：档案锁定的是当时快照</AlertTitle><AlertDescription fontSize="xs">发布时点 {sealedArchive?.publishedAt.replace('T', ' ').slice(0, 16)} 锁定的事实与来源不随后续授权变更改写；如需修改须新建核查主张。</AlertDescription></Box></Alert>}
    {hasLegacySources(claim) && !isPublished && <Alert status="warning" mb="4" borderRadius="4px" alignItems="flex-start"><AlertIcon /><Box flex="1"><AlertTitle fontSize="sm">检测到旧稿内嵌采访材料，尚未补授权编号</AlertTitle><AlertDescription fontSize="xs">迁移会把内嵌来源收进共享来源库并补授权编号，写入检查点；历史发布档案不改写。</AlertDescription>
      <Flex mt="2" gap="2">
        <Button size="xs" colorScheme="purple" onClick={() => runMigration(false)}>迁移并补授权编号</Button>
        <Button size="xs" variant="outline" onClick={() => runMigration(true)}>模拟本机写入失败</Button>
        {checkpoint?.status === '失败待恢复' && <Button size="xs" colorScheme="red" onClick={resumeMigration}>从检查点恢复（只补未完成）</Button>}
      </Flex></Box></Alert>}

    <EvidenceGraph facts={claim.facts} authorizations={state.authorizations} sources={state.sharedSources} />

    {checkpoint && <MigrationPanel checkpointId={checkpoint.id} claimId={claim.id} />}

    <Grid mt="4" templateColumns="320px 1fr" gap="4" alignItems="start">
      <Box bg="white" borderWidth="1px" p="3">
        <Flex justify="space-between" align="center" mb="3"><Text fontWeight="700">可验证事实树</Text><Badge>{claim.facts.length}</Badge></Flex>
        {claim.facts.map((fact) => {
          const validity = factValidity(fact, state.authorizations, state.sharedSources)
          return <Box key={fact.id} as="button" textAlign="left" w="100%" p="3" mb="2" borderWidth="1px" borderColor={fact.id === selectedFact?.id ? 'teal.600' : validity.awaitingReconfirm ? 'red.300' : 'gray.200'} bg={fact.id === selectedFact?.id ? 'teal.50' : validity.awaitingReconfirm ? 'red.50' : 'white'} onClick={() => setSelectedFactId(fact.id)}>
            <Flex justify="space-between"><Text fontSize="xs" color="gray.500">{fact.id}</Text><Badge colorScheme={conclusionColor[fact.conclusion]}>{fact.conclusion}</Badge></Flex>
            <Text fontSize="sm" mt="2" fontWeight="600">{fact.text}</Text>
            <Text fontSize="xs" color="gray.500" mt="2">置信度 {fact.confidence}% · 疑点 {fact.unresolved.length}</Text>
            {validity.awaitingReconfirm && <Badge mt="2" colorScheme="red">授权失效待重认</Badge>}
          </Box>
        })}
        {!isPublished && <Flex mt="3" gap="2"><Input size="sm" placeholder="拆出新的可验证事实" value={factText} onChange={(event) => setFactText(event.target.value)} /><Button size="sm" colorScheme="teal" onClick={() => { state.addFact(claim.id, factText); setFactText('') }}>添加</Button></Flex>}
      </Box>

      {selectedFact && <Box bg="white" borderWidth="1px" p="4">
        {(() => {
          const validity = factValidity(selectedFact, state.authorizations, state.sharedSources)
          return <>
            <Flex justify="space-between" align="flex-start"><Box><Text fontSize="xs" color="gray.500">{selectedFact.id}</Text><Text fontWeight="700" mt="1">{selectedFact.text}</Text></Box><Badge colorScheme={conclusionColor[selectedFact.conclusion]}>{selectedFact.conclusion}</Badge></Flex>
            {validity.awaitingReconfirm && <Alert status="error" mt="3" borderRadius="4px" flexDirection="column" alignItems="flex-start"><Flex><AlertIcon /><Box><AlertTitle fontSize="sm">关联事实已失效，等待重新确认</AlertTitle><AlertDescription fontSize="xs">{validity.reasons.join('；')}</AlertDescription></Box></Flex>
              <Button mt="2" size="sm" colorScheme="red" onClick={() => reconfirm(selectedFact.id)} isDisabled={validity.invalid.some((item) => !item.authorization || item.authorization.status === '已撤销')}>按当前授权范围重新确认本事实</Button>
              {validity.invalid.some((item) => !item.authorization || item.authorization.status === '已撤销') && <Text fontSize="xs" color="red.600" mt="1">含已撤销授权，无法重认，请先在“授权与来源库”更换来源或恢复授权。</Text>}
            </Alert>}
          </>
        })()}
        {!isPublished && <Grid templateColumns="1fr 1fr 1fr" gap="3" mt="4">
          <FormControl><FormLabel fontSize="xs">事实结论</FormLabel><Select size="sm" value={selectedFact.conclusion} onChange={(event) => setFact({ conclusion: event.target.value as FactConclusion })}>{['已证实', '部分属实', '证据不足', '不实'].map((value) => <option key={value}>{value}</option>)}</Select></FormControl>
          <FormControl><FormLabel fontSize="xs">置信程度 {selectedFact.confidence}%</FormLabel><Input size="sm" type="range" min="0" max="100" value={selectedFact.confidence} onChange={(event) => setFact({ confidence: Number(event.target.value) })} /></FormControl>
          <FormControl><FormLabel fontSize="xs">未解决疑点</FormLabel><Input size="sm" value={selectedFact.unresolved.join('；')} onChange={(event) => setFact({ unresolved: event.target.value ? event.target.value.split('；') : [] })} /></FormControl>
        </Grid>}
        <Tabs mt="5" colorScheme="teal">
          <TabList><Tab>支持证据 {selectedFact.sources.length}</Tab><Tab>相反证据 {selectedFact.counterSources.length}</Tab><Tab>批注 {selectedFact.annotations.length}</Tab><Tab>来源时间线</Tab></TabList>
          <TabPanels>
            <TabPanel px="0"><EvidenceList sourceIds={selectedFact.sources} fact={selectedFact} onAdd={() => { setCounterSource(false); setLinkSourceId(''); sourceModal.onOpen() }} canManage={!isPublished} /></TabPanel>
            <TabPanel px="0"><EvidenceList sourceIds={selectedFact.counterSources} fact={selectedFact} onAdd={() => { setCounterSource(true); setLinkSourceId(''); sourceModal.onOpen() }} canManage={!isPublished} counter /></TabPanel>
            <TabPanel px="0"><AnnotationList fact={selectedFact} claimId={claim.id} readOnly={isPublished} /></TabPanel>
            <TabPanel px="0"><Box borderLeftWidth="2px" borderColor="gray.300" pl="4">{[...selectedFact.sources, ...selectedFact.counterSources].map((sourceId) => resolveSource(sourceId, state.sharedSources)).filter(Boolean).sort((a, b) => a!.publishedAt.localeCompare(b!.publishedAt)).map((source) => <Box key={source!.id} mb="4"><Text fontSize="xs" color="gray.500">{source!.publishedAt} · {source!.kind}</Text><Text fontWeight="600" mt="1">{source!.title}</Text><Text fontSize="sm" color="gray.600">{source!.publisher} · 留档 {source!.capturedAt.replace('T', ' ').slice(0, 16)}</Text></Box>)}</Box></TabPanel>
          </TabPanels>
        </Tabs>
      </Box>}
    </Grid>

    <Modal isOpen={sourceModal.isOpen} onClose={sourceModal.onClose} size="xl"><ModalOverlay /><ModalContent><ModalHeader>从共享来源库关联{counterSource ? '相反证据' : '支持证据'}</ModalHeader><ModalCloseButton /><ModalBody>
      <FormControl mb="3"><FormLabel fontSize="xs">选择共享库来源（一条采访材料可被多个事实复用）</FormLabel>
        <Select placeholder="选择已入库来源" value={linkSourceId} onChange={(event) => setLinkSourceId(event.target.value)}>
          {state.sharedSources.filter((source) => {
            const used = counterSource ? selectedFact?.counterSources ?? [] : selectedFact?.sources ?? []
            return !used.includes(source.id)
          }).map((source) => {
            const authorization = state.authorizations.find((item) => item.authNo === source.authorizationNo)
            return <option key={source.id} value={source.id} disabled={authorization?.status === '已撤销'}>{source.id} · {source.title}（{source.authorizationNo ?? '未补授权编号'}{authorization ? ` V${authorization.scopeVersion}` : ''}）</option>
          })}
        </Select>
      </FormControl>
      {linkSourceId && (() => {
        const source = state.sharedSources.find((item) => item.id === linkSourceId)!
        const authorization = resolveAuthorization(source, state.authorizations)
        return <Box borderWidth="1px" p="3" bg="gray.50"><Text fontWeight="700" fontSize="sm">{source.title}</Text><Text fontSize="xs" color="gray.600" mt="1">{source.publisher} · {source.kind} · {source.publishedAt}</Text><Text fontSize="xs" mt="2">授权编号：<Badge colorScheme={authorization?.status === '已撤销' ? 'red' : 'purple'}>{source.authorizationNo ?? '缺失'}</Badge> {authorization ? `范围 V${authorization.scopeVersion} · ${authorization.scope.usage}` : '未登记授权，关联后将无法通过发布校验'}</Text></Box>
      })()}
      <Text fontSize="xs" color="gray.500" mt="3">库里没有？去「授权与来源库」先入库并登记授权编号。关联即按当前授权版本确认；法务改范围后本事实会立即失效待重认。</Text>
    </ModalBody><ModalFooter><Button variant="ghost" mr="3" onClick={sourceModal.onClose}>取消</Button><Button colorScheme="teal" isDisabled={!linkSourceId} onClick={linkSource}>关联并按当前版本确认</Button></ModalFooter></ModalContent></Modal>

    <Modal isOpen={versionModal.isOpen} onClose={versionModal.onClose}><ModalOverlay /><ModalContent><ModalHeader>状态流转与版本说明</ModalHeader><ModalCloseButton /><ModalBody><FormControl mb="4"><FormLabel>版本变更说明</FormLabel><Textarea rows={4} value={transitionNote} onChange={(event) => setTransitionNote(event.target.value)} /></FormControl>
      {invalidFacts.length > 0 && <Alert status="warning" mb="3" borderRadius="4px"><AlertIcon /><Box><AlertTitle fontSize="sm">存在授权失效待重认的事实：{invalidFacts.map((item) => item.fact.id).join('、')}</AlertTitle><AlertDescription fontSize="xs">提交复核会进入发布占锁；若撤权窗口同时操作，发布一侧将先停并退回复审。</AlertDescription></Box></Alert>}
      <Text fontSize="xs" color="gray.500">待编辑复核需要至少一项事实；发布时会拦截证据不足、待证信息未核验以及授权失效待重认的事实。</Text></ModalBody><ModalFooter><Button mr="2" onClick={() => transition('待编辑复核')}>提交编辑复核</Button><Button colorScheme="teal" onClick={() => transition('已发布')}>发布正式版本</Button></ModalFooter></ModalContent></Modal>
  </Box>
}

function MigrationPanel({ checkpointId, claimId }: { checkpointId: string; claimId: string }) {
  const checkpoint = useClaimStore((state) => state.checkpoints.find((item) => item.id === checkpointId))
  const resume = useClaimStore((state) => state.resumeMigration)
  const toast = useToast()
  if (!checkpoint) return null
  return <Box mt="4" borderWidth="1px" bg={checkpoint.status === '失败待恢复' ? 'red.50' : 'purple.50'} borderColor={checkpoint.status === '失败待恢复' ? 'red.300' : 'purple.300'} p="4">
    <Flex justify="space-between" align="center"><Text fontWeight="700" fontSize="sm">旧稿迁移检查点 {checkpoint.id} · {checkpoint.status}（{checkpoint.completedSteps}/{checkpoint.totalSteps}）</Text>
      {checkpoint.status === '失败待恢复' && <Button size="xs" colorScheme="red" onClick={() => { const result = resume(claimId, '陆衡'); toast({ title: result.message, status: result.ok ? 'success' : 'error', duration: 6000 }) }}>恢复：只补未完成事实和审计</Button>}
    </Flex>
    <Box mt="2">
      {checkpoint.steps.map((step) => <Flex key={step.id} fontSize="xs" justify="space-between" py="0.5"><span>{step.factId} · {step.kind} · {step.legacyTitle}</span>{step.done ? <Badge colorScheme="green">已完成 → {step.authorizationNo}</Badge> : <Badge colorScheme="red">未完成（恢复时补录，不重复记录）</Badge>}</Flex>)}
    </Box>
    <Text fontSize="xs" color="gray.500" mt="2" fontWeight="600">最近：{checkpoint.log[checkpoint.log.length - 1]?.message}</Text>
  </Box>
}

function EvidenceList({ sourceIds, fact, onAdd, counter = false, canManage }: { sourceIds: string[]; fact: ClaimFact; onAdd: () => void; counter?: boolean; canManage: boolean }) {
  const sharedSources = useClaimStore((state) => state.sharedSources)
  const authorizations = useClaimStore((state) => state.authorizations)
  const sources = sourceIds.map((sourceId) => resolveSource(sourceId, sharedSources)).filter(Boolean) as NonNullable<ReturnType<typeof resolveSource>>[]
  return <Box><Flex justify="space-between" mb="3"><Text fontSize="sm" color="gray.600">{counter ? '相反证据与支持证据并列保留' : '共享库来源，按授权版本确认'}</Text>{canManage && <Button size="sm" colorScheme={counter ? 'red' : 'teal'} variant="outline" onClick={onAdd}>{counter ? '关联相反证据' : '关联共享来源'}</Button>}</Flex>
    {sources.length === 0 && <Text fontSize="xs" color="gray.500">暂无来源记录。</Text>}
    {sources.map((source) => {
      const authorization = resolveAuthorization(source, authorizations)
      const confirmedVersion = fact.confirmedScopeVersions?.[source.id]
      const stale = authorization ? authorization.status === '已撤销' || (confirmedVersion !== undefined && confirmedVersion < authorization.scopeVersion) || confirmedVersion === undefined : true
      return <Box key={source.id} borderWidth="1px" p="3" mb="2" bg={stale ? 'red.50' : 'white'} borderColor={stale ? 'red.300' : 'gray.200'}>
        <Flex justify="space-between"><Text fontWeight="600">{source.title}</Text><Flex gap="1" align="center"><Badge colorScheme={source.kind === '原始证据' ? 'green' : source.kind === '二次来源' ? 'orange' : 'gray'}>{source.kind}</Badge></Flex></Flex>
        <Text fontSize="xs" color="gray.600" mt="2">{source.publisher} · {source.publishedAt} · 库内版本 V{source.version}</Text>
        <Text fontSize="xs" mt="1">授权 <Badge colorScheme={authorization?.status === '已撤销' ? 'red' : 'purple'}>{source.authorizationNo ?? '未补编号'}</Badge> 确认于 V{confirmedVersion ?? '—'} / 当前 V{authorization?.scopeVersion ?? '—'} {stale ? <Badge colorScheme="red" ml="1">失效待重认</Badge> : <Badge colorScheme="green" ml="1">范围有效</Badge>}</Text>
        <Text fontFamily="mono" fontSize="xs" mt="2">{source.contentHash}</Text>
        <Divider my="2" /><Text fontSize="xs">{source.chainOfCustody}</Text><Text fontSize="xs" color="blue.600" mt="1" wordBreak="break-all">{source.url}</Text>
      </Box>
    })}
  </Box>
}

function AnnotationList({ fact, claimId, readOnly }: { fact: ClaimFact; claimId: string; readOnly?: boolean }) {
  const addAnnotation = useClaimStore((state) => state.addAnnotation)
  const resolve = useClaimStore((state) => state.resolveAnnotation)
  const [text, setText] = useState('')
  return <Box>{!readOnly && <Flex gap="2" mb="3"><Input placeholder="添加事实核查批注" value={text} onChange={(event) => setText(event.target.value)} /><Button onClick={() => { addAnnotation(claimId, fact.id, { author: '陆衡', role: '事实核查员', content: text }); setText('') }}>添加</Button></Flex>}{fact.annotations.map((item) => <Box key={item.id} borderLeftWidth="3px" borderColor={item.resolved ? 'green.400' : 'orange.400'} bg={item.resolved ? 'green.50' : 'orange.50'} p="3" mb="2"><Flex justify="space-between"><Text fontWeight="600" fontSize="sm">{item.role} {item.author}</Text>{!readOnly && <Button size="xs" variant="ghost" isDisabled={item.resolved} onClick={() => resolve(claimId, fact.id, item.id)}>{item.resolved ? '已解决' : '标记解决'}</Button>}</Flex><Text fontSize="sm" mt="2">{item.content}</Text><Text fontSize="xs" color="gray.500" mt="1">{item.createdAt.replace('T', ' ').slice(0, 16)}</Text></Box>)}</Box>
}
