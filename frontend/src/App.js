import React, { useCallback, useEffect, useRef } from "react";
import "./App.css";
import ErrorBoundary from "./components/ErrorBoundary";
import FileListModal from "./components/FileListModal";
import FormSection from "./components/FormSection";
import LogViewer from "./components/LogViewer";
import OperationControls from "./components/OperationControls";
import PathSettings from "./components/PathSettings";
import ProcessingSettings from "./components/ProcessingSettings";
import ProgressBar from "./components/ProgressBar";
import { useAppState } from "./hooks/useAppState";
import { useFolderBrowser } from "./hooks/useFolderBrowser";
import { useSocket } from "./hooks/useSocket";
import { useDebounce } from "./hooks/useUtilities";
import {
  getStatusMessage,
  handleLoadScanResults,
  handleScanOnly,
  handleStartCleanup
} from "./utils/businessLogic";
import { validatePath } from "./utils/validation";

export default function App() {
  // Custom hooks for state management
  const appState = useAppState();
  const folderBrowser = useFolderBrowser();
  const { socketActions } = useSocket(appState, folderBrowser);

  // Auto-update notification state (local to this component)
  const [showAutoUpdateNotification, setShowAutoUpdateNotification] = React.useState(false);
  const autoUpdateTimeoutRef = useRef(null);

  // Update appState with auto-update notification setter
  React.useEffect(() => {
    appState.setShowAutoUpdateNotification = setShowAutoUpdateNotification;
  }, [appState]);

  // Debounced validation
  const debouncedValidation = useDebounce(useCallback(() => {
    const errors = {};
    
    if (!validatePath(appState.startFolder)) {
      errors.startFolder = "Invalid start folder path";
    }
    
    if (!validatePath(appState.videoMoveTarget)) {
      errors.videoMoveTarget = "Invalid video move target path";
    }
    
    appState.setValidationErrors(errors);
  }, [appState]), 500);

  // Validate inputs on change
  useEffect(() => {
    debouncedValidation();
  }, [appState.startFolder, appState.videoMoveTarget, debouncedValidation]);

  // Auto-update video move target when start folder changes
  useEffect(() => {
    // Clear any existing timeout
    if (autoUpdateTimeoutRef.current) {
      clearTimeout(autoUpdateTimeoutRef.current);
    }

    if (appState.startFolder && appState.startFolder.trim() !== '' && appState.startFolder !== '.') {
      // Create a sensible default for video move target
      let newVideoTarget;
      
      // Determine the appropriate path separator based on the start folder format
      const separator = appState.startFolder.includes('\\') ? '\\' : '/';
      
      // Ensure proper path joining
      if (appState.startFolder.endsWith(separator)) {
        newVideoTarget = appState.startFolder + 'SortedVideos';
      } else {
        newVideoTarget = appState.startFolder + separator + 'SortedVideos';
      }
      
      // Only update if it's actually different to avoid unnecessary updates
      if (newVideoTarget !== appState.videoMoveTarget) {
        appState.setVideoMoveTarget(newVideoTarget);
        setShowAutoUpdateNotification(true);
        
        // Hide notification after 3 seconds
        autoUpdateTimeoutRef.current = setTimeout(() => {
          setShowAutoUpdateNotification(false);
        }, 3000);
      }
    } else if (appState.startFolder === '.' || appState.startFolder === '') {
      // Reset to relative path for current directory
      const defaultTarget = './SortedVideos';
      if (defaultTarget !== appState.videoMoveTarget) {
        appState.setVideoMoveTarget(defaultTarget);
        setShowAutoUpdateNotification(true);
        
        // Hide notification after 3 seconds
        autoUpdateTimeoutRef.current = setTimeout(() => {
          setShowAutoUpdateNotification(false);
        }, 3000);
      }
    }

    // Cleanup function to clear timeout on unmount
    return () => {
      if (autoUpdateTimeoutRef.current) {
        clearTimeout(autoUpdateTimeoutRef.current);
      }
    };
  }, [appState]);

  // Operation handlers
  const onScanOnly = () => handleScanOnly(appState, socketActions);
  const onStartCleanup = () => handleStartCleanup(appState, socketActions);
  const onLoadScanResults = () => handleLoadScanResults(appState, socketActions);

  // UI event handlers
  const handleConfirm = () => {
    socketActions.confirm();
  };

  const handleCancel = () => {
    socketActions.cancel();
  };

  const handleAbort = () => {
    socketActions.abortOperation();
  };

  const handleFileListAction = (action, fileType) => {
    const fileList = appState.fileLists[fileType] || [];
    let title = '';
    let actionType = 'delete';
    let moveTarget = null;

    switch (fileType) {
      case 'photoFiles':
        title = 'Photos to Delete';
        actionType = 'delete';
        break;
      case 'shortVideos':
        title = 'Short Videos to Delete';
        actionType = 'delete';
        break;
      case 'longVideos':
        title = 'Long Videos to Move';
        actionType = 'move';
        moveTarget = appState.videoMoveTarget;
        break;
      case 'emptyFolders':
        title = 'Empty Folders to Remove';
        actionType = 'remove';
        break;
      default:
        title = 'Files';
    }

    appState.setFileListModalData({
      title,
      files: fileList,
      action: actionType,
      moveTarget: moveTarget,
      stage: appState.stage
    });
    appState.setShowFileListModal(true);
  };

  // Connection status indicator
  const getConnectionStatusText = () => {
    switch (appState.connectionStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      default: return 'Unknown';
    }
  };

  return (
    <ErrorBoundary>
      <div className="app">
        <div className="app-header">
          <h1 className="app-title">
            🚀 Automation Dashboard
          </h1>
          <p className="app-subtitle">
            Modern File Management & Organization System
          </p>
        </div>
        
        {/* Status Bar */}
        <div className="section-card mb-6">
          <div className="flex-between">
            <div className="flex items-center gap-4">
              <div className={`status-indicator status-${appState.connectionStatus}`}>
                <div className="w-2 h-2 bg-current rounded-full"></div>
                {getConnectionStatusText()}
              </div>
              {appState.stage !== 'idle' && (
                <div className={`status-indicator status-${appState.stage}`}>
                  <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                  {getStatusMessage(appState.stage, appState.progress)}
                </div>
              )}
            </div>
            <div className="text-sm text-secondary">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Auto-update notification */}
        {showAutoUpdateNotification && (
          <div className="fixed top-5 right-5 z-50 animate-slide-in-right">
            <div className="glass-card p-4 border-l-4 border-green-400">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-sm font-medium">Video move target updated automatically</span>
              </div>
            </div>
          </div>
        )}

        <div className="dashboard">
          {/* Left Column */}
          <div className="space-y-6">
            <PathSettings 
              appState={appState}
              folderBrowser={folderBrowser}
              socketActions={socketActions}
              validationErrors={appState.validationErrors}
            />
            
            <ProcessingSettings appState={appState} />
          </div>

          {/* Right Column */}
          <div>
            <OperationControls
              appState={appState}
              socketActions={socketActions}
              validationErrors={appState.validationErrors}
              onScanOnly={onScanOnly}
              onStartCleanup={onStartCleanup}
              onLoadScanResults={onLoadScanResults}
            />

            {/* Progress Section */}
            {appState.stage !== 'idle' && (
              <FormSection title="Progress">
                <ProgressBar 
                  progress={appState.progress} 
                  stage={appState.stage}
                  onFileListAction={handleFileListAction}
                />
                
                {appState.stage === 'waiting' && (
                  <div style={{ 
                    marginTop: '15px', 
                    display: 'flex', 
                    gap: '10px', 
                    justifyContent: 'center' 
                  }}>
                    <button
                      onClick={handleConfirm}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: appState.dryRun ? '#2196F3' : '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      {appState.dryRun ? 'Confirm Preview' : 'Confirm & Execute'}
                    </button>
                    <button
                      onClick={handleCancel}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {['scanning', 'running'].includes(appState.stage) && (
                  <div style={{ 
                    marginTop: '15px', 
                    textAlign: 'center' 
                  }}>
                    <button
                      onClick={handleAbort}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Abort Operation
                    </button>
                  </div>
                )}
              </FormSection>
            )}

            {/* Logs Section */}
            {appState.logs.length > 0 && (
              <FormSection title="Operation Logs">
                <LogViewer logs={appState.logs} />
              </FormSection>
            )}

            {/* Errors Section */}
            {appState.errors.length > 0 && (
              <FormSection 
                title="Errors" 
                style={{ backgroundColor: '#ffebee', border: '1px solid #f44336' }}
              >
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {appState.errors.map((error, index) => (
                    <div key={index} style={{ 
                      color: '#d32f2f', 
                      marginBottom: '5px',
                      padding: '5px',
                      backgroundColor: '#fff',
                      borderRadius: '3px'
                    }}>
                      {error}
                    </div>
                  ))}
                </div>
              </FormSection>
            )}
          </div>
        </div>

        {/* File List Modal */}
        {appState.showFileListModal && (
          <FileListModal
            files={appState.fileList}
            onClose={() => appState.setShowFileListModal(false)}
            onExcludeFile={(filePath) => {
              socketActions.excludeFile(filePath);
            }}
            onOpenFile={(filePath) => {
              socketActions.openFile(filePath);
            }}
            isConnected={appState.connectionStatus === 'connected'}
          />
        )}

        {/* Scan Results Modal */}
        {appState.showScanResultsModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '800px',
              width: '90%',
              maxHeight: '80%',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>Manage Scan Results</h3>
                <button
                  onClick={() => appState.setShowScanResultsModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    padding: '5px'
                  }}
                >
                  ×
                </button>
              </div>
              
              <div>
                {appState.scanResults.map((result, index) => (
                  <div key={index} style={{
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '15px',
                    marginBottom: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                        {new Date(result.timestamp).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '3px' }}>
                        Folder: {result.startFolder}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                        Target: {result.videoMoveTarget || 'N/A'}
                      </div>
                      <div style={{ display: 'flex', gap: '15px', fontSize: '12px' }}>
                        <span style={{ color: '#d32f2f' }}>
                          📷 Photos: {result.summary?.totalPhotos || 0}
                        </span>
                        <span style={{ color: '#d32f2f' }}>
                          🎬 Short Videos: {result.summary?.totalShortVideos || 0}
                        </span>
                        <span style={{ color: '#1976d2' }}>
                          🎥 Long Videos: {result.summary?.totalLongVideos || 0}
                        </span>
                        <span style={{ color: '#f57c00' }}>
                          📁 Empty Folders: {result.summary?.totalEmptyFolders || 0}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
                        Total items: {result.totalFiles || 0} | File: {result.fileName}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => {
                          appState.setSelectedScanResult(result.filePath);
                          appState.setShowScanResultsModal(false);
                        }}
                        style={{
                          padding: '5px 10px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Select
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this scan result?')) {
                            socketActions.deleteScanResult(result.filePath);
                          }
                        }}
                        disabled={appState.deletingScans.has(result.filePath)}
                        style={{
                          padding: '5px 10px',
                          backgroundColor: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: appState.deletingScans.has(result.filePath) ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          opacity: appState.deletingScans.has(result.filePath) ? 0.5 : 1
                        }}
                      >
                        {appState.deletingScans.has(result.filePath) ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
                
                {appState.scanResults.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                    No scan results available
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Folder Browser Modal */}
        {folderBrowser.showFolderBrowser && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '80%',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>Browse Folders</h3>
                <button
                  onClick={() => folderBrowser.setShowFolderBrowser(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    padding: '5px'
                  }}
                >
                  ×
                </button>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                  <button
                    onClick={() => {
                      const parent = folderBrowser.getParentDirectory(folderBrowser.folderContents.currentPath);
                      if (parent) {
                        socketActions.browseFolders(parent);
                      }
                    }}
                    disabled={!folderBrowser.getParentDirectory(folderBrowser.folderContents.currentPath)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    ← Up
                  </button>
                  <input
                    type="text"
                    value={folderBrowser.folderContents.currentPath}
                    onChange={(e) => {
                      if (e.key === 'Enter') {
                        socketActions.browseFolders(e.target.value);
                      }
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        socketActions.browseFolders(e.target.value);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '5px',
                      border: '1px solid #ccc',
                      borderRadius: '3px'
                    }}
                  />
                  <button
                    onClick={() => socketActions.browseFolders(folderBrowser.folderContents.currentPath)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    Go
                  </button>
                </div>
              </div>
              
              <div style={{ border: '1px solid #ddd', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                {folderBrowser.folderContents.folders.map((folder, index) => (
                  <div
                    key={index}
                    onClick={() => socketActions.browseFolders(folder.path)}
                    style={{
                      padding: '8px',
                      borderBottom: '1px solid #eee',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ marginRight: '8px' }}>📁</span>
                    {folder.name}
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    appState.setStartFolder(folderBrowser.folderContents.currentPath);
                    folderBrowser.setShowFolderBrowser(false);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Select This Folder
                </button>
                <button
                  onClick={() => folderBrowser.setShowFolderBrowser(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add CSS animations */}
        <style>{`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </ErrorBoundary>
  );
}
