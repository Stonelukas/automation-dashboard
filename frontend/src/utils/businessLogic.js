/**
 * Business logic utilities for the automation dashboard
 * Extracts complex logic from components for better maintainability
 */

/**
 * Build operation parameters from current state
 */
export const buildOperationParams = (appState) => {
  const {
    startFolder,
    videoMoveTarget,
    minVideoLengthSec,
    photoExtensions,
    videoExtensions,
    deleteEmptyFolders,
    moveVideos,
    ignoreFolders,
    dryRun
  } = appState;

  return {
    StartFolder: startFolder,
    VideoMoveTarget: videoMoveTarget,
    MinVideoLengthSec: minVideoLengthSec,
    PhotoExtensions: photoExtensions,
    VideoExtensions: videoExtensions,
    DeleteEmptyFolders: deleteEmptyFolders,
    MoveVideos: moveVideos,
    IgnoreFolders: ignoreFolders.split(',').map(f => f.trim()).filter(f => f),
    DryRun: dryRun
  };
};

/**
 * Handle scan only operation
 */
export const handleScanOnly = (appState, socketActions) => {
  const params = buildOperationParams(appState);
  console.log('Starting scan only with params:', params);
  
  // Clear previous progress and logs
  appState.setLogs([]);
  appState.setProgress({
    TotalVideos: 0,
    ProcessedVideos: 0,
    PhotosToDelete: 0,
    VideosToDelete: 0,
    FoldersToDelete: 0,
    VideosToMove: 0,
  });
  appState.setErrors([]);
  
  socketActions.startScanOnly(params);
};

/**
 * Handle cleanup operation
 */
export const handleStartCleanup = (appState, socketActions) => {
  const params = buildOperationParams(appState);
  console.log('Starting cleanup with params:', params);
  
  // Clear previous progress and logs
  appState.setLogs([]);
  appState.setProgress({
    TotalVideos: 0,
    ProcessedVideos: 0,
    PhotosToDelete: 0,
    VideosToDelete: 0,
    FoldersToDelete: 0,
    VideosToMove: 0,
  });
  appState.setErrors([]);
  
  socketActions.startCleanup(params);
};

/**
 * Handle load scan results operation
 */
export const handleLoadScanResults = (appState, socketActions) => {
  if (!appState.selectedScanResult) {
    appState.setErrors(prev => [...prev, 'Please select a scan result to load']);
    return;
  }
  
  const params = {
    scanResultsPath: appState.selectedScanResult,
    DryRun: appState.dryRun
  };
  
  console.log('Loading scan results with params:', params);
  
  // Clear previous progress and logs
  appState.setLogs([]);
  appState.setProgress({
    TotalVideos: 0,
    ProcessedVideos: 0,
    PhotosToDelete: 0,
    VideosToDelete: 0,
    FoldersToDelete: 0,
    VideosToMove: 0,
  });
  appState.setErrors([]);
  
  socketActions.loadScanResults(params);
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format date for display
 */
export const formatDate = (dateString) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch (error) {
    return 'Invalid Date';
  }
};

/**
 * Get operation status message
 */
export const getStatusMessage = (stage, progress) => {
  switch (stage) {
    case 'idle':
      return 'Ready to start operation';
    case 'scanning':
      return 'Scanning files and folders...';
    case 'waiting':
      return 'Scan complete. Review results and confirm to proceed.';
    case 'running':
      if (progress.ProcessedVideos && progress.TotalVideos) {
        return `Processing... ${progress.ProcessedVideos}/${progress.TotalVideos} videos`;
      }
      return 'Processing files...';
    case 'done':
      return 'Operation completed successfully';
    case 'aborted':
      return 'Operation was cancelled or aborted';
    case 'error':
      return 'An error occurred during the operation';
    default:
      return stage;
  }
};

/**
 * Get progress percentage
 */
export const getProgressPercentage = (progress) => {
  if (!progress.TotalVideos || progress.TotalVideos === 0) {
    return 0;
  }
  return Math.round((progress.ProcessedVideos / progress.TotalVideos) * 100);
};

/**
 * Validate operation parameters
 */
export const validateOperationParams = (appState) => {
  const errors = {};
  
  if (!appState.startFolder || appState.startFolder.trim() === '') {
    errors.startFolder = 'Start folder is required';
  }
  
  if (!appState.videoMoveTarget || appState.videoMoveTarget.trim() === '') {
    errors.videoMoveTarget = 'Video move target is required';
  }
  
  if (appState.minVideoLengthSec < 1) {
    errors.minVideoLengthSec = 'Minimum video length must be at least 1 second';
  }
  
  return errors;
};

/**
 * Calculate total files from progress
 */
export const getTotalFiles = (progress) => {
  return (progress.PhotosToDelete || 0) + 
         (progress.VideosToDelete || 0) + 
         (progress.FoldersToDelete || 0) + 
         (progress.VideosToMove || 0);
};

/**
 * Get file action description
 */
export const getFileActionDescription = (action, count, moveTarget = null) => {
  switch (action) {
    case 'delete':
      return `${count} file(s) will be deleted`;
    case 'move':
      return `${count} file(s) will be moved to ${moveTarget}`;
    case 'remove':
      return `${count} folder(s) will be removed`;
    default:
      return `${count} file(s) will be processed`;
  }
};
