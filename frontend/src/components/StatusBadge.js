import React from 'react';

const StatusBadge = ({ status, isDryRun = false, className = '' }) => {
  const getStatusColor = (status, isDryRun) => {
    if (isDryRun && (status === 'running' || status === 'scanning' || status === 'waiting')) {
      return '#2196f3'; // Blue for dry run modes
    }
    
    switch (status) {
      case 'done':
        return isDryRun ? '#2196f3' : '#4caf50';
      case 'aborted':
      case 'error':
        return '#f44336';
      case 'running':
      case 'scanning':
        return '#ff9800';
      case 'waiting':
        return '#2196f3';
      default:
        return '#9e9e9e';
    }
  };

  const getStatusText = (status, isDryRun) => {
    if (isDryRun) {
      switch (status) {
        case 'running':
          return 'previewing';
        case 'scanning':
          return 'scanning (preview)';
        case 'waiting':
          return 'ready to preview';
        case 'done':
          return 'preview complete';
        default:
          return status;
      }
    }
    return status;
  };

  return (
    <span
      className={`status-badge ${className}`}
      style={{
        padding: '4px 12px',
        borderRadius: '16px',
        fontSize: '12px',
        fontWeight: 'bold',
        backgroundColor: getStatusColor(status, isDryRun),
        color: 'white',
        textTransform: 'uppercase',
        display: 'inline-block',
      }}
    >
      {getStatusText(status, isDryRun)}
    </span>
  );
};

export default StatusBadge;
