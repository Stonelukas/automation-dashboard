'use client'

import { Suspense } from 'react'
import { PerformanceMonitor } from './PerformanceMonitor'

interface OptimizedLayoutProps {
  children: React.ReactNode
  enablePerformanceMonitor?: boolean
}

export function OptimizedLayout({ children, enablePerformanceMonitor = false }: OptimizedLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Global styles for enhanced performance */}
      <style jsx global>{`
        /* Performance optimizations */
        * {
          will-change: auto;
        }
        
        /* Optimized scrolling */
        html {
          scroll-behavior: smooth;
        }
        
        /* Reduce layout thrashing */
        .glass-card {
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        
        /* Optimize animations */
        .floating-card {
          animation: fadeIn 0.5s ease-out;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* Container queries for responsive design */
        @container (min-width: 768px) {
          .responsive-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        @container (min-width: 1024px) {
          .responsive-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
      
      {/* Main content with error boundary */}
      <Suspense fallback={<div className="flex items-center justify-center h-screen text-white">Loading...</div>}>
        {children}
      </Suspense>
      
      {/* Performance monitoring (development only) */}
      {enablePerformanceMonitor && typeof window !== 'undefined' && typeof process !== 'undefined' && process.env?.NODE_ENV === 'development' && (
        <PerformanceMonitor enabled={true} />
      )}
    </div>
  )
}
