import { Badge, Box, Button, Flex, Text, useToast } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { claimAuthBlockers, useClaimStore } from '../store/useClaimStore'

export function ReviewQueue() {
  const state = useClaimStore()
  const toast = useToast()
  const navigate = useNavigate()
  const reviewClaims = state.claims.filter((claim) => claim.status === '待编辑复核' || claim.status === '停发复审' || claim.facts.some((fact) => fact.annotations.some((note) => !note.resolved)))
  const approve = (claimId: string) => {
    const result = state.transitionClaim(claimId, '已发布', '编辑完成事实、来源与相反证据复核。')
    toast({ title: result.message, status: result.ok ? 'success' : 'error' })
  }
  const resume = (claimId: string) => {
    const result = state.resumePublication(claimId, '复核队列确认：全部事实已按最新授权范围重认。')
    toast({ title: result.message, status: result.ok ? 'success' : 'error' })
  }
  return <Box p="6" pb="16">
    <Box mb="5"><Text fontSize="xs" color="gray.600">编辑审阅 / 争议证据 / 授权复审 / 发布前检查</Text><Text fontSize="xl" fontWeight="700" mt="1">复核队列</Text><Text fontSize="sm" color="gray.600" mt="2">撤权与发布在两个窗口撞车时，发布一侧先停复审；重认完成并复审通过后才锁定新快照。</Text></Box>
    <Flex direction="column" gap="3">{reviewClaims.map((claim) => {
      const unresolved = claim.facts.flatMap((fact) => fact.annotations.filter((note) => !note.resolved).map((note) => ({ fact, note })))
      const blocking = claim.facts.filter((fact) => fact.conclusion === '证据不足' && fact.unresolved.length)
      const authBlockers = claimAuthBlockers(claim, state.sourceLibrary)
      const stopped = claim.status === '停发复审'
      const ready = blocking.length === 0 && authBlockers.length === 0
      return <Box key={claim.id} bg="white" borderWidth="1px" p="4" borderLeftWidth="4px" borderLeftColor={stopped ? 'red.400' : 'orange.300'}>
        <Flex justify="space-between"><Box><Text fontFamily="mono" fontSize="xs" color="gray.500">{claim.id}</Text><Text fontWeight="700" mt="1">{claim.title}</Text></Box><Badge colorScheme={stopped ? 'red' : 'orange'}>{claim.status}</Badge></Flex>
        <Flex mt="4" gap="4">
          <Box flex="1"><Text fontSize="sm" fontWeight="600">未解决批注 {unresolved.length}</Text>{unresolved.map(({ fact, note }) => <Box key={note.id} bg="orange.50" p="2" mt="2"><Text fontSize="xs" color="gray.500">{fact.id} · {note.author}</Text><Text fontSize="sm">{note.content}</Text></Box>)}</Box>
          <Box flex="1"><Text fontSize="sm" fontWeight="600">事实阻断 {blocking.length}</Text>{blocking.map((fact) => <Box key={fact.id} bg="red.50" p="2" mt="2"><Text fontSize="xs" color="gray.500">{fact.id}</Text><Text fontSize="sm">{fact.unresolved.join('；')}</Text></Box>)}</Box>
          <Box flex="1"><Text fontSize="sm" fontWeight="600" color="red.600">授权阻断 {authBlockers.length}</Text>{authBlockers.map((item) => <Box key={item} bg="red.50" p="2" mt="2"><Text fontSize="sm">{item}</Text></Box>)}{stopped && <Text fontSize="xs" color="red.500" mt="2">发布侧已先停：导出在重认完成前一并停止。</Text>}</Box>
        </Flex>
        <Flex mt="4" gap="2">
          <Button size="sm" variant="outline" onClick={() => navigate(`/claims/${claim.id}`)}>打开主张重认</Button>
          {stopped
            ? <Button size="sm" colorScheme="red" isDisabled={!ready} onClick={() => resume(claim.id)}>重认完成，复审通过并重新发布</Button>
            : <Button size="sm" colorScheme="teal" isDisabled={!ready} onClick={() => approve(claim.id)}>批准发布并锁定版本</Button>}
          {!ready && <Text alignSelf="center" fontSize="xs" color="gray.500">{stopped ? '仍有事实未完成重认，发布保持停止' : '发布前校验未通过'}</Text>}
        </Flex>
      </Box>
    })}</Flex>
  </Box>
}
