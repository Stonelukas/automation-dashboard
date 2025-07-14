import { Progress } from '@/hooks/useAppState'

/**
 * Gets a human-readable status message based on current stage and progress
 */
export function getStatusMessage(stage: string, detailedStage: string, progress: Progress): string {
  switch (stage) {
    case 'idle':
      return 'Ready to start file cleanup operation'
    case 'scanning':
      return `Scanning files... ${progress.ProcessedVideos}/${progress.TotalVideos} videos analyzed`
    case 'waiting':
      return 'Scan complete. Review results and confirm to proceed.'
    case 'running':
      if (detailedStage) {
        return `Processing: ${detailedStage}`
      }
      return 'Running cleanup operations...'
    case 'done':
      return 'Cleanup operation completed successfully'
    case 'aborted':
      return 'Operation was cancelled'
    case 'error':
      return 'An error occurred during the operation'
    default:
      return `Status: ${stage}`
  }
}

/**
 * Handles the scan-only operation
 */
export function handleScanOnly(appState: any) {
  if (!appState.socket) {
    console.error('No socket connection')
    return
  }

  // Reset previous results and errors
  appState.setErrors([])
  appState.setScanResults(null)
  appState.setLogs([])

  // Emit scan request
  appState.socket.emit('startCleanup', {
    startFolder: appState.startFolder,
    videoMoveTarget: appState.videoMoveTarget,
    ignoreFolders: appState.ignoreFolders,
    minVideoLengthSec: appState.minVideoLengthSec,
    photoExtensions: appState.photoExtensions,
    videoExtensions: appState.videoExtensions,
    deleteEmptyFolders: appState.deleteEmptyFolders,
    moveVideos: appState.moveVideos,
    dryRun: true, // Force dry run for scan-only
    scanOnly: true
  })
}

/**
 * Handles the full cleanup operation
 */
export function handleStartCleanup(appState: any) {
  if (!appState.socket) {
    console.error('No socket connection')
    return
  }

  // Reset previous errors
  appState.setErrors([])
  appState.setLogs([])

  // Emit cleanup request
  appState.socket.emit('startCleanup', {
    startFolder: appState.startFolder,
    videoMoveTarget: appState.videoMoveTarget,
    ignoreFolders: appState.ignoreFolders,
    minVideoLengthSec: appState.minVideoLengthSec,
    photoExtensions: appState.photoExtensions,
    videoExtensions: appState.videoExtensions,
    deleteEmptyFolders: appState.deleteEmptyFolders,
    moveVideos: appState.moveVideos,
    dryRun: appState.dryRun,
    scanOnly: false,
    excludedFiles: appState.excludedFiles
  })
}

/**
 * Handles loading saved scan results
 */
export function handleLoadScanResults(appState: any) {
  if (!appState.socket) {
    console.error('No socket connection')
    return
  }

  // Request saved scan results from server
  appState.socket.emit('loadScanResults')
}

/**
 * Formats file size in bytes to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Formats duration in seconds to human readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`
  }
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`
}

/**
 * Gets the file extension from a file path
 */
export function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.')
  if (lastDot === -1) return ''
  return filePath.substring(lastDot + 1).toLowerCase()
}

/**
 * Determines if a file is an image based on its extension
 */
export function isImageFile(filePath: string, photoExtensions: string): boolean {
  const ext = getFileExtension(filePath)
  const validExtensions = photoExtensions.toLowerCase().split(',').map(e => e.trim())
  return validExtensions.includes(ext)
}

/**
 * Determines if a file is a video based on its extension
 */
export function isVideoFile(filePath: string, videoExtensions: string): boolean {
  const ext = getFileExtension(filePath)
  const validExtensions = videoExtensions.toLowerCase().split(',').map(e => e.trim())
  return validExtensions.includes(ext)
}

/**
 * Calculates progress percentage
 */
export function calculateProgress(current: number, total: number): number {
  if (total === 0) return 0
  return Math.round((current / total) * 100)
}
