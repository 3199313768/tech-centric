'use client'

import { useMemo, useState } from 'react'
import { CircleCheck, CircleX, Play, RotateCcw } from 'lucide-react'
import { getRunProgress } from '@/lib/workflows/runtime'
import type { WorkflowDocument, WorkflowRun, WorkflowValue, WorkflowValueMap } from '@/lib/workflows/types'

interface WorkflowPlayerProps {
  workflow: WorkflowDocument
  run: WorkflowRun | null
  recoverableRuns: WorkflowRun[]
  onStart: (inputs: WorkflowValueMap) => void
  onResolve: (response: WorkflowValue) => void
  onResume: (runId: string) => void
  onCancel: () => void
  onRetrySave: () => void
  saveError: Error | null
}

export function WorkflowPlayer({ workflow, run, recoverableRuns, onStart, onResolve, onResume, onCancel, onRetrySave, saveError }: WorkflowPlayerProps) {
  const [inputValue, setInputValue] = useState('')
  const progress = useMemo(() => run ? getRunProgress(run, workflow) : null, [run, workflow])
  const waiting = run?.waiting ?? null
  const isActive = run?.status === 'running' || run?.status === 'waiting'

  const submitInput = () => {
    if (inputValue.trim()) onResolve(inputValue.trim())
  }

  return (
    <section className="sg-workflow-player" aria-label="流程播放器">
      <div className="sg-workflow-player__header">
        <div>
          <span className="sg-workflow-eyebrow">WORKFLOW PLAYER</span>
          <h2>{workflow.name}</h2>
        </div>
        {progress ? <span className="sg-workflow-player__progress" role="status">已完成 {progress.completed} / {progress.total}</span> : null}
      </div>

      {!run ? (
        <div className="sg-workflow-player__empty">
          <p>从流程入口开始一次新的运行，遇到人工节点时会暂停等待。</p>
          <button type="button" className="sg-btn sg-btn--primary" onClick={() => onStart({})}><Play aria-hidden size={15} />开始运行</button>
          {recoverableRuns.length > 0 ? <div className="sg-workflow-player__recoveries"><strong>可恢复运行</strong>{recoverableRuns.map((item) => <button type="button" className="sg-btn sg-btn--ghost" key={item.id} onClick={() => onResume(item.id)}>恢复运行 · {new Date(item.updatedAt).toLocaleString()}</button>)}</div> : null}
        </div>
      ) : (
        <div className="sg-workflow-player__body">
          <div className="sg-workflow-player__state"><span className={`sg-workflow-player__status sg-workflow-player__status--${run.status}`}>{run.status === 'waiting' ? '等待人工操作' : run.status === 'running' ? '运行中' : run.status === 'completed' ? '已完成' : run.status === 'cancelled' ? '已取消' : '运行失败'}</span><span>{progress?.currentTitle ?? '流程结束'}</span></div>
          {run.status === 'waiting' && waiting ? <div className="sg-workflow-player__waiting">
            <h3>{waiting.prompt}</h3>
            {waiting.kind === 'input' ? <div className="sg-workflow-player__input-row"><input className="sg-form-input" value={inputValue} onChange={(event) => setInputValue(event.target.value)} aria-label="人工输入" /><button type="button" className="sg-btn sg-btn--primary" onClick={submitInput} disabled={!inputValue.trim()}>提交输入</button></div> : null}
            {waiting.kind === 'confirm' ? <div className="sg-workflow-player__actions"><button type="button" className="sg-btn sg-btn--primary" onClick={() => onResolve(true)}><CircleCheck aria-hidden size={15} />确认继续</button><button type="button" className="sg-btn sg-btn--ghost" onClick={onCancel}><CircleX aria-hidden size={15} />取消运行</button></div> : null}
            {waiting.kind === 'select' ? <div className="sg-workflow-player__options">{(waiting.options ?? [{ value: 'yes', label: '是' }, { value: 'no', label: '否' }]).map((option) => <button type="button" className="sg-btn sg-btn--ghost" key={option.value} onClick={() => onResolve(option.value)}>{option.label}</button>)}</div> : null}
          </div> : null}
          {run.status === 'running' ? <button type="button" className="sg-btn sg-btn--primary" onClick={() => onResume(run.id)}><Play aria-hidden size={15} />继续运行</button> : null}
          {run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled' ? <button type="button" className="sg-btn sg-btn--ghost" onClick={() => onStart({})}><RotateCcw aria-hidden size={15} />开始新运行</button> : null}
          {isActive ? <button type="button" className="sg-btn sg-btn--ghost" onClick={onCancel}>取消运行</button> : null}
          {run.error ? <p className="sg-workflow-player__error" role="alert">{run.error}</p> : null}
        </div>
      )}

      {saveError ? <div className="sg-workflow-player__error" role="alert">运行状态保存失败：{saveError.message}<button type="button" className="sg-btn sg-btn--ghost" onClick={onRetrySave}>重试保存</button></div> : null}
    </section>
  )
}
