import { NextResponse } from 'next/server'
import { guardAuthorizedAccess } from '@/lib/auth/get-current-user'
import { getMcpStatus } from '@/lib/utmify-mcp/utmify-mcp-service'

/** Lightweight status/test-connection endpoint — never calls a tool, just lists them. */
export async function GET() {
  const denied = await guardAuthorizedAccess()
  if (denied) return denied

  const status = await getMcpStatus()
  return NextResponse.json(status)
}
