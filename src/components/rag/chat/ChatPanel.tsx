'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Send } from 'lucide-react'
import type { ChatMessage, RagSource } from '@/lib/rag/types'
import { applyRagSseEvent } from '@/lib/rag/chatState'
import { consumeRagChatStream } from '@/lib/rag/chatStream'
import {
  getOrCreateRagSessionId,
  persistRagSessionId,
} from '@/lib/rag/session'
import {
  buildMailtoUrl,
  CONTACT_EMAIL,
  CONTACT_INTENTS,
  CONTACT_PHONE,
  ContactData,
  ContactStage,
  createContactSummary,
  createEmptyContactData,
  detectContactIntent,
  isDirectContactInfoRequest,
  validateContactEmail,
} from '@/lib/rag/contactFlow'
import { MessageBubble } from '@/components/rag/chat/MessageBubble'
import { TypingIndicator } from '@/components/rag/contact/TypingIndicator'
import { SuggestedItem, SuggestedQuestions } from '@/components/rag/chat/SuggestedQuestions'
import { getPageRagContext, getRagPageContextKey } from '@/lib/rag/pageContext'
import { getLoadingStageForEvent, type RagLoadingStage } from '@/lib/rag/chatUi'
import { LoadingStatus } from '@/components/rag/chat/LoadingStatus'

interface RagChatResponse {
  answer?: string
  sources?: RagSource[]
  error?: string
}

