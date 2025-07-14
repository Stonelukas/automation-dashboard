'use client'

import { useCallback, useEffect, useState } from 'react'

interface PerformanceMetrics {
  renderTime: number
  memoryUsage: number
  fcp: number // First Contentful Paint
  lcp: number // Largest Contentful Paint
  cls: number // Cumulative Layout Shift
  fid: number // First Input Delay
}

interface PerformanceMonitorProps {
  enabled?: boolean
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void
}

export function PerformanceMonitor({ enabled = false, onMetricsUpdate }: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    fcp: 0,
    lcp: 0,
    cls: 0,
    fid: 0,
  })

  const measurePerformance = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return

    // Measure rendering performance
    const now = performance.now()
    
    // Memory usage (if available)
    const memoryInfo = (performance as any).memory
    const memoryUsage = memoryInfo ? memoryInfo.usedJSHeapSize / 1024 / 1024 : 0

    // Web Vitals
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      
      entries.forEach((entry) => {
        switch (entry.entryType) {
          case 'paint':
            if (entry.name === 'first-contentful-paint') {
              setMetrics(prev => ({ ...prev, fcp: entry.startTime }))
            }
            break
          case 'largest-contentful-paint':
            setMetrics(prev => ({ ...prev, lcp: entry.startTime }))
            break
          case 'layout-shift':
            if (!(entry as any).hadRecentInput) {
              setMetrics(prev => ({ ...prev, cls: prev.cls + (entry as any).value }))
            }
            break
          case 'first-input':
            setMetrics(prev => ({ ...prev, fid: (entry as any).processingStart - entry.startTime }))
            break
        }
      })
    })

    try {
      observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'layout-shift', 'first-input'] })
    } catch (error) {
      console.warn('Performance observer not supported:', error)
    }

    setMetrics(prev => ({
      ...prev,
      renderTime: now,
      memoryUsage,
    }))

    return () => observer.disconnect()
  }, [enabled])

  useEffect(() => {
    const cleanup = measurePerformance()
    
    const interval = setInterval(measurePerformance, 5000) // Update every 5 seconds
    
    return () => {
      cleanup?.()
      clearInterval(interval)
    }
  }, [measurePerformance])

  useEffect(() => {
    if (onMetricsUpdate) {
      onMetricsUpdate(metrics)
    }
  }, [metrics, onMetricsUpdate])

  if (!enabled) return null

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono z-50">
      <div className="space-y-1">
        <div>Memory: {metrics.memoryUsage.toFixed(1)}MB</div>
        <div>FCP: {metrics.fcp.toFixed(0)}ms</div>
        <div>LCP: {metrics.lcp.toFixed(0)}ms</div>
        <div>CLS: {metrics.cls.toFixed(3)}</div>
        <div>FID: {metrics.fid.toFixed(0)}ms</div>
      </div>
    </div>
  )
}
