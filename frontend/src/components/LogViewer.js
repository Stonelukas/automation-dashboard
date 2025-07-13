import React, { useEffect, useRef, useState } from 'react';

const LogViewer = ({ logs, className = '' }) => {
  const logContainerRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Check if user is at the bottom of the scroll area
  const checkIfAtBottom = () => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px tolerance
      setIsAtBottom(atBottom);
    }
  };

  // Auto-scroll to bottom when new logs are added, but only if user was already at bottom
  useEffect(() => {
    if (isAtBottom && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isAtBottom]);

  // Initial scroll to bottom when component mounts
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, []);

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      setIsAtBottom(true);
    }
  };

  return (
    <div className={`log-viewer ${className}`} style={{ position: 'relative' }}>
      <div
        ref={logContainerRef}
        onScroll={checkIfAtBottom}
        style={{
          backgroundColor: '#1a1a1a',
          color: '#e0e0e0',
          padding: '15px',
          height: '300px',
          overflowY: 'auto',
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          fontSize: '13px',
          lineHeight: '1.4',
          borderRadius: '8px',
          border: '1px solid #333',
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#888', fontStyle: 'italic' }}>
            Waiting for logs...
          </div>
        ) : (
          logs.map((log, index) => {
            const logText = typeof log === 'string' ? log : JSON.stringify(log);
            const isDryRunMessage = logText.includes('[DRY RUN]');
            const isScanningMessage = logText.includes('Analyzing') || logText.includes('Scanning') || logText.includes('Found');
            
            return (
              <div 
                key={index} 
                style={{ 
                  marginBottom: '4px',
                  padding: isDryRunMessage ? '4px 8px' : '0',
                  backgroundColor: isDryRunMessage ? 'rgba(33, 150, 243, 0.2)' : 'transparent',
                  borderLeft: isDryRunMessage ? '3px solid #2196f3' : 'none',
                  borderRadius: isDryRunMessage ? '4px' : '0',
                  color: isDryRunMessage ? '#64b5f6' : (isScanningMessage ? '#81c784' : '#e0e0e0'),
                  fontWeight: isDryRunMessage ? 'bold' : 'normal'
                }}
              >
                {logText}
              </div>
            );
          })
        )}
      </div>
      
      {/* Scroll to bottom button - only show when not at bottom and there are logs */}
      {!isAtBottom && logs.length > 0 && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'background-color 0.2s',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#005a9e';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#007acc';
          }}
          title="Scroll to bottom"
        >
          ↓
        </button>
      )}
    </div>
  );
};

export default LogViewer;
