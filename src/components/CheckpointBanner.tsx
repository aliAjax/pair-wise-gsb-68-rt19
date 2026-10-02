import { Alert, AlertDescription, AlertIcon, Box, Button, Flex, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { useClaimStore } from '../store/useClaimStore'

/** 本机写入失败后的检查点条：只在对应主张的工作区允许恢复，只补未完成事实和审计 */
export function CheckpointBanner() {
  const navigate = useNavigate()
  const checkpoint = useClaimStore((state) => state.checkpoint)
  const recover = useClaimStore((state) => state.recoverCheckpoint)
  const dismiss = useClaimStore((state) => state.dismissCheckpoint)
  if (!checkpoint) return null
  const total = checkpoint.pendingItems.length
  const done = checkpoint.completedItems.length
  return <Box px="6" pt="4">
    <Alert status={checkpoint.finished ? 'success' : 'warning'} variant="left-accent">
      <AlertIcon />
      <AlertDescription flex="1">
        {checkpoint.finished
          ? <>检查点 {checkpoint.id} 已恢复完成：全部 {total} 条事实与审计补齐，未重复记录。</>
          : <>本机写入中断：检查点 <Text as="span" fontFamily="mono">{checkpoint.id}</Text> 已完成 {done}/{total} 条。恢复时只补未完成事实和审计，不重复记录。</>}
      </AlertDescription>
      <Flex gap="2">
        {!checkpoint.finished && <>
          <Button size="xs" colorScheme="orange" onClick={() => { const r = recover(); if (r.ok) navigate(`/claims/${checkpoint.claimId}`) }}>从检查点恢复</Button>
          <Button size="xs" variant="outline" onClick={() => navigate(`/claims/${checkpoint.claimId}`)}>前往主张</Button>
        </>}
        {checkpoint.finished && <Button size="xs" variant="ghost" onClick={dismiss}>关闭</Button>}
      </Flex>
    </Alert>
  </Box>
}
