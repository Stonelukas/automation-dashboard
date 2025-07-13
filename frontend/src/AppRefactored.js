import React, { useCallback, useEffect, useRef } from "react";
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
  const getConnectionStatusColor = () => {
    switch (appState.connectionStatus) {
      case 'connected': return '#4CAF50';
      case 'disconnected': return '#f44336';
      case 'error': return '#FF9800';
      default: return '#757575';
    }
  };

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
      <div style={{ 
        padding: '20px', 
        maxWidth: '1200px', 
        margin: '0 auto',
        fontFamily: 'Arial, sans-serif'
      }}>
        <h1 style={{ 
          textAlign: 'center', 
          color: '#333',
          marginBottom: '10px'
        }}>
          File Management Automation Dashboard
        </h1>
        
        {/* Connection Status */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px'
        }}>
          <span style={{ color: '#666' }}>Status: </span>
          <span style={{ 
            color: getConnectionStatusColor(),
            fontWeight: 'bold'
          }}>
            {getConnectionStatusText()}
          </span>
          {appState.stage !== 'idle' && (
            <span style={{ marginLeft: '20px', color: '#666' }}>
              Operation: <strong>{getStatusMessage(appState.stage, appState.progress)}</strong>
            </span>
          )}
        </div>

        {/* Auto-update notification */}
        {showAutoUpdateNotification && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            zIndex: 1000,
            animation: 'slideIn 0.3s ease-out'
          }}>
            Video move target updated automatically
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Left Column */}
          <div>
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
            isOpen={appState.showFileListModal}
            onClose={() => appState.setShowFileListModal(false)}
            title={appState.fileListModalData.title}
            files={appState.fileListModalData.files}
            action={appState.fileListModalData.action}
            moveTarget={appState.fileListModalData.moveTarget}
            stage={appState.fileListModalData.stage}
            excludedFiles={appState.excludedFiles}
            setExcludedFiles={appState.setExcludedFiles}
          />
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
