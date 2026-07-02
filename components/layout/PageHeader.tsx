'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { Brain } from 'lucide-react'

export interface PageHeaderChip {
  label: string
  icon?: LucideIcon
}

export interface PageHeaderAction {
  label: string
  icon?: LucideIcon
  onClick?: () => void
  href?: string
}

interface PageHeaderProps {
  title: string
  chips?: PageHeaderChip[]
  action?: PageHeaderAction
  className?: string
}

export function PageHeader({ title, chips, action, className }: PageHeaderProps) {
  const ActionIcon = action?.icon ?? Brain

  return (
    <div className={cn('pb-5 mb-6', className)}
      style={{ borderBottom: '1px solid rgba(42, 42, 64, 0.6)' }}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Title */}
        <h1 className="text-xl font-bold text-pb-text text-glow-purple tracking-tight leading-none pt-0.5">
          {title}
        </h1>

        {/* Action button */}
        {action && (
          action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-2 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all shrink-0"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                boxShadow: '0 0 0 1px rgba(124, 58, 237, 0.4), 0 4px 12px rgba(124, 58, 237, 0.2)',
              }}
            >
              <ActionIcon className="h-4 w-4" />
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all shrink-0 hover:opacity-90 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                boxShadow: '0 0 0 1px rgba(124, 58, 237, 0.4), 0 4px 12px rgba(124, 58, 237, 0.2)',
              }}
            >
              <ActionIcon className="h-4 w-4" />
              {action.label}
            </button>
          )
        )}
      </div>

      {/* Context chips */}
      {chips && chips.length > 0 && (
        <div className="flex items-center flex-wrap gap-2 mt-3">
          {chips.map((chip, i) => {
            const ChipIcon = chip.icon
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1"
                style={{
                  background: 'rgba(21, 21, 40, 0.8)',
                  border: '1px solid rgba(42, 42, 64, 0.7)',
                }}
              >
                {ChipIcon && <ChipIcon className="h-3 w-3 text-pb-muted/60" />}
                <span className="text-[11px] text-pb-muted/80 font-medium">{chip.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
