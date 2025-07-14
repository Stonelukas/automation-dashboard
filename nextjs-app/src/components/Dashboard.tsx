'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { useFolderBrowser } from '../hooks/useFolderBrowser';
import { useSocket } from '../hooks/useSocket';
import type { AppState, DashboardTab, FolderBrowserState, SystemStats } from '../types/dashboard';
import {
    handleScanOnly,
    handleStartCleanup
} from '../utils/businessLogic';
import { ErrorBoundary } from './ErrorBoundary';
import { FileListModal } from './FileListModal';
import { LoadingState, SuspenseFallback } from './LoadingStates';
import { OperationControls } from './OperationControls';
import { PathSettings } from './PathSettings';
import { ProcessingSettings } from './ProcessingSettings';
import { ProgressBar } from './ProgressBar';
import { StatusBadge } from './StatusBadge';

const Dashboard: React.FC = () => {
  // Custom hooks for state management
  const appState = useAppState();
  const folderBrowser = useFolderBrowser();
  useSocket(appState, folderBrowser);

  // Layout state
  const [activeTab, setActiveTab] = useState<DashboardTab>('file-scanner');
  
  // Mock system stats (in a real app, this would come from an API)
  const [systemStats] = useState<SystemStats>({
    cpuUsage: 25.3,
    memoryUsage: 67.8,
    diskUsage: 45.2,
    uptime: '2d 14h 32m'
  });

  // Performance optimization: Memoize expensive operations
  const operationHandlers = useMemo(() => ({
    onScanOnly: async () => {
      try {
        await handleScanOnly(appState);
      } catch (error) {
        console.error('Scan operation failed:', error);
        appState.setErrors([...(appState.errors || []), 'Scan operation failed']);
      }
    },
    onStartCleanup: async () => {
      try {
        await handleStartCleanup(appState);
      } catch (error) {
        console.error('Cleanup operation failed:', error);
        appState.setErrors([...(appState.errors || []), 'Cleanup operation failed']);
      }
    },
    onLoadScanResults: () => {
      console.log('Load scan results not yet implemented');
    }
  }), [appState]);

  // Performance optimization: Memoize connection status
  const connectionStatusText = useMemo(() => {
    switch (appState.connectionStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      default: return 'Unknown';
    }
  }, [appState.connectionStatus]);

  // Performance optimization: Memoize tab change handler
  const handleTabChange = useCallback((tab: DashboardTab) => {
    setActiveTab(tab);
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header - Enhanced with visual effects */}
          <div className="mb-8 elevated-surface p-6 floating-card shimmer">
            <h1 className="text-5xl font-bold mb-3 drop-shadow-2xl bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              🚀 Automation Dashboard
            </h1>
            <p className="text-slate-300 text-xl opacity-90">
              Modern File Management & Organization System
            </p>
          </div>
          
          {/* Status Bar - Enhanced */}
          <div className="glass-card elevated-surface p-4 mb-6 rounded-xl floating-card neon-glow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="status-indicator">
                  <StatusBadge status={appState.connectionStatus} />
                  <span className="text-slate-200 font-medium">{connectionStatusText}</span>
                </div>
                {appState.stage !== 'idle' && (
                  <div className="status-indicator">
                    <span className="text-slate-400">
                      Operation: <strong className="text-blue-300">{appState.stage}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs - Enhanced */}
          <div className="dashboard-tabs mb-6 w-fit gradient-border interactive-element">
            <div 
              className={`dashboard-tab ${activeTab === 'dashboard' ? 'active neon-glow' : ''} transition-all duration-300`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </div>
            <div 
              className={`dashboard-tab ${activeTab === 'file-scanner' ? 'active neon-glow' : ''} transition-all duration-300`}
              onClick={() => setActiveTab('file-scanner')}
            >
              📁 File Scanner
            </div>
          </div>

          {/* Content */}
          <div className="dashboard-content">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* System Info - Enhanced */}
                <div className="system-info elevated-surface floating-card">
                  <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    ⚡ System Information
                  </h2>
                  <div className="system-stats grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="stat glass-card p-4 rounded-xl interactive-element">
                      <span className="stat-label text-slate-400 text-sm">CPU Usage:</span>
                      <span className="stat-value text-2xl font-bold text-blue-400">25.3%</span>
                    </div>
                    <div className="stat glass-card p-4 rounded-xl interactive-element">
                      <span className="stat-label text-slate-400 text-sm">Memory Usage:</span>
                      <span className="stat-value text-2xl font-bold text-green-400">48.7%</span>
                    </div>
                    <div className="stat glass-card p-4 rounded-xl interactive-element">
                      <span className="stat-label text-slate-400 text-sm">Disk Usage:</span>
                      <span className="stat-value text-2xl font-bold text-yellow-400">67.2%</span>
                    </div>
                    <div className="stat glass-card p-4 rounded-xl interactive-element">
                      <span className="stat-label text-slate-400 text-sm">Uptime:</span>
                      <span className="stat-value text-2xl font-bold text-purple-400">15h 32m</span>
                    </div>
                  </div>
                </div>
                
                {/* Tasks section placeholder - Enhanced */}
                <div className="glass-card elevated-surface p-6 floating-card shimmer">
                  <h2 className="text-2xl font-semibold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    🔄 Automation Tasks
                  </h2>
                  <div className="text-center py-8 text-white/70">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-2xl">⚙️</span>
                    </div>
                    <p className="text-lg">No automation tasks configured yet.</p>
                    <p className="text-sm mt-2 text-slate-400">Click "Create New Task" to get started.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'file-scanner' && (
              <div className="space-y-6">
                {/* Main Content Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {/* Path Settings */}
                    <div className="glass-container p-6 rounded-lg">
                      <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                        📁 Path Settings
                      </h3>
                      <PathSettings 
                        appState={appState}
                        folderBrowser={folderBrowser}
                      />
                    </div>

                    {/* Processing Settings */}
                    <div className="glass-container p-6 rounded-lg">
                      <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                        ⚙️ Processing Settings
                      </h3>
                      <ProcessingSettings appState={appState} />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    {/* Operation Controls */}
                    <div className="glass-container p-6 rounded-lg">
                      <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                        ⚡ Operation Controls
                      </h3>
                      <OperationControls
                        appState={appState}
                        onScanOnly={operationHandlers.onScanOnly}
                        onStartCleanup={operationHandlers.onStartCleanup}
                        onLoadScanResults={operationHandlers.onLoadScanResults}
                      />
                    </div>

                    {/* Progress Section */}
                    {appState.stage !== 'idle' && (
                      <div className="glass-container p-6 rounded-lg">
                        <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                          📈 Progress
                        </h3>
                        <ProgressBar 
                          progress={appState.progress} 
                          stage={appState.stage}
                        />
                        
                        {appState.stage === 'waiting' && (
                          <div className="mt-4 flex gap-3 justify-center">
                            <button
                              onClick={() => appState.socket?.emit('confirm')}
                              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors"
                            >
                              {appState.dryRun ? 'Confirm Preview' : 'Confirm & Execute'}
                            </button>
                            <button
                              onClick={() => appState.socket?.emit('cancel')}
                              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Logs Section */}
                {appState.logs.length > 0 && (
                  <div className="glass-container p-6 rounded-lg">
                    <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                      📋 Operation Logs
                    </h3>
                    <div className="bg-black/20 border border-white/20 rounded-lg p-4 max-h-60 overflow-y-auto">
                      <div className="space-y-1 font-mono text-sm">
                        {appState.logs.map((log: string, index: number) => (
                          <div 
                            key={index} 
                            className={`text-white/90 ${
                              log.toLowerCase().includes('error') ? 'text-red-400' :
                              log.toLowerCase().includes('warning') ? 'text-yellow-400' :
                              log.toLowerCase().includes('success') ? 'text-green-400' :
                              log.toLowerCase().includes('[dry run]') ? 'text-blue-400' :
                              'text-white/90'
                            }`}
                          >
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Errors Section */}
                {appState.errors.length > 0 && (
                  <div className="glass-container p-6 rounded-lg border-l-4 border-red-400">
                    <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                      ⚠️ Errors
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {appState.errors.map((error: string, index: number) => (
                        <div key={index} className="text-red-400 p-3 bg-red-900/20 rounded border border-red-500/30">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* File List Modal */}
          {appState.showFileListModal && (
            <FileListModal
              appState={appState}
              onClose={() => appState.setShowFileListModal(false)}
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Dashboard;
