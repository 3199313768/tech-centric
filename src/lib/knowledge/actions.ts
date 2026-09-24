'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/auth/requireUser'
import { createClient } from '@/lib/supabase/server'
import type { KbRecord } from '@/lib/knowledge/types'
import { isKbRecordType } from '@/lib/knowledge/constants'
import { scheduleRagReindex } from '@/lib/rag/reindexTrigger'
import { knowledgePublicRoute } from '@/lib/site/routes'

const INVALID_RECORD_TYPE_ERROR = '类型必须是笔记、代码、图片或附件'

export async function deleteKbRecord(recordId: string): Promise<{ error: string | null }> {
  const { user, error: authError } = await requireSuperAdmin()
  if (authError || !user) return { error: authError ?? '请先登录' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('kb_records')
    .delete()
    .eq('id', recordId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/knowledge')
  scheduleRagReindex('kb_delete')
  return { error: null }
}

export interface UpdateKbRecordInput {
  content: string
  tags: string[]
  type: string
  isPublic?: boolean
}

export async function updateKbRecord(
  recordId: string,
  input: UpdateKbRecordInput,
): Promise<{ error: string | null }> {
  const { user, error: authError } = await requireSuperAdmin()
  if (authError || !user) return { error: authError ?? '请先登录' }
  if (!isKbRecordType(input.type)) return { error: INVALID_RECORD_TYPE_ERROR }

  const supabase = await createClient()
  const { error } = await supabase
    .from('kb_records')
    .update({
      content: input.content,
      tags: input.tags,
      type: input.type,
      ...(input.isPublic !== undefined ? { is_public: input.isPublic } : {}),
    })
    .eq('id', recordId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/knowledge')
  revalidatePath(knowledgePublicRoute(recordId))
  if (input.isPublic !== false) {
    scheduleRagReindex('kb_update')
  }
  return { error: null }
}

export async function createKbRecord(input: {
  type: string
  content: string
  tags: string[]
  isPublic?: boolean
}): Promise<{ error: string | null; record?: KbRecord }> {
  const { user, error: authError } = await requireSuperAdmin()
  if (authError || !user) return { error: authError ?? '请先登录' }
  if (!isKbRecordType(input.type)) return { error: INVALID_RECORD_TYPE_ERROR }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('kb_records')
    .insert({
      user_id: user.id,
      type: input.type,
      content: input.content,
      tags: input.tags,
      is_public: input.isPublic ?? false,
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/knowledge')
  if (input.isPublic) {
    scheduleRagReindex('kb_create')
  }
  return { error: null, record: data as KbRecord }
}
