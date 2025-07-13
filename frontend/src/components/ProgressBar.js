import React from 'react';

const ProgressBar = ({ progress, total, className = '' }) => {
  const percentage = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0;
  const hasProgress = total > 0;
  
  return (
    <div className={`progress-container ${className}`}>
      <div
        style={{
          width: '100%',
          height: '24px',
          backgroundColor: '#e0e0e0',
          borderRadius: '12px',
          overflow: 'hidden',
          marginBottom: '8px',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: hasProgress ? `${percentage}%` : '0%',
            height: '100%',
            background: 'linear-gradient(90deg, #2196f3, #64b5f6)',
            transition: 'width 0.3s ease',
            borderRadius: '12px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '12px',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
          }}
        >
          {hasProgress ? `${percentage}%` : '0%'}
        </div>
      </div>
      <div style={{ fontSize: '14px', color: '#666', textAlign: 'center' }}>
        {hasProgress ? `${progress} / ${total} files` : `${progress || 0} files found`}
      </div>
    </div>
  );
};

export default ProgressBar;
