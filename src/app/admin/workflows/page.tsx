import { WorkflowWorkbench } from '@/components/admin/workflows/WorkflowWorkbench'
import { normalizeWorkflowCanvas } from '@/lib/workflows/normalize'
import { normalizeWorkflowRuns } from '@/lib/workflows/runs'
import { requireSuperAdmin } from '@/lib/auth/requireUser'

export default async function AdminWorkflowsPage() {
  const { user } = await requireSuperAdmin()
  if (!user) return null

  const initialMetadata = normalizeWorkflowCanvas(user.user_metadata?.workflow_canvas)
  const initialRuns = normalizeWorkflowRuns(user.user_metadata?.workflow_runs, initialMetadata.workflows)
  return <WorkflowWorkbench initialMetadata={initialMetadata} initialRuns={initialRuns} userId={user.id} />
}
