import React from 'react';
import StatusBadge from './StatusBadge';

const OperationControls = ({ 
  appState, 
  socketActions, 
  validationErrors,
  onScanOnly,
  onStartCleanup,
  onLoadScanResults 
}) => {
  const {
    connectionStatus,
    stage,
    dryRun,
    scanResults,
    selectedScanResult,
    setSelectedScanResult,
    setShowScanResultsModal,
    deletingScans,
    logFiles,
    selectedLogFile,
    setSelectedLogFile
  } = appState;

  const isRunning = ['scanning', 'waiting', 'running'].includes(stage);
  const canOperate = connectionStatus === 'connected' && !isRunning;
  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  const handleDeleteScanResult = (scanResultPath) => {
    if (window.confirm('Are you sure you want to delete this scan result?')) {
      socketActions.deleteScanResult(scanResultPath);
    }
  };

  const handleRevert = () => {
    if (!selectedLogFile) {
      alert('Please select a log file to revert');
      return;
    }
    
    if (window.confirm('Are you sure you want to revert this operation? This will attempt to undo the file changes.')) {
      const revertParams = {
        RevertLogPath: selectedLogFile,
        DryRun: dryRun
      };
      socketActions.startCleanup(revertParams);
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="section-card animate-slide-in-right">
      <div className="section-header">
        <span className="section-icon">⚡</span>
        <h3 className="section-title">Operation Controls</h3>
      </div>

      <div className="flex-between mb-6">
        <StatusBadge stage={stage} connectionStatus={connectionStatus} />
      </div>

      {/* Load Scan Results Section */}
      <div className="form-section">
        <h4 className="form-section-title">Load Previous Scan</h4>
        <div className="form-row">
          <select
            value={selectedScanResult}
            onChange={(e) => setSelectedScanResult(e.target.value)}
            className="form-select"
            disabled={!canOperate}
          >
            <option value="">Select a previous scan...</option>
            {scanResults.map((result, index) => (
              <option key={index} value={result.filePath}>
                {formatDate(result.timestamp)} - {(result.summary?.totalPhotos || 0) + (result.summary?.totalShortVideos || 0) + (result.summary?.totalLongVideos || 0) + (result.summary?.totalEmptyFolders || 0)} files
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowScanResultsModal(true)}
            disabled={!canOperate}
            className="btn btn-secondary"
          >
            Manage
          </button>
          <button
            onClick={onLoadScanResults}
            disabled={!canOperate || !selectedScanResult}
            className="btn btn-warning"
          >
            {dryRun ? 'Preview Load' : 'Load & Execute'}
          </button>
        </div>
      </div>

      {/* Revert Operation Section */}
      <div className="form-section">
        <h4 className="form-section-title">Revert Previous Operation</h4>
        <div className="form-row">
          <select
            value={selectedLogFile}
            onChange={(e) => setSelectedLogFile(e.target.value)}
            className="form-select"
            disabled={!canOperate}
          >
            <option value="">Select an operation to revert...</option>
            {logFiles.map((logFile, index) => (
              <option key={index} value={logFile.path}>
                {formatDate(logFile.modified)} - {formatFileSize(logFile.size)}
              </option>
            ))}
          </select>
          <button
            onClick={handleRevert}
            disabled={!canOperate || !selectedLogFile}
            className="btn btn-danger"
          >
            {dryRun ? 'Preview Revert' : 'Revert Operation'}
          </button>
        </div>
      </div>

      {/* Main Operation Buttons */}
      <div className="form-section">
        <div className="form-row">
          <button
            onClick={onScanOnly}
            disabled={!canOperate || hasValidationErrors}
            className="btn btn-primary"
            title={hasValidationErrors ? 'Please fix validation errors first' : 'Scan only without making changes'}
          >
            Scan Only
          </button>

          <button
            onClick={onStartCleanup}
            disabled={!canOperate || hasValidationErrors}
            className={`btn ${dryRun ? 'btn-secondary' : 'btn-danger'}`}
            title={hasValidationErrors ? 'Please fix validation errors first' : (dryRun ? 'Preview cleanup without making changes' : 'Start cleanup process')}
          >
            {dryRun ? 'Preview Cleanup' : 'Start Cleanup'}
          </button>
        </div>
      </div>

      {/* Scan Results Management */}
      {scanResults.length > 0 && (
        <div className="form-section">
          <h4 className="form-section-title">Recent Scan Results</h4>
          <div className="recent-scans-container">
            {scanResults.slice(0, 5).map((result, index) => (
              <div key={index} className="scan-result-item">
                <div className="scan-result-info">
                  <div className="scan-result-date">
                    {formatDate(result.timestamp)}
                  </div>
                  <div className="scan-result-details">
                    {result.startFolder} - {(result.summary?.totalPhotos || 0) + (result.summary?.totalShortVideos || 0) + (result.summary?.totalLongVideos || 0) + (result.summary?.totalEmptyFolders || 0)} files
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteScanResult(result.filePath)}
                  disabled={deletingScans.has(result.filePath)}
                  className="btn btn-danger btn-sm"
                >
                  {deletingScans.has(result.filePath) ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasValidationErrors && (
        <div className="error-card">
          <strong>Please fix the following errors:</strong>
          <ul>
            {Object.entries(validationErrors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {isRunning && (
        <div className="status-card">
          <strong>
            {stage === 'scanning' && 'Scanning files...'}
            {stage === 'waiting' && 'Waiting for confirmation...'}
            {stage === 'running' && 'Processing files...'}
          </strong>
        </div>
      )}
    </div>
  );
};

export default OperationControls;
