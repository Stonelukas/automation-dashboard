import React from 'react';

const ProgressBar = ({ progress, stage, onFileListAction, className = '' }) => {
  // Handle both old and new progress formats
  const photosToDelete = progress?.PhotosToDelete || progress?.photosToDelete || 0;
  const videosToDelete = progress?.VideosToDelete || progress?.videosToDelete || 0;
  const videosToMove = progress?.VideosToMove || progress?.videosToMove || 0;
  const foldersToDelete = progress?.FoldersToDelete || progress?.foldersToDelete || 0;
  const processedVideos = progress?.ProcessedVideos || progress?.processed || 0;
  const totalVideos = progress?.TotalVideos || progress?.total || 0;

  // Calculate percentage for scanning progress
  const scanningPercentage = totalVideos > 0 ? Math.min(100, Math.round((processedVideos / totalVideos) * 100)) : 0;
  const hasProgress = totalVideos > 0;
  
  // Total items that will be processed
  const totalItems = photosToDelete + videosToDelete + videosToMove + foldersToDelete;

  const getStageDisplay = () => {
    switch (stage) {
      case 'scanning':
        return {
          title: 'Scanning Files...',
          progress: scanningPercentage,
          text: hasProgress ? `${processedVideos} / ${totalVideos} files analyzed` : `${processedVideos || 0} files found`,
          color: 'var(--accent-orange)'
        };
      case 'waiting':
        return {
          title: 'Ready for Execution',
          progress: 100,
          text: `${totalItems} items ready for processing`,
          color: 'var(--accent-blue)'
        };
      case 'running':
        return {
          title: 'Processing Files...',
          progress: scanningPercentage,
          text: `Processing ${totalItems} items...`,
          color: 'var(--accent-green)'
        };
      case 'done':
        return {
          title: 'Operation Complete',
          progress: 100,
          text: `Processed ${totalItems} items successfully`,
          color: 'var(--accent-green)'
        };
      default:
        return {
          title: 'Ready',
          progress: 0,
          text: 'No operation in progress',
          color: 'var(--text-secondary)'
        };
    }
  };

  const stageDisplay = getStageDisplay();

  return (
    <div className={`section-card animate-slide-in-bottom ${className}`}>
      <div className="section-header">
        <span className="section-icon">📊</span>
        <h3 className="section-title">Progress Overview</h3>
      </div>
      
      {/* Modern Progress Bar */}
      <div className="relative mb-6">
        <div className="w-full h-3 bg-secondary-bg rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${stageDisplay.progress}%`,
              background: `linear-gradient(90deg, ${stageDisplay.color}, ${stageDisplay.color}99)`
            }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white drop-shadow-md">
            {stageDisplay.progress}%
          </span>
        </div>
      </div>
      
      {/* Stage Info */}
      <div className="text-center mb-6">
        <h4 className="text-lg font-semibold mb-2" style={{ color: stageDisplay.color }}>
          {stageDisplay.title}
        </h4>
        <p className="text-sm text-secondary">
          {stageDisplay.text}
        </p>
      </div>

      {/* Modern Summary Cards */}
      {totalItems > 0 && (
        <div className="mt-6">
          <h4 className="text-center text-lg font-semibold mb-4 text-primary">
            Operation Summary
          </h4>
          <div className="grid grid-2 gap-4">
            {photosToDelete > 0 && (
              <div 
                className="glass-card p-4 border-l-4 border-red-400 cursor-pointer transition-all duration-300 hover:scale-105"
                onClick={() => onFileListAction && onFileListAction('view', 'photoFiles')}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🖼️</span>
                  <div>
                    <div className="text-sm font-medium text-red-400">
                      Photos to Delete
                    </div>
                    <div className="text-xl font-bold text-red-400">
                      {photosToDelete.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {videosToDelete > 0 && (
              <div 
                className="glass-card p-4 border-l-4 border-red-400 cursor-pointer transition-all duration-300 hover:scale-105"
                onClick={() => onFileListAction && onFileListAction('view', 'shortVideos')}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎬</span>
                  <div>
                    <div className="text-sm font-medium text-red-400">
                      Short Videos to Delete
                    </div>
                    <div className="text-xl font-bold text-red-400">
                      {videosToDelete.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {videosToMove > 0 && (
              <div 
                className="glass-card p-4 border-l-4 border-blue-400 cursor-pointer transition-all duration-300 hover:scale-105"
                onClick={() => onFileListAction && onFileListAction('view', 'longVideos')}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎥</span>
                  <div>
                    <div className="text-sm font-medium text-blue-400">
                      Long Videos to Move
                    </div>
                    <div className="text-xl font-bold text-blue-400">
                      {videosToMove.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {foldersToDelete > 0 && (
              <div 
                className="glass-card p-4 border-l-4 border-yellow-400 cursor-pointer transition-all duration-300 hover:scale-105"
                onClick={() => onFileListAction && onFileListAction('view', 'emptyFolders')}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📁</span>
                  <div>
                    <div className="text-sm font-medium text-yellow-400">
                      Empty Folders to Remove
                    </div>
                    <div className="text-xl font-bold text-yellow-400">
                      {foldersToDelete.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
