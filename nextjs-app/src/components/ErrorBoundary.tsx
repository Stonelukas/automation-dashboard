'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Home, RefreshCw } from 'lucide-react'
import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Log error in production
    if (typeof window !== 'undefined' && typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback component
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return (
          <FallbackComponent 
            error={this.state.error!} 
            reset={this.handleReset} 
          />
        )
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-slate-800/90 border-slate-700 backdrop-blur-sm">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <CardTitle className="text-xl text-slate-100">
                Something went wrong
              </CardTitle>
              <CardDescription className="text-slate-400">
                An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="bg-slate-700 border-slate-600 text-slate-100 hover:bg-slate-600"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.href = '/'}
                  variant="outline"
                  className="bg-slate-700 border-slate-600 text-slate-100 hover:bg-slate-600"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>

              {typeof window !== 'undefined' && typeof process !== 'undefined' && process.env?.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <summary className="cursor-pointer text-slate-300 font-medium mb-2">
                    Error Details (Development)
                  </summary>
                  <pre className="text-xs text-red-400 whitespace-pre-wrap overflow-auto">
                    {this.state.error.message}{this.state.error.stack && `\n\nStack trace:\n${this.state.error.stack}`}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// React hook version for functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  const captureError = React.useCallback((error: Error) => {
    setError(error)
  }, [])

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return { captureError, resetError }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

export default ErrorBoundary