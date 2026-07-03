'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'

const CHROMELESS_PREFIXES = ['/login', '/register']

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const chromeless = CHROMELESS_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))

  if (chromeless) return <>{children}</>

  return (
    <>
      <Sidebar />
      <div className="ml-60 flex-1 min-h-screen flex flex-col">
        {children}
      </div>
    </>
  )
}
