import type { User } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getSupabaseAdminClient } from '@/lib/supabase'

export class AuthRequiredError extends Error {
  constructor() {
    super('Faça login para continuar.')
    this.name = 'AuthRequiredError'
  }
}

export class WorkspaceRequiredError extends Error {
  constructor() {
    super('Nenhum workspace encontrado para este usuário.')
    this.name = 'WorkspaceRequiredError'
  }
}

/** Current logged-in user (server-side), or null if unauthenticated / Supabase not configured. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user
}

/** Like getCurrentUser(), but throws AuthRequiredError when there's no session. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) throw new AuthRequiredError()
  return user
}

/** The current user's active workspace id, or null. */
export async function getCurrentWorkspace(): Promise<string | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const admin = getSupabaseAdminClient()
  if (!admin) return null

  const { data: profile } = await admin
    .from('pitbrain_profiles')
    .select('default_workspace_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.default_workspace_id) return profile.default_workspace_id as string

  // Fallback: first workspace this user is a member of (covers profiles created
  // before the default_workspace_id was set, or edge cases in provisioning).
  const { data: membership } = await admin
    .from('pitbrain_workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  return (membership?.workspace_id as string) ?? null
}

/** Like getCurrentWorkspace(), but throws if there's no user or no workspace. */
export async function requireWorkspace(): Promise<{ user: User; workspaceId: string }> {
  const user = await requireUser()
  const workspaceId = await getCurrentWorkspace()
  if (!workspaceId) throw new WorkspaceRequiredError()
  return { user, workspaceId }
}
