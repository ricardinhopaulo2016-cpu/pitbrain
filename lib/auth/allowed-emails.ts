/**
 * Server-only allowlist gate. PITBRAIN_ALLOWED_EMAILS is a comma-separated
 * list of emails permitted to use the Pitbrain — everyone else is treated as
 * unauthenticated, even with a valid Supabase session.
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false

  const raw = process.env.PITBRAIN_ALLOWED_EMAILS ?? ''
  const allowed = raw
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  return allowed.includes(email.trim().toLowerCase())
}
