import { PageHeader, StatusMessage } from '@oxygen-design/patterns'
import { WorkflowWorkbench } from '@/components/admin/workflows/WorkflowWorkbench'
import { requireSuperAdmin } from '@/lib/auth/requireUser'
import { createClient } from '@/lib/supabase/server'
import { normalizeWorkflowCanvas } from '@/lib/workflows/normalize'
import { normalizeWorkflowRuns } from '@/lib/workflows/runs'
import { readWorkflowState } from '@/lib/workflows/stateStore'

export default async function AdminWorkflowsPage() {
  const { user } = await requireSuperAdmin()
  if (!user) return null

  const state = await readWorkflowState(await createClient(), user.id)
  if (state.error) {
    return (
      <div className="oxygen-admin-page">
        <PageHeader title="流程工作台" description="把思考方式画出来，再逐步变成可执行流程。" />
        <StatusMessage title="流程加载失败" tone="error">{state.error}</StatusMessage>
      </div>
    )
  }

  const initialMetadata = normalizeWorkflowCanvas(state.canvas)
  const initialRuns = normalizeWorkflowRuns(state.runs, initialMetadata.workflows)
  return <WorkflowWorkbench initialMetadata={initialMetadata} initialRuns={initialRuns} userId={user.id} />
}
