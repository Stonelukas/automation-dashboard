import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React, { useCallback, useEffect, useRef } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import FileListModal from "./components/FileListModal";
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

// CollapsibleCard component
const CollapsibleCard = ({ title, children, isCollapsed, onToggle }) => {
  return (
    <Card className="transition-all duration-300">
      <CardHeader 
        className="cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {title}
          </CardTitle>
          <button
            className={`p-1 rounded-md hover:bg-secondary transition-all duration-200 ${
              isCollapsed ? 'rotate-180' : ''
            }`}
          >
            🔽
          </button>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="animate-fade-in">
          {children}
        </CardContent>
      )}
    </Card>
  );
};

export default function App() {
  // Custom hooks for state management
  const appState = useAppState();
  const folderBrowser = useFolderBrowser();
  const { socketActions } = useSocket(appState, folderBrowser);

  // Auto-update notification state (local to this component)
  const [showAutoUpdateNotification, setShowAutoUpdateNotification] = React.useState(false);
  const autoUpdateTimeoutRef = useRef(null);

  // Collapsible panels state
  const [collapsedPanels, setCollapsedPanels] = React.useState({
    pathSettings: false,
    processingSettings: false,
    operationControls: false,
    progress: false
  });

  // Layout state
  const [layoutMode, setLayoutMode] = React.useState('grid'); // 'grid', 'tabs', 'sidebar'
  const [activeTab, setActiveTab] = React.useState('settings');

  // Update appState with auto-update notification setter
  React.useEffect(() => {
    appState.setShowAutoUpdateNotification = setShowAutoUpdateNotification;
  }, [appState]);

  // Toggle panel collapse
  const togglePanel = (panelName) => {
    setCollapsedPanels(prev => ({
      ...prev,
      [panelName]: !prev[panelName]
    }));
  };

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

  // Delete scan result handler
  const handleDeleteScanResult = (filePath) => {
    if (window.confirm('Are you sure you want to delete this scan result?')) {
      socketActions.deleteScanResult(filePath);
    }
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
      <div className="dashboard-container min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gradient mb-2">
              🚀 Automation Dashboard
            </h1>
            <p className="text-muted-foreground text-lg">
              Modern File Management & Organization System
            </p>
          </div>
          
          {/* Layout Controls */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant={appState.connectionStatus === 'connected' ? 'default' : 'destructive'}>
                    {getConnectionStatusText()}
                  </Badge>
                  {appState.stage !== 'idle' && (
                    <Badge variant="outline">
                      {getStatusMessage(appState.stage, appState.progress)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Layout:</span>
                  <div className="flex rounded-lg bg-secondary p-1">
                    <button
                      onClick={() => setLayoutMode('grid')}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        layoutMode === 'grid' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-secondary/80'
                      }`}
                    >
                      📊 Grid
                    </button>
                    <button
                      onClick={() => setLayoutMode('tabs')}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        layoutMode === 'tabs' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-secondary/80'
                      }`}
                    >
                      📑 Tabs
                    </button>
                    <button
                      onClick={() => setLayoutMode('sidebar')}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        layoutMode === 'sidebar' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-secondary/80'
                      }`}
                    >
                      📋 Sidebar
                    </button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auto-update notification */}
          {showAutoUpdateNotification && (
            <Card className="fixed top-5 right-5 z-50 border-l-4 border-green-400">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-sm font-medium">Video move target updated automatically</span>
                </div>
              </CardContent>
            </Card>
          )}

        {/* Dynamic Layout */}
        {layoutMode === 'grid' && (
          <div className="dashboard">
            {/* Left Column */}
            <div className="space-y-6">
              <CollapsibleCard
                title="📁 Path Settings"
                isCollapsed={collapsedPanels.pathSettings}
                onToggle={() => togglePanel('pathSettings')}
              >
                <PathSettings 
                  appState={appState}
                  folderBrowser={folderBrowser}
                  socketActions={socketActions}
                  validationErrors={appState.validationErrors}
                />
              </CollapsibleCard>
              
              <CollapsibleCard
                title="⚙️ Processing Settings"
                isCollapsed={collapsedPanels.processingSettings}
                onToggle={() => togglePanel('processingSettings')}
              >
                <ProcessingSettings appState={appState} />
              </CollapsibleCard>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <CollapsibleCard
                title="⚡ Operation Controls"
                isCollapsed={collapsedPanels.operationControls}
                onToggle={() => togglePanel('operationControls')}
              >
                <OperationControls
                  appState={appState}
                  socketActions={socketActions}
                  validationErrors={appState.validationErrors}
                  onScanOnly={onScanOnly}
                  onStartCleanup={onStartCleanup}
                  onLoadScanResults={onLoadScanResults}
                />
              </CollapsibleCard>

              {/* Progress Section */}
              {appState.stage !== 'idle' && (
                <CollapsibleCard
                  title="📈 Progress"
                  isCollapsed={collapsedPanels.progress}
                  onToggle={() => togglePanel('progress')}
                >
                  <ProgressBar 
                    progress={appState.progress} 
                    stage={appState.stage}
                    onFileListAction={handleFileListAction}
                  />
                  
                  {appState.stage === 'waiting' && (
                    <div className="mt-4 flex gap-3 justify-center">
                      <button
                        onClick={handleConfirm}
                        className="px-5 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                      >
                        {appState.dryRun ? 'Confirm Preview' : 'Confirm & Execute'}
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-5 py-2 bg-secondary text-secondary-foreground rounded-md font-medium hover:bg-secondary/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </CollapsibleCard>
              )}
            </div>
          </div>
        )}

        {layoutMode === 'tabs' && (
          <div className="tabs-layout">
            {/* Tab Navigation */}
            <div className="flex border-b border-border mb-6">
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'settings'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                🛠️ Settings
              </button>
              <button
                onClick={() => setActiveTab('operations')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'operations'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                ⚡ Operations
              </button>
              {appState.stage !== 'idle' && (
                <button
                  onClick={() => setActiveTab('progress')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'progress'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  📈 Progress
                </button>
              )}
            </div>

            {/* Tab Content */}
            <div className="tab-content">
              {activeTab === 'settings' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        📁 Path Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PathSettings 
                        appState={appState}
                        folderBrowser={folderBrowser}
                        socketActions={socketActions}
                        validationErrors={appState.validationErrors}
                      />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        ⚙️ Processing Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ProcessingSettings appState={appState} />
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'operations' && (
                <div className="max-w-4xl mx-auto">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        ⚡ Operation Controls
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <OperationControls
                        appState={appState}
                        socketActions={socketActions}
                        validationErrors={appState.validationErrors}
                        onScanOnly={onScanOnly}
                        onStartCleanup={onStartCleanup}
                        onLoadScanResults={onLoadScanResults}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'progress' && appState.stage !== 'idle' && (
                <div className="max-w-4xl mx-auto">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        📈 Progress
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ProgressBar 
                        progress={appState.progress} 
                        stage={appState.stage}
                        onFileListAction={handleFileListAction}
                      />
                      
                      {appState.stage === 'waiting' && (
                        <div className="mt-4 flex gap-3 justify-center">
                          <button
                            onClick={handleConfirm}
                            className="px-5 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                          >
                            {appState.dryRun ? 'Confirm Preview' : 'Confirm & Execute'}
                          </button>
                          <button
                            onClick={handleCancel}
                            className="px-5 py-2 bg-secondary text-secondary-foreground rounded-md font-medium hover:bg-secondary/80 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}

        {layoutMode === 'sidebar' && (
          <div className="sidebar-layout flex gap-6">
            {/* Sidebar */}
            <div className="w-80 flex-shrink-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">🛠️ Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer text-sm font-medium hover:text-primary">
                      📁 Path Settings
                      <span className="group-open:rotate-90 transition-transform">▶</span>
                    </summary>
                    <div className="mt-3 pl-4 border-l-2 border-border">
                      <PathSettings 
                        appState={appState}
                        folderBrowser={folderBrowser}
                        socketActions={socketActions}
                        validationErrors={appState.validationErrors}
                      />
                    </div>
                  </details>
                  
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer text-sm font-medium hover:text-primary">
                      ⚙️ Processing Settings
                      <span className="group-open:rotate-90 transition-transform">▶</span>
                    </summary>
                    <div className="mt-3 pl-4 border-l-2 border-border">
                      <ProcessingSettings appState={appState} />
                    </div>
                  </details>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="flex-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    ⚡ Operation Controls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <OperationControls
                    appState={appState}
                    socketActions={socketActions}
                    validationErrors={appState.validationErrors}
                    onScanOnly={onScanOnly}
                    onStartCleanup={onStartCleanup}
                    onLoadScanResults={onLoadScanResults}
                  />
                </CardContent>
              </Card>

              {appState.stage !== 'idle' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      📈 Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProgressBar 
                      progress={appState.progress} 
                      stage={appState.stage}
                      onFileListAction={handleFileListAction}
                    />
                    
                    {appState.stage === 'waiting' && (
                      <div className="mt-4 flex gap-3 justify-center">
                        <button
                          onClick={handleConfirm}
                          className="px-5 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                        >
                          {appState.dryRun ? 'Confirm Preview' : 'Confirm & Execute'}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-5 py-2 bg-secondary text-secondary-foreground rounded-md font-medium hover:bg-secondary/80 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
        
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[80vh] mx-4">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Manage Scan Results</CardTitle>
                  <button
                    onClick={() => appState.setShowScanResultsModal(false)}
                    className="text-2xl hover:text-muted-foreground transition-colors"
                  >
                    ×
                  </button>
                </div>
              </CardHeader>
              <CardContent className="overflow-y-auto">
                <div>
                  {appState.scanResults.map((result, index) => (
                    <div key={index} className="border rounded-lg p-4 mb-3 flex justify-between items-center">
                      <div className="flex-1">
                        <div className="font-semibold mb-2">
                          {new Date(result.timestamp).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground mb-1">
                          Folder: {result.startFolder}
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          Target: {result.videoMoveTarget || 'N/A'}
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="text-red-500">
                            📷 Photos: {result.summary?.totalPhotos || 0}
                          </span>
                          <span className="text-red-500">
                            🎬 Short Videos: {result.summary?.totalShortVideos || 0}
                          </span>
                          <span className="text-blue-500">
                            🎥 Long Videos: {result.summary?.totalLongVideos || 0}
                          </span>
                          <span className="text-orange-500">
                            📁 Empty Folders: {result.summary?.totalEmptyFolders || 0}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          File: {result.filePath}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteScanResult(result.filePath)}
                        disabled={appState.deletingScans.has(result.filePath)}
                        className="ml-4 px-3 py-1 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50"
                      >
                        {appState.deletingScans.has(result.filePath) ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        </div>
      </div>
    </ErrorBoundary>
  );
}