export function ChatPanel() {
  const pathname = usePathname()
  const pageContext = getPageRagContext(pathname)
  const pageContextKey = getRagPageContextKey(pathname)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'ask' | 'contact'>('ask')
  const [contactStage, setContactStage] = useState<ContactStage>('intent')
  const [contactData, setContactData] = useState<ContactData>(() => createEmptyContactData())
  const [copiedLabel, setCopiedLabel] = useState('')
  const [loadingStage, setLoadingStage] = useState<RagLoadingStage | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const requestAbortRef = useRef<AbortController | null>(null)
  const requestInFlightRef = useRef(false)
  const loadingStageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    requestAbortRef.current?.abort()
    if (loadingStageTimerRef.current) clearTimeout(loadingStageTimerRef.current)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isLoading, copiedLabel])

  function addUserMessage(content: string) {
    setMessages((prev) => [...prev, { role: 'user', content }])
  }

  function addAssistantMessage(message: Omit<ChatMessage, 'role'>) {
    setMessages((prev) => [...prev, { role: 'assistant', ...message }])
  }

  function startContactFlow() {
    setMode('contact')
    setContactStage('intent')
    setContactData(createEmptyContactData())
    addAssistantMessage({
      content: '当然可以。你想聊哪一类事情？',
      variant: 'contact',
      actions: CONTACT_INTENTS.map((intent) => ({ id: intent.id, label: intent.label, kind: 'secondary' })),
    })
  }

  function showContactInfoCard() {
    addAssistantMessage({
      content: `可以这样联系我：\n邮箱：${CONTACT_EMAIL}\n电话：${CONTACT_PHONE}`,
      variant: 'contact',
      actions: [
        { id: 'copy:email', label: '复制邮箱', kind: 'primary' },
        { id: 'copy:phone', label: '复制电话', kind: 'secondary' },
        { id: 'contact:start', label: '写一封邮件', kind: 'secondary' },
      ],
    })
  }

  function handleContactInput(content: string) {
    if (contactStage === 'intent') {
      addAssistantMessage({
        content: '请先选择一个联系意图，我会帮你整理邮件。',
        variant: 'contact',
        actions: CONTACT_INTENTS.map((intent) => ({ id: intent.id, label: intent.label, kind: 'secondary' })),
      })
      return
    }

    if (contactStage === 'name') {
      if (content.length < 2) {
        addAssistantMessage({ content: '名字至少需要 2 个字符哦。', variant: 'contact' })
        return
      }

      setContactData((prev) => ({ ...prev, name: content }))
      setContactStage('email')
      addAssistantMessage({ content: `好的，${content}。方便留个邮箱吗？这样我可以回复你。`, variant: 'contact' })
      return
    }

    if (contactStage === 'email') {
      if (!validateContactEmail(content)) {
        addAssistantMessage({ content: '这个邮箱格式好像不太对，再检查一下？', variant: 'contact' })
        return
      }

      setContactData((prev) => ({ ...prev, email: content }))
      setContactStage('message')
      addAssistantMessage({ content: '收到。你想具体聊什么？可以简单写下背景或需求。', variant: 'contact' })
      return
    }

    if (contactStage === 'message') {
      if (content.length < 2) {
        addAssistantMessage({ content: '说点什么吧，哪怕只是一句问候。', variant: 'contact' })
        return
      }

      if (content.length > 800) {
        addAssistantMessage({ content: '留言先控制在 800 字以内，方便生成邮件草稿。', variant: 'contact' })
        return
      }

      const nextData = { ...contactData, message: content }
      setContactData(nextData)
      setContactStage('confirm')
      addAssistantMessage({
        content: '我整理好了邮件草稿，确认后可以打开邮箱发送。',
        variant: 'contact',
        contactSummary: createContactSummary(nextData),
        actions: [
          { id: 'contact:send', label: '打开邮箱发送', kind: 'primary' },
          { id: 'copy:email', label: '复制邮箱', kind: 'secondary' },
          { id: 'copy:phone', label: '复制电话', kind: 'secondary' },
          { id: 'contact:restart', label: '重新填写', kind: 'ghost' },
          { id: 'contact:ask', label: '返回问答', kind: 'ghost' },
        ],
      })
    }
  }

  async function copyText(value: string, label?: string) {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = value
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }

    if (label) {
      setCopiedLabel(label)
      setTimeout(() => setCopiedLabel(''), 1800)
    }
  }

  function handleAction(actionId: string) {
    if (actionId.startsWith('intent:')) {
      const intent = actionId.replace('intent:', '')
      setContactData((prev) => ({ ...prev, intent }))
      setContactStage('name')
      addUserMessage(intent)
      addAssistantMessage({ content: '怎么称呼你？', variant: 'contact' })
      return
    }

    if (actionId === 'contact:start') {
      startContactFlow()
      return
    }

    if (actionId === 'contact:restart') {
      startContactFlow()
      return
    }

    if (actionId === 'contact:ask') {
      setMode('ask')
      setContactStage('intent')
      addAssistantMessage({ content: '已回到问答模式。你可以继续问我项目、经历、技术栈或资源。', variant: 'system' })
      return
    }

    if (actionId === 'contact:send') {
      window.location.href = buildMailtoUrl(contactData)
      setContactStage('done')
      addAssistantMessage({ content: '已为你打开邮箱客户端。如果没有弹出，可以复制邮箱或电话直接联系我。', variant: 'contact' })
      return
    }

    if (actionId === 'copy:email') {
      void copyText(CONTACT_EMAIL, '邮箱已复制')
      return
    }

    if (actionId === 'copy:phone') {
      void copyText(CONTACT_PHONE, '电话已复制')
    }
  }

  async function submitMessage(nextMessage?: string) {
    const content = (nextMessage || input).trim()
    if (!content || isLoading || requestInFlightRef.current) return

    addUserMessage(content)
    setInput('')

    if (mode === 'contact') {
      handleContactInput(content)
      return
    }

    if (isDirectContactInfoRequest(content)) {
      showContactInfoCard()
      return
    }

    if (detectContactIntent(content)) {
      startContactFlow()
      return
    }

    setIsLoading(true)
    setLoadingStage('understanding')
    if (loadingStageTimerRef.current) clearTimeout(loadingStageTimerRef.current)
    loadingStageTimerRef.current = setTimeout(() => {
      setLoadingStage('retrieving')
      loadingStageTimerRef.current = null
    }, 500)
    requestInFlightRef.current = true
    const requestController = new AbortController()
    requestAbortRef.current = requestController

    try {
      const sessionId = getOrCreateRagSessionId()
      const response = await fetch('/api/rag/chat', {
        method: 'POST',
        signal: requestController.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          sessionId,
          pageContext: pageContextKey,
        }),
      })

      const contentType = response.headers.get('content-type') || ''

      if (!response.ok) {
        const result = await response.json() as RagChatResponse
        throw new Error(result.error || 'AI 助手暂时不可用')
      }

      // 安全拒绝等仍返回 JSON；正常回答走 SSE 流式
      if (!contentType.includes('text/event-stream')) {
        const result = await response.json() as RagChatResponse
        if (result.error) {
          throw new Error(result.error)
        }
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: result.answer || '我暂时没有生成有效回答。',
          sources: result.sources || [],
        }])
        return
      }

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: '',
        sources: [],
        isComplete: false,
      }])

      await consumeRagChatStream(
        response,
        (event) => {
          if (loadingStageTimerRef.current) {
            clearTimeout(loadingStageTimerRef.current)
            loadingStageTimerRef.current = null
          }
          setLoadingStage(current => getLoadingStageForEvent(current, event.type))
          if (event.type === 'meta' && event.sessionId !== sessionId) {
            persistRagSessionId(event.sessionId)
          }
          setMessages(prev => applyRagSseEvent(prev, event))
        },
      )
    } catch (error) {
      if (requestController.signal.aborted) return
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        const errorText = error instanceof Error ? error.message : 'AI 助手暂时不可用，请稍后再试。'

        // 流式已插入助手气泡：保留部分内容并明确标记未完整。
        if (last?.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            content: last.content.trim() ? last.content : errorText,
            error: errorText,
            isComplete: false,
          }
          return next
        }

        return [...prev, {
          role: 'assistant',
          content: errorText,
          sources: [],
          error: errorText,
          isComplete: false,
        }]
      })
    } finally {
      if (loadingStageTimerRef.current) {
        clearTimeout(loadingStageTimerRef.current)
        loadingStageTimerRef.current = null
      }
      setLoadingStage(null)
      requestInFlightRef.current = false
      if (requestAbortRef.current === requestController) {
        requestAbortRef.current = null
      }
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitMessage()
  }

  return (
    <div className="sg-rag-panel">
      <div className="sg-rag-panel__header">
        <div className="sg-rag-panel__avatar sg-rag-panel__avatar--sprite">
          <Image
            src="/spirit-garden/个人信使角色-透明底.png"
            alt=""
            width={36}
            height={36}
            className="sg-rag-panel__avatar-sprite"
            aria-hidden
          />
        </div>
        <div className="sg-rag-panel__meta">
          <p className="sg-rag-panel__title">
            庭院导引
            <span className="sg-rag-badge">在线</span>
            {mode === 'contact' ? <span className="sg-rag-badge">联系</span> : null}
          </p>
          <p className="sg-rag-panel__subtitle">{pageContext.subtitle}</p>
        </div>
      </div>

      <div className="sg-rag-panel__body">
        {messages.length === 0 ? (
          <div className="sg-rag-welcome-stack sg-rag-welcome-stack--garden">
            <div className="sg-rag-welcome">
              <div className="sg-rag-welcome__illustration" data-testid="rag-welcome-illustration">
                <Image
                  src="/spirit-garden/个人信使角色-透明底.png"
                  alt=""
                  fill
                  sizes="(max-width: 640px) calc(100vw - 48px), 336px"
                  className="sg-rag-welcome__illustration-img"
                  aria-hidden
                />
              </div>
              <div className="sg-rag-welcome__icon">
                <Image
                  src="/spirit-garden/icon-sparkle.png"
                  alt=""
                  width={16}
                  height={16}
                  className="sg-rag-welcome__icon-img"
                  aria-hidden
                  unoptimized
                />
              </div>
              <p className="sg-rag-welcome__title">{pageContext.welcomeTitle}</p>
              <p className="sg-rag-welcome__text">{pageContext.welcomeText}</p>
            </div>
            <SuggestedQuestions
              items={pageContext.suggestions}
              onSelect={(item: SuggestedItem) => {
              if (item.type === 'action' && item.value === 'start-contact') {
                startContactFlow()
                return
              }
              void submitMessage(item.value)
            }} />
          </div>
        ) : null}

        {messages.map((message, index) => (
          <MessageBubble
            key={`${message.role}-${index}`}
            message={message}
            onAction={handleAction}
            onCopy={(content) => void copyText(content)}
          />
        ))}

        {isLoading ? (
          mode === 'contact' ? (
            <TypingIndicator />
          ) : loadingStage ? <LoadingStatus stage={loadingStage} /> : null
        ) : null}

        {copiedLabel ? (
          <div className="sg-rag-toast">{copiedLabel}</div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="sg-rag-panel__footer">
        <div className="sg-rag-input-row">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={mode === 'contact' && contactStage === 'message' ? 800 : 500}
            placeholder={mode === 'contact' ? '继续填写联系信息...' : '问问这个网站和站长...'}
            className="sg-rag-input"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="sg-rag-send"
            aria-label="发送"
          >
            <Send className="sg-rag-send__icon" aria-hidden />
          </button>
        </div>
      </form>
    </div>
  )
}
