'use client';

import { useEffect, useState } from 'react';

interface SystemInfo {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  uptime: number;
}

export default function SystemInfo() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    // Mock system information for web version
    const mockSystemInfo = {
      cpu_usage: Math.random() * 30 + 10, // 10-40%
      memory_usage: Math.random() * 20 + 40, // 40-60%
      disk_usage: Math.random() * 15 + 60, // 60-75%
      uptime: Date.now() / 1000 - (Math.random() * 86400 * 7) // Random uptime within a week
    };

    setSystemInfo(mockSystemInfo);

    // Update system info every 5 seconds
    const interval = setInterval(() => {
      setSystemInfo(prev => prev ? {
        ...prev,
        cpu_usage: Math.max(5, Math.min(95, prev.cpu_usage + (Math.random() - 0.5) * 10)),
        memory_usage: Math.max(20, Math.min(90, prev.memory_usage + (Math.random() - 0.5) * 5)),
        disk_usage: Math.max(40, Math.min(95, prev.disk_usage + (Math.random() - 0.5) * 2))
      } : mockSystemInfo);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (!systemInfo) {
    return (
      <div className="glass-container p-6">
        <h2 className="text-2xl font-semibold mb-4 text-white">System Information</h2>
        <div className="text-white/70">Loading system information...</div>
      </div>
    );
  }

  return (
    <div className="glass-container p-6">
      <h2 className="text-2xl font-semibold mb-6 text-white">System Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-section p-4">
          <div className="text-white/70 text-sm">CPU Usage</div>
          <div className="text-2xl font-bold text-white">{systemInfo.cpu_usage.toFixed(1)}%</div>
          <div className="w-full bg-white/20 rounded-full h-2 mt-2">
            <div 
              className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${systemInfo.cpu_usage}%` }}
            />
          </div>
        </div>

        <div className="glass-section p-4">
          <div className="text-white/70 text-sm">Memory Usage</div>
          <div className="text-2xl font-bold text-white">{systemInfo.memory_usage.toFixed(1)}%</div>
          <div className="w-full bg-white/20 rounded-full h-2 mt-2">
            <div 
              className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${systemInfo.memory_usage}%` }}
            />
          </div>
        </div>

        <div className="glass-section p-4">
          <div className="text-white/70 text-sm">Disk Usage</div>
          <div className="text-2xl font-bold text-white">{systemInfo.disk_usage.toFixed(1)}%</div>
          <div className="w-full bg-white/20 rounded-full h-2 mt-2">
            <div 
              className="bg-gradient-to-r from-purple-400 to-pink-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${systemInfo.disk_usage}%` }}
            />
          </div>
        </div>

        <div className="glass-section p-4">
          <div className="text-white/70 text-sm">Uptime</div>
          <div className="text-2xl font-bold text-white">{formatUptime(systemInfo.uptime)}</div>
          <div className="text-white/50 text-xs mt-2">System running</div>
        </div>
      </div>
    </div>
  );
}
