import { cn } from '@/lib/utils'

interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <main className={cn('flex-1 p-6 max-w-[1400px] w-full', className)}>
      {children}
    </main>
  )
}
