'use client'

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  return (
    <Loader2 
      className={cn(
        'animate-spin text-blue-500',
        sizeClasses[size],
        className
      )} 
    />
  )
}

interface LoadingStateProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  variant?: 'inline' | 'overlay' | 'page'
}

export function LoadingState({ 
  message = 'Loading...', 
  size = 'md', 
  className,
  variant = 'inline'
}: LoadingStateProps) {
  const baseClasses = 'flex items-center justify-center gap-3'
  
  const variantClasses = {
    inline: 'p-4',
    overlay: 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50',
    page: 'min-h-screen bg-gradient-to-br from-slate-900 to-slate-800'
  }

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)}>
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size={size} />
        <p className="text-slate-300 text-sm animate-pulse">
          {message}
        </p>
      </div>
    </div>
  )
}

interface SuspenseFallbackProps {
  message?: string
}

export function SuspenseFallback({ message = 'Loading...' }: SuspenseFallbackProps) {
  return (
    <div className="w-full h-32 flex items-center justify-center">
      <div className="glass-container p-6 rounded-lg">
        <LoadingState message={message} variant="inline" />
      </div>
    </div>
  )
}

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
}

export function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 w-full',
    circular: 'rounded-full',
    rectangular: 'rounded-md'
  }

  return (
    <div 
      className={cn(
        'animate-pulse bg-slate-700/50',
        variantClasses[variant],
        className
      )} 
    />
  )
}

interface TableSkeletonProps {
  rows?: number
  columns?: number
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-6" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  )
}
