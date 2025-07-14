'use client'

import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'

interface DryRunBadgeProps {
  dryRun: boolean
}

export function DryRunBadge({ dryRun }: DryRunBadgeProps) {
  const [mounted, setMounted] = useState(false)

  // Only show the actual content after the component has mounted (hydration complete)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Show a neutral state during SSR and initial hydration
  if (!mounted) {
    return (
      <Badge variant="secondary">
        🔄 Loading...
      </Badge>
    )
  }

  // Show the actual state after hydration
  return (
    <Badge variant={dryRun ? "secondary" : "destructive"}>
      {dryRun ? "🧪 Testing Mode" : "🔴 Live Mode"}
    </Badge>
  )
}
