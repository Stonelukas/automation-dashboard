import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import React from 'react'
import { DryRunBadge } from './DryRunBadge'

interface OperationControlsProps {
  appState: any
  onScanOnly: () => void
  onStartCleanup: () => void
  onLoadScanResults: () => void
}

export function OperationControls({ 
  appState, 
  onScanOnly, 
  onStartCleanup, 
  onLoadScanResults 
}: OperationControlsProps) {
  const isIdle = appState.stage === 'idle'
  const isScanning = appState.stage === 'scanning'
  const isWaiting = appState.stage === 'waiting'
  const isRunning = appState.stage === 'running'
  const hasValidPaths = appState.startFolder && appState.videoMoveTarget
  const hasErrors = Object.keys(appState.validationErrors).length > 0

  const canScan = isIdle && hasValidPaths && !hasErrors
  const canExecute = isWaiting && appState.scanResults
  const canAbort = isScanning || isRunning

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="flex items-center gap-2 mb-4">
        <DryRunBadge dryRun={appState.dryRun} />
        {appState.stage !== 'idle' && (
          <Badge variant="outline">
            {appState.stage}
          </Badge>
        )}
      </div>

      {/* Main Action Buttons */}
      <div className="grid grid-cols-1 gap-3">
        {/* Scan Only Button */}
        <Button
          onClick={onScanOnly}
          disabled={!canScan}
          variant="outline"
          size="lg"
          className="w-full"
        >
          {isScanning ? (
            <>⏳ Scanning...</>
          ) : (
            <>🔍 Scan Only (Preview)</>
          )}
        </Button>

        {/* Execute Button */}
        <Button
          onClick={onStartCleanup}
          disabled={!canExecute}
          variant={appState.dryRun ? "secondary" : "default"}
          size="lg"
          className="w-full"
        >
          {isRunning ? (
            <>⚡ Processing...</>
          ) : (
            <>
              {appState.dryRun ? '🧪 Test Cleanup' : '⚡ Execute Cleanup'}
            </>
          )}
        </Button>

        {/* Abort Button */}
        {canAbort && (
          <Button
            onClick={() => appState.socket?.emit('cancel')}
            variant="destructive"
            size="lg"
            className="w-full"
          >
            ⏹️ Cancel Operation
          </Button>
        )}
      </div>

      {/* Load Previous Results */}
      <div className="border-t pt-4">
        <Button
          onClick={onLoadScanResults}
          variant="ghost"
          size="sm"
          className="w-full"
          disabled={!isIdle}
        >
          📋 Load Previous Scan Results
        </Button>
      </div>

      {/* Validation Errors */}
      {hasErrors && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <h4 className="text-sm font-medium text-destructive mb-2">
            Please fix these issues:
          </h4>
          <ul className="text-sm space-y-1">
            {Object.entries(appState.validationErrors).map(([field, error]) => (
              <li key={field} className="text-destructive">
                • {String(error)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Help Text */}
      {isIdle && (
        <div className="text-xs text-muted-foreground space-y-2">
          <div>
            <strong>Scan Only:</strong> Preview what would be changed without making any modifications.
          </div>
          <div>
            <strong>Execute:</strong> Apply the changes after reviewing scan results.
          </div>
          {!appState.dryRun && (
            <div className="text-orange-600">
              ⚠️ <strong>Live Mode:</strong> Files will be permanently moved/deleted.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
