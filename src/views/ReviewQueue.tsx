import { Badge, Box, Button, Divider, Flex, Text, useToast } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { useClaimStore } from '../store/useClaimStore'
import { factValidity, publishPreflight } from '../services/authorization'

export function ReviewQueue() {
  const state = useClaimStore()
  const toast = useToast()
  const navigate = useNavigate()
  const reviewClaims = state.claims.filter((claim) => claim.status === '待编辑复核' || claim.status === '已发布' || claim.facts.some((fact) => fact.annotations.some((note) => !note.resolved)))
  const approve = (claimId: string) => {
    // 进入发布窗口：先占锁登记当前授权版本
    state.beginPublishIntent(claimId, '宋卓')
    const result = state.publishClaim(claimId, '宋卓', '编辑完成事实、来源授权与相反证据复核，锁定发布快照。')
    toast({ title: result.message, status: result.ok ? 'success' : 'warning', duration: 7000 })
    if (result.ok) navigate('/audit')
  }
  const simulateRevocation = (claimId: string) => {
    // 演示“撤权窗口”：在发布窗口已占锁之后撤销关联授权，再提交发布即撞车
    state.beginPublishIntent(claimId, '宋卓')
    state.revokeAuthorizationsForClaim(claimId, '法务 周岚（另一窗口）', '采访对象撤回公开使用授权，法务紧急撤权')
    toast({ title: '另一窗口已撤销关联授权，请点“提交发布”观察发布侧先停复审', status: 'info', duration: 7000 })
  }
  return <Box p="6" pb="16">
    <Box mb="5"><Text fontSize="xs" color="gray.600">编辑审阅 / 授权失效重认 / 发布前检查 / 两窗口撞车</Text><Text fontSize="xl" fontWeight="700" mt="1">复核队列</Text></Box>
    <Flex direction="column" gap="3">{reviewClaims.map((claim) => {
      const unresolved = claim.facts.flatMap((fact) => fact.annotations.filter((note) => !note.resolved).map((note) => ({ fact, note })))
      const invalid = claim.facts.map((fact) => ({ fact, validity: factValidity(fact, state.authorizations, state.sharedSources) })).filter((item) => item.validity.awaitingReconfirm)
      const blocking = publishPreflight(claim, state.authorizations, state.sharedSources)
      const published = claim.status === '已发布'
      return <Box key={claim.id} bg="white" borderWidth="1px" p="4">
        <Flex justify="space-between"><Box><Text fontFamily="mono" fontSize="xs" color="gray.500">{claim.id}</Text><Text fontWeight="700" mt="1">{claim.title}</Text></Box><Badge colorScheme={published ? 'green' : 'orange'}>{claim.status}</Badge></Flex>
        <Flex mt="4" gap="4">
          <Box flex="1"><Text fontSize="sm" fontWeight="600">未解决批注 {unresolved.length}</Text>{unresolved.map(({ fact, note }) => <Box key={note.id} bg="orange.50" p="2" mt="2"><Text fontSize="xs" color="gray.500">{fact.id} · {note.author}</Text><Text fontSize="sm">{note.content}</Text></Box>)}</Box>
          <Box flex="1"><Text fontSize="sm" fontWeight="600" color={invalid.length ? 'red.600' : undefined}>授权失效待重认 {invalid.length}</Text>{invalid.map(({ fact, validity }) => <Box key={fact.id} bg="red.50" p="2" mt="2"><Text fontSize="xs" color="red.700" fontWeight="700">{fact.id} 已失效，其他事实照常</Text><Text fontSize="xs" mt="1">{validity.reasons.join('；')}</Text></Box>)}{invalid.length === 0 && <Text fontSize="xs" color="gray.500" mt="2">全部事实的授权范围当前有效。</Text>}</Box>
        </Flex>
        <Divider my="3" />
        {published
          ? <Flex justify="space-between" align="center"><Text fontSize="sm" color="green.700">已发布并锁定档案快照，后续授权变更不改写该档案。</Text><Button size="sm" variant="outline" onClick={() => navigate('/audit')}>查看锁定档案</Button></Flex>
          : <Flex justify="space-between" align="center">
            <Box><Text fontSize="sm" fontWeight="600">发布前校验 {blocking.length === 0 ? '通过' : `未通过（${blocking.length} 项阻断）`}</Text>{blocking.map((message) => <Text key={message} fontSize="xs" color="red.600">· {message}</Text>)}</Box>
            <Flex gap="2">
              <Button size="sm" colorScheme="purple" variant="outline" onClick={() => simulateRevocation(claim.id)}>模拟另一窗口撤权（撞车演练）</Button>
              <Button size="sm" colorScheme="teal" isDisabled={blocking.length > 0} onClick={() => approve(claim.id)}>提交发布并锁定快照</Button>
              {blocking.length > 0 && <Button size="sm" variant="ghost" onClick={() => navigate(`/claims/${claim.id}`)}>去处理</Button>}
            </Flex>
          </Flex>}
      </Box>
    })}</Flex>
  </Box>
}
