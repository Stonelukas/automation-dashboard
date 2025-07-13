import React from 'react';
import FormSection from './FormSection';
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
    <FormSection title="Operation Controls">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '15px' 
      }}>
        <StatusBadge stage={stage} connectionStatus={connectionStatus} />
      </div>

      {/* Load Scan Results Section */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>Load Previous Scan</h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedScanResult}
            onChange={(e) => setSelectedScanResult(e.target.value)}
            style={{ 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              minWidth: '200px',
              flex: 1 
            }}
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
            style={{
              padding: '8px 16px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: canOperate ? 'pointer' : 'not-allowed',
              opacity: canOperate ? 1 : 0.6
            }}
          >
            Manage
          </button>
          <button
            onClick={onLoadScanResults}
            disabled={!canOperate || !selectedScanResult}
            style={{
              padding: '8px 16px',
              backgroundColor: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: canOperate && selectedScanResult ? 'pointer' : 'not-allowed',
              opacity: canOperate && selectedScanResult ? 1 : 0.6
            }}
          >
            {dryRun ? 'Preview Load' : 'Load & Execute'}
          </button>
        </div>
      </div>

      {/* Revert Operation Section */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>Revert Previous Operation</h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedLogFile}
            onChange={(e) => setSelectedLogFile(e.target.value)}
            style={{ 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              minWidth: '200px',
              flex: 1 
            }}
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
            style={{
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: canOperate && selectedLogFile ? 'pointer' : 'not-allowed',
              opacity: canOperate && selectedLogFile ? 1 : 0.6
            }}
          >
            {dryRun ? 'Preview Revert' : 'Revert Operation'}
          </button>
        </div>
      </div>

      {/* Main Operation Buttons */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        <button
          onClick={onScanOnly}
          disabled={!canOperate || hasValidationErrors}
          style={{
            padding: '12px 24px',
            backgroundColor: hasValidationErrors ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: canOperate && !hasValidationErrors ? 'pointer' : 'not-allowed',
            fontSize: '16px',
            fontWeight: 'bold',
            opacity: canOperate && !hasValidationErrors ? 1 : 0.6,
            flex: '1',
            minWidth: '150px'
          }}
          title={hasValidationErrors ? 'Please fix validation errors first' : 'Scan only without making changes'}
        >
          Scan Only
        </button>

        <button
          onClick={onStartCleanup}
          disabled={!canOperate || hasValidationErrors}
          style={{
            padding: '12px 24px',
            backgroundColor: hasValidationErrors ? '#ccc' : (dryRun ? '#2196F3' : '#f44336'),
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: canOperate && !hasValidationErrors ? 'pointer' : 'not-allowed',
            fontSize: '16px',
            fontWeight: 'bold',
            opacity: canOperate && !hasValidationErrors ? 1 : 0.6,
            flex: '1',
            minWidth: '150px'
          }}
          title={hasValidationErrors ? 'Please fix validation errors first' : (dryRun ? 'Preview cleanup without making changes' : 'Start cleanup process')}
        >
          {dryRun ? 'Preview Cleanup' : 'Start Cleanup'}
        </button>
      </div>

      {/* Scan Results Management */}
      {scanResults.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>Recent Scan Results</h4>
          <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
            {scanResults.slice(0, 5).map((result, index) => (
              <div key={index} style={{ 
                padding: '8px', 
                borderBottom: index < 4 ? '1px solid #eee' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                    {formatDate(result.timestamp)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {result.startFolder} - {(result.summary?.totalPhotos || 0) + (result.summary?.totalShortVideos || 0) + (result.summary?.totalLongVideos || 0) + (result.summary?.totalEmptyFolders || 0)} files
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteScanResult(result.filePath)}
                  disabled={deletingScans.has(result.filePath)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: deletingScans.has(result.filePath) ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    opacity: deletingScans.has(result.filePath) ? 0.5 : 1
                  }}
                >
                  {deletingScans.has(result.filePath) ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasValidationErrors && (
        <div style={{ 
          marginTop: '10px', 
          padding: '10px', 
          backgroundColor: '#ffebee', 
          border: '1px solid #f44336', 
          borderRadius: '4px' 
        }}>
          <strong style={{ color: '#d32f2f' }}>Please fix the following errors:</strong>
          <ul style={{ margin: '5px 0 0 20px', color: '#d32f2f' }}>
            {Object.entries(validationErrors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {isRunning && (
        <div style={{ 
          marginTop: '15px', 
          padding: '10px', 
          backgroundColor: '#e3f2fd', 
          border: '1px solid #2196F3', 
          borderRadius: '4px',
          textAlign: 'center' 
        }}>
          <strong style={{ color: '#1976d2' }}>
            {stage === 'scanning' && 'Scanning files...'}
            {stage === 'waiting' && 'Waiting for confirmation...'}
            {stage === 'running' && 'Processing files...'}
          </strong>
        </div>
      )}
    </FormSection>
  );
};

export default OperationControls;
