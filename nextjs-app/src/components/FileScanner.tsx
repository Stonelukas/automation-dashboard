'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppState } from '@/hooks/useAppState';
import { useFolderBrowser } from '@/hooks/useFolderBrowser';
import { useSocket } from '@/hooks/useSocket';
import { useDebounce } from '@/hooks/useUtilities';
import {
    getStatusMessage,
    handleLoadScanResults,
    handleScanOnly,
    handleStartCleanup
} from '@/utils/businessLogic';
import { validatePath } from '@/utils/validation';
import React, { useCallback, useEffect, useRef } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { FileListModal } from './FileListModal';
import { OperationControls } from './OperationControls';
import { PathSettings } from './PathSettings';
import { ProcessingSettings } from './ProcessingSettings';
import { ProgressBar } from './ProgressBar';
import { StatusBadge } from './StatusBadge';

export default function FileScanner() {
  const appState = useAppState()
  const {
    socket,
    setSocket,
    connectionStatus,
    setConnectionStatus,
    stage,
    setStage,
    detailedStage,
    setDetailedStage,
    logs,
    setLogs,
    progress,
    setProgress,
    errors,
    setErrors,
    startFolder,
    setStartFolder,
    videoMoveTarget,
    setVideoMoveTarget,
    ignoreFolders,
    setIgnoreFolders,
    dryRun,
    setDryRun,
    minVideoLengthSec,
    setMinVideoLengthSec,
    photoExtensions,
    setPhotoExtensions,
    videoExtensions,
    setVideoExtensions,
    deleteEmptyFolders,
    setDeleteEmptyFolders,
    moveVideos,
    setMoveVideos,
    validationErrors,
    setValidationErrors,
    scanResults,
    setScanResults,
    collapsedSections,
    setCollapsedSections,
  } = appState

  const debouncedStartFolder = useDebounce(startFolder, 500)
  const folderBrowser = useFolderBrowser()
  
  useSocket(appState as any, folderBrowser)
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  // Folder validation
  useEffect(() => {
    if (debouncedStartFolder) {
      validatePath(debouncedStartFolder)
    }
  }, [debouncedStartFolder])

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }, [setCollapsedSections])

  return (
    <div className="space-y-6">
      {/* Header with status */}
      <div className="glass-container p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-bold text-white">File Scanner & Cleanup</h2>
          <StatusBadge status={connectionStatus} />
        </div>
        <p className="text-white/70">Automate your file organization and cleanup tasks</p>
      </div>

      {/* Progress */}
      <ProgressBar progress={progress} stage={stage} />

      {/* Path Configuration */}
      <div className="glass-container p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Path Configuration</h3>
        <p className="text-white/70 mb-6">Set up source and target directories</p>
        <PathSettings 
          appState={{
            startFolder,
            setStartFolder,
            videoMoveTarget,
            setVideoMoveTarget,
            ignoreFolders,
            setIgnoreFolders,
            validationErrors
          }}
          folderBrowser={folderBrowser}
        />
      </div>

      {/* Processing Settings */}
      <div className="glass-container p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Processing Settings</h3>
        <p className="text-white/70 mb-6">Configure file filtering and processing options</p>
        <ProcessingSettings 
          appState={{
            minVideoLengthSec,
            setMinVideoLengthSec,
            photoExtensions,
            setPhotoExtensions,
            videoExtensions,
            setVideoExtensions,
            deleteEmptyFolders,
            setDeleteEmptyFolders,
            moveVideos,
            setMoveVideos,
            dryRun,
            setDryRun
          }}
        />
      </div>

      {/* Operations */}
      <div className="glass-container p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Operations</h3>
        <p className="text-white/70 mb-6">Start scanning and processing operations</p>
        <OperationControls 
          appState={{
            socket,
            connectionStatus,
            stage,
            scanResults,
            startFolder,
            videoMoveTarget,
            ignoreFolders,
            minVideoLengthSec,
            photoExtensions,
            videoExtensions,
            deleteEmptyFolders,
            moveVideos,
            dryRun,
            validationErrors
          }}
          onScanOnly={() => console.log('Scan only')}
          onStartCleanup={() => console.log('Start cleanup')}
          onLoadScanResults={() => console.log('Load scan results')}
        />
      </div>

      {/* File List Modal */}
      {isModalOpen && (
        <FileListModal 
          appState={{ scanResults }}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
