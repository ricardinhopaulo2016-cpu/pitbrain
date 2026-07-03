import { NextResponse } from 'next/server'
import { getCurrentUser, getCurrentWorkspace } from '@/lib/auth/get-current-user'
import { getSupabaseAdminClient } from '@/lib/supabase'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: true, user: null, workspaceName: null })
  }

  const workspaceId = await getCurrentWorkspace()
  let workspaceName: string | null = null

  const admin = getSupabaseAdminClient()
  if (workspaceId && admin) {
    const { data } = await admin.from('pitbrain_workspaces').select('name').eq('id', workspaceId).maybeSingle()
    workspaceName = (data?.name as string) ?? null
  }

  return NextResponse.json({ ok: true, user: { email: user.email }, workspaceName })
}
