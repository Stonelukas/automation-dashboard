'use client';

import React from 'react';

interface LogViewerProps {
  logs: string[];
}

/**
 * LogViewer component for displaying operation logs
 */
const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  return (
    <div className="bg-black/20 border border-white/20 rounded-lg p-4 max-h-60 overflow-y-auto">
      <div className="space-y-1 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-white/50 italic">No logs yet...</div>
        ) : (
          logs.map((log, index) => (
            <div 
              key={index} 
              className={`text-white/90 ${
                log.toLowerCase().includes('error') ? 'text-red-400' :
                log.toLowerCase().includes('warning') ? 'text-yellow-400' :
                log.toLowerCase().includes('success') ? 'text-green-400' :
                log.toLowerCase().includes('[dry run]') ? 'text-blue-400' :
                'text-white/90'
              }`}
            >
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogViewer;
