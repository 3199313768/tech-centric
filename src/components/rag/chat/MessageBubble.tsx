'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import type { ChatMessage } from '@/lib/rag/types'
import { ContactActions } from '@/components/rag/contact/ContactActions'
import { ContactSummary } from '@/components/rag/contact/ContactSummary'
import { SourceList } from '@/components/rag/chat/SourceList'
import { AnswerFeedback } from '@/components/rag/chat/AnswerFeedback'
import { AnswerActions } from '@/components/rag/chat/AnswerActions'

interface MessageBubbleProps {
  message: ChatMessage
  onAction?: (actionId: string) => void
  onCopy?: (content: string) => void
}

function getBubbleClassName(message: ChatMessage) {
  if (message.role === 'user') return 'sg-rag-bubble sg-rag-bubble--user'
  if (message.variant === 'contact') return 'sg-rag-bubble sg-rag-bubble--contact'
  return 'sg-rag-bubble sg-rag-bubble--assistant'
}

const bubbleMotion = {
  initial: { opacity: 0, y: 14, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: 'spring' as const, stiffness: 260, damping: 22 },
}

export function MessageBubble({ message, onAction, onCopy }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const showFeedback = !isUser
    && (message.variant === undefined || message.variant === 'default')
    && message.isComplete === true
    && !message.error
    && Boolean(message.responseId && message.sessionId)

  const bubble = (
    <motion.div className={getBubbleClassName(message)} {...bubbleMotion}>
      <AnswerActions message={message} onAction={onAction} onCopy={onCopy} />
      {!isUser && message.error ? (
        <div className="sg-kb-error sg-kb-error--inline" role="alert">
          回答未完整：{message.error}
        </div>
      ) : null}
      {message.contactSummary ? <ContactSummary summary={message.contactSummary} /> : null}
      {!isUser ? <SourceList sources={message.sources || []} /> : null}
      {!isUser && onAction ? <ContactActions actions={message.actions || []} onAction={onAction} /> : null}
      {showFeedback && message.responseId && message.sessionId ? (
        <AnswerFeedback responseId={message.responseId} sessionId={message.sessionId} />
      ) : null}
    </motion.div>
  )

  if (isUser) {
    return <div className="sg-rag-row sg-rag-row--user">{bubble}</div>
  }

  return (
    <div className="sg-rag-row sg-rag-row--assistant">
      <Image
        src="/spirit-garden/个人信使角色-透明底.png"
        alt=""
        width={28}
        height={28}
        className="sg-rag-bubble__avatar"
        aria-hidden
      />
      {bubble}
    </div>
  )
}
