'use client'

import React, { Suspense } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { SuspenseFallback } from './LoadingStates'

interface LayoutWrapperProps {
  children: React.ReactNode
  title?: string
  description?: string
}

export function LayoutWrapper({ children, title, description }: LayoutWrapperProps) {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 relative">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <div className="container mx-auto px-4 py-6 max-w-7xl relative z-10">
          {(title || description) && (
            <header className="mb-8 elevated-surface p-6 floating-card">
              {title && (
                <h1 className="text-5xl font-bold text-slate-100 mb-3 drop-shadow-2xl bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                  🚀 {title}
                </h1>
              )}
              {description && (
                <p className="text-slate-300 text-xl opacity-90">
                  {description}
                </p>
              )}
            </header>
          )}
          
          <Suspense fallback={<SuspenseFallback message="Loading dashboard..." />}>
            {children}
          </Suspense>
        </div>
      </div>
    </ErrorBoundary>
  )
}

interface TabsProps {
  activeTab: string
  onTabChange: (tab: string) => void
  tabs: Array<{
    id: string
    label: string
    icon?: React.ReactNode
  }>
  className?: string
}

export function Tabs({ activeTab, onTabChange, tabs, className = '' }: TabsProps) {
  return (
    <div className={`dashboard-tabs w-fit ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          type="button"
        >
          {tab.icon && <span className="mr-2">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

interface StatusBarProps {
  connectionStatus: 'connected' | 'disconnected' | 'error'
  stage?: string
  className?: string
}

export function StatusBar({ connectionStatus, stage, className = '' }: StatusBarProps) {
  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected'
      case 'disconnected': return 'Disconnected'
      case 'error': return 'Connection Error'
      default: return 'Unknown'
    }
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-400'
      case 'disconnected': return 'text-red-400'
      case 'error': return 'text-yellow-400'
      default: return 'text-slate-400'
    }
  }

  return (
    <div className={`glass-container p-4 rounded-lg ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div 
              className={`w-3 h-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400' :
                connectionStatus === 'disconnected' ? 'bg-red-400' : 'bg-yellow-400'
              }`}
            />
            <span className={`font-medium ${getStatusColor()}`}>
              {getConnectionStatusText()}
            </span>
          </div>
          
          {stage && stage !== 'idle' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Operation:</span>
              <span className="text-slate-300 font-medium capitalize">
                {stage}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface SystemInfoProps {
  stats: {
    cpuUsage: number
    memoryUsage: number
    diskUsage: number
    uptime: string
  }
  className?: string
}

export function SystemInfo({ stats, className = '' }: SystemInfoProps) {
  return (
    <div className={`system-info ${className}`}>
      <h2>System Information</h2>
      <div className="system-stats">
        <div className="stat">
          <span className="stat-label">CPU Usage:</span>
          <span className="stat-value">{stats.cpuUsage}%</span>
        </div>
        <div className="stat">
          <span className="stat-label">Memory:</span>
          <span className="stat-value">{stats.memoryUsage}%</span>
        </div>
        <div className="stat">
          <span className="stat-label">Disk:</span>
          <span className="stat-value">{stats.diskUsage}%</span>
        </div>
        <div className="stat">
          <span className="stat-label">Uptime:</span>
          <span className="stat-value">{stats.uptime}</span>
        </div>
      </div>
    </div>
  )
}
