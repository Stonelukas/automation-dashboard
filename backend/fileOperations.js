// fileOperations.js - Node.js replacement for PowerShell cleanup script
const fs = require('fs').promises;
const path = require('path');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// Cross-platform trash/recycle bin support
let trash;
try {
  trash = require('trash');
} catch (error) {
  console.warn('trash module not available, will use permanent deletion as fallback');
}

// FFprobe static binary for video duration detection
let ffprobe;
try {
  ffprobe = require('ffprobe-static');
} catch (error) {
  console.warn('ffprobe-static not available, will use system ffprobe');
  ffprobe = 'ffprobe'; // fallback to system ffprobe
}

class FileOperationsService {
  constructor(socketIo) {
    this.io = socketIo;
    this.isRunning = false;
    this.shouldAbort = false;
    this.logs = []; // Accumulate logs for frontend
    this.currentStage = 'idle'; // Track current stage
    this.operationLog = {
      timestamp: new Date().toISOString(),
      operations: []
    };
    this.lastStatusEmission = 0; // Throttle status emissions
    this.statusEmissionDelay = 100; // Minimum delay between status emissions (ms)
  }

  // Enhanced logging function that emits to frontend
  emitStatus(data) {
    if (this.shouldAbort) return; // Don't emit status if aborted
    
    if (this.io) {
      this.io.emit('status', data);
    }
    console.log('FileOps:', JSON.stringify(data));
  }

  // Clear logs for new operation
  clearLogs() {
    this.logs = [];
  }

  emitLog(message) {
    if (this.shouldAbort) return; // Don't emit logs if aborted
    
    const logEntry = `${new Date().toISOString()}: ${message}`;
    this.logs.push(logEntry);
    
    // Send full status update with logs array for real-time feedback
    if (this.io) {
      this.io.emit('status', {
        stage: this.currentStage,
        logs: this.logs,
        progress: {
          ProcessedVideos: 0,
          TotalVideos: 0,
          photosToDelete: 0,
          videosToDelete: 0,
          foldersToDelete: 0,
          videosToMove: 0
        }
      });
    }
  }

  emitProgress(processed, total, stage = 'processing') {
    // Send progress in the format the frontend expects
    if (this.io) {
      const progressData = {
        stage: stage,
        logs: this.logs, // Include current logs
        progress: {
          ProcessedVideos: processed,
          TotalVideos: total,
          photosToDelete: 0,
          videosToDelete: 0,
          videosToMove: 0,
          foldersToDelete: 0
        }
      };
      
      this.io.emit('status', progressData);
    }
    
    console.log('FileOps:', JSON.stringify({
      type: 'progress',
      processed: processed,
      total: total,
      stage: stage
    }));
  }

  emitStageStatus(stage, progress = {}, isDryRun = false) {
    if (this.shouldAbort && stage !== 'aborted') return; // Don't emit status if aborted (except for abort status)
    
    // Throttle status emissions to prevent spam (except for important stages)
    const now = Date.now();
    const isImportantStage = ['waiting', 'done', 'aborted', 'idle'].includes(stage);
    
    if (!isImportantStage && (now - this.lastStatusEmission) < this.statusEmissionDelay) {
      return; // Skip this emission to prevent spam
    }
    
    this.lastStatusEmission = now;
    this.currentStage = stage; // Update current stage
    
    // Send status in the format the frontend expects (direct properties, not nested in 'progress')
    if (this.io) {
      this.io.emit('status', {
        stage: stage,
        progress: progress,
        logs: this.logs, // Include accumulated logs
        isDryRun: isDryRun,
        // Also include direct properties for compatibility
        ...progress
      });
    }
    console.log('FileOps:', JSON.stringify({
      type: 'status',
      stage: stage,
      progress: progress,
      isDryRun: isDryRun
    }));
  }

  // Add operation to log for revert functionality
  addOperationLog(type, source, destination = null, size = 0) {
    this.operationLog.operations.push({
      type: type,
      source: source,
      destination: destination,
      size: size,
      timestamp: new Date().toISOString()
    });
  }

  // Save operation log
  async saveOperationLog(logPath) {
    try {
      await fs.writeFile(logPath, JSON.stringify(this.operationLog, null, 2), 'utf8');
      this.emitLog(`Operation log saved to: ${path.basename(logPath)}`);
    } catch (error) {
      this.emitLog(`Failed to save operation log: ${error.message}`);
    }
  }

  // Get video duration using ffprobe
  async getVideoDuration(videoPath) {
    try {
      const ffprobePath = typeof ffprobe === 'string' ? ffprobe : ffprobe.path || 'ffprobe';
      const { stdout } = await execFileAsync(ffprobePath, [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        videoPath
      ]);
      
      const duration = parseFloat(stdout.trim());
      return isNaN(duration) ? null : duration;
    } catch (error) {
      this.emitLog(`Warning: Could not determine duration for ${path.basename(videoPath)}: ${error.message}`);
      return null;
    }
  }

  // Check if path is in ignored folders
  isInIgnoredFolder(fullPath, ignoreFolders, startFolder) {
    if (!ignoreFolders || ignoreFolders.length === 0) return false;
    
    const normalizedPath = path.normalize(fullPath).toLowerCase();
    
    for (const ignored of ignoreFolders) {
      try {
        const ignoredPath = path.resolve(startFolder, ignored).toLowerCase();
        if (normalizedPath.startsWith(ignoredPath)) {
          return true;
        }
      } catch (error) {
        this.emitLog(`Warning: Could not resolve ignored folder path: ${ignored}`);
      }
    }
    return false;
  }

  // Count files with specific extensions (fast count without file details)
  async countFiles(dir, extensions, ignoreFolders = [], startFolder = dir) {
    let count = 0;
    
    try {
      if (this.shouldAbort) return count;
      
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        if (this.shouldAbort) break;
        
        const fullPath = path.join(dir, item.name);
        
        // Skip ignored folders
        if (this.isInIgnoredFolder(fullPath, ignoreFolders, startFolder)) {
          continue;
        }
        
        if (item.isDirectory()) {
          // Recursively count files in subdirectories
          count += await this.countFiles(fullPath, extensions, ignoreFolders, startFolder);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase().slice(1);
          if (extensions.includes(ext)) {
            count++;
          }
        }
      }
    } catch (error) {
      this.emitLog(`Error counting files in ${dir}: ${error.message}`);
    }
    
    return count;
  }

  // Recursively get files with specific extensions
  async getFilesRecursive(dir, extensions, ignoreFolders = [], startFolder = dir, progressCallback = null) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (this.shouldAbort) break;
        
        const fullPath = path.join(dir, entry.name);
        
        // Skip ignored folders
        if (this.isInIgnoredFolder(fullPath, ignoreFolders, startFolder)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          const subFiles = await this.getFilesRecursive(fullPath, extensions, ignoreFolders, startFolder, progressCallback);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase().slice(1);
          if (extensions.includes(ext)) {
            const stats = await fs.stat(fullPath);
            files.push({
              path: fullPath,
              name: entry.name,
              size: stats.size,
              lastModified: stats.mtime.toISOString()
            });
            
            // Emit progress update for file scanning
            if (progressCallback) {
              progressCallback(files.length, entry.name);
            }
          }
        }
      }
    } catch (error) {
      this.emitLog(`Error scanning directory ${dir}: ${error.message}`);
    }
    
    return files;
  }

  // Find empty directories
  async getEmptyDirectories(dir, ignoreFolders = [], startFolder = dir, progressCallback = null) {
    const emptyDirs = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const subdirs = entries.filter(entry => entry.isDirectory());
      
      for (const subdir of subdirs) {
        if (this.shouldAbort) break;
        
        const fullPath = path.join(dir, subdir.name);
        
        // Skip ignored folders
        if (this.isInIgnoredFolder(fullPath, ignoreFolders, startFolder)) {
          continue;
        }
        
        // Recursively check subdirectories first
        const subEmptyDirs = await this.getEmptyDirectories(fullPath, ignoreFolders, startFolder, progressCallback);
        emptyDirs.push(...subEmptyDirs);
        
        // Check if current directory is empty (after removing empty subdirectories)
        try {
          const currentEntries = await fs.readdir(fullPath);
          if (currentEntries.length === 0) {
            const stats = await fs.stat(fullPath);
            emptyDirs.push({
              path: fullPath,
              name: subdir.name,
              lastModified: stats.mtime.toISOString()
            });
            
            // Emit progress update for empty folder scanning
            if (progressCallback) {
              progressCallback(emptyDirs.length, subdir.name);
            }
          }
        } catch (error) {
          this.emitLog(`Error checking directory ${fullPath}: ${error.message}`);
        }
      }
    } catch (error) {
      this.emitLog(`Error scanning directory ${dir}: ${error.message}`);
    }
    
    return emptyDirs;
  }

  // Move file/folder to trash (cross-platform)
  async moveToTrash(filePath, description = 'File') {
    try {
      if (trash && typeof trash === 'function') {
        // Trash module expects an array of file paths
        await trash([filePath]);
        this.emitLog(`Moved ${description} to trash: ${path.basename(filePath)}`);
        return true;
      } else if (trash && typeof trash.default === 'function') {
        // Handle ES6 module export
        await trash.default([filePath]);
        this.emitLog(`Moved ${description} to trash: ${path.basename(filePath)}`);
        return true;
      } else {
        // Fallback: permanent deletion if trash is not available
        this.emitLog(`Warning: Trash not available, permanently deleting ${description}: ${path.basename(filePath)}`);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          await fs.rmdir(filePath, { recursive: true });
        } else {
          await fs.unlink(filePath);
        }
        this.emitLog(`Permanently deleted ${description}: ${path.basename(filePath)}`);
        return true;
      }
    } catch (error) {
      this.emitLog(`Failed to delete ${description}: ${error.message}`);
      return false;
    }
  }

  // Handle file deletion with options
  async removeFileWithChoice(filePath, description = 'File', isDryRun = false) {
    if (isDryRun) {
      try {
        const stats = await fs.stat(filePath);
        const fileSize = this.formatFileSize(stats.size);
        const fileName = path.basename(filePath);
        const parentDir = path.dirname(filePath);
        
        this.emitLog(`[DRY RUN] Would delete ${description} '${fileName}' (${fileSize}) in '${parentDir}'`);
        return true;
      } catch (error) {
        this.emitLog(`[DRY RUN] Error getting file info for ${filePath}: ${error.message}`);
        return false;
      }
    }

    // Get file stats BEFORE moving to trash
    let fileSize = 0;
    try {
      const stats = await fs.stat(filePath);
      fileSize = stats.size;
    } catch (error) {
      this.emitLog(`Warning: Could not get file size for ${filePath}: ${error.message}`);
    }
    
    const success = await this.moveToTrash(filePath, description);
    if (success) {
      this.addOperationLog('trash', filePath, null, fileSize);
    }
    return success;
  }

  // Format file size for display
  formatFileSize(bytes) {
    if (bytes > 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else if (bytes > 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else if (bytes > 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${bytes} bytes`;
    }
  }

  // Save scan results to JSON file
  async saveScanResults(scanPath, photoFiles, shortVideos, longVideos, emptyFolders, config) {
    try {
      const scanResults = {
        timestamp: new Date().toISOString(),
        startFolder: config.startFolder,
        videoMoveTarget: config.videoMoveTarget,
        configuration: {
          minVideoLengthSec: config.minVideoLengthSec,
          photoExtensions: config.photoExtensions,
          videoExtensions: config.videoExtensions,
          deleteEmptyFolders: config.deleteEmptyFolders,
          moveVideos: config.moveVideos,
          ignoreFolders: config.ignoreFolders
        },
        scanResults: {
          totalPhotos: photoFiles.length,
          totalShortVideos: shortVideos.length,
          totalLongVideos: longVideos.length,
          totalEmptyFolders: emptyFolders.length,
          photoFiles: photoFiles,
          shortVideos: shortVideos,
          longVideos: longVideos,
          emptyFolders: emptyFolders
        }
      };
      
      await fs.writeFile(scanPath, JSON.stringify(scanResults, null, 2), 'utf8');
      this.emitLog(`Scan results saved to: ${path.basename(scanPath)}`);
      this.emitLog(`Saved totals - Photos: ${photoFiles.length}, Short videos: ${shortVideos.length}, Long videos: ${longVideos.length}, Empty folders: ${emptyFolders.length}`);
    } catch (error) {
      this.emitLog(`Failed to save scan results: ${error.message}`);
    }
  }

  // Load scan results from JSON file
  async loadScanResults(scanPath) {
    this.shouldAbort = false; // Reset abort flag for new operation
    this.clearLogs(); // Clear previous logs
    
    try {
      const content = await fs.readFile(scanPath, 'utf8');
      const scanData = JSON.parse(content);
      
      this.emitLog(`Loaded scan results from: ${path.basename(scanPath)}`);
      this.emitLog(`Scan performed on: ${scanData.timestamp}`);
      this.emitLog(`Original folder: ${scanData.startFolder}`);
      
      if (!scanData.scanResults) {
        this.emitLog('Invalid scan results file: missing scanResults section');
        return null;
      }
      
      const photosCount = scanData.scanResults.totalPhotos || 0;
      const shortVideosCount = scanData.scanResults.totalShortVideos || 0;
      const longVideosCount = scanData.scanResults.totalLongVideos || 0;
      const emptyFoldersCount = scanData.scanResults.totalEmptyFolders || 0;
      
      this.emitLog(`Loaded totals from file - Photos: ${photosCount}, Short videos: ${shortVideosCount}, Long videos: ${longVideosCount}, Empty folders: ${emptyFoldersCount}`);
      
      return scanData;
    } catch (error) {
      this.emitLog(`Failed to load scan results: ${error.message}`);
      return null;
    }
  }

  // Verify loaded files still exist
  async verifyLoadedFiles(scanResults) {
    this.emitLog(`Starting verification of loaded files...`);
    this.emitLog(`Received scanResults structure:`, JSON.stringify(Object.keys(scanResults), null, 2));
    this.emitLog(`Original counts - Photos: ${scanResults.photoFiles?.length || 0}, Short videos: ${scanResults.shortVideos?.length || 0}, Long videos: ${scanResults.longVideos?.length || 0}, Empty folders: ${scanResults.emptyFolders?.length || 0}`);
    
    // Debug: Show first few items if they exist
    if (scanResults.shortVideos && scanResults.shortVideos.length > 0) {
      this.emitLog(`First short video in scan results: ${JSON.stringify(scanResults.shortVideos[0], null, 2)}`);
    }
    
    const verifiedData = {
      photoFiles: [],
      shortVideos: [],
      longVideos: [],
      emptyFolders: []
    };
    
    // Verify photo files
    if (scanResults.photoFiles) {
      this.emitLog(`Verifying ${scanResults.photoFiles.length} photo files...`);
      for (const file of scanResults.photoFiles) {
        try {
          await fs.access(file.path);
          verifiedData.photoFiles.push(file);
        } catch (error) {
          this.emitLog(`Photo file no longer exists: ${path.basename(file.path)} - Error: ${error.message}`);
        }
      }
    } else {
      this.emitLog('No photo files to verify (scanResults.photoFiles is empty or undefined)');
    }
    
    // Verify short videos
    if (scanResults.shortVideos) {
      this.emitLog(`Verifying ${scanResults.shortVideos.length} short videos...`);
      for (const file of scanResults.shortVideos) {
        try {
          this.emitLog(`Checking file existence: ${file.path}`);
          await fs.access(file.path);
          verifiedData.shortVideos.push(file);
          this.emitLog(`Verified short video exists: ${path.basename(file.path)}`);
        } catch (error) {
          this.emitLog(`Short video no longer exists: ${path.basename(file.path)} - Error: ${error.message}`);
          this.emitLog(`Full path was: ${file.path}`);
        }
      }
    } else {
      this.emitLog('No short videos to verify (scanResults.shortVideos is empty or undefined)');
    }
    
    // Verify long videos
    if (scanResults.longVideos) {
      for (const file of scanResults.longVideos) {
        try {
          await fs.access(file.path);
          verifiedData.longVideos.push(file);
        } catch (error) {
          this.emitLog(`Long video no longer exists: ${path.basename(file.path)}`);
        }
      }
    }
    
    // Verify empty folders
    if (scanResults.emptyFolders) {
      for (const folder of scanResults.emptyFolders) {
        try {
          await fs.access(folder.path);
          
          // For folders with non-media files, re-verify the files still exist
          if (folder.hasNonMediaFiles && folder.nonMediaFiles) {
            const verifiedNonMediaFiles = [];
            for (const nonMediaFile of folder.nonMediaFiles) {
              try {
                await fs.access(nonMediaFile.path);
                verifiedNonMediaFiles.push(nonMediaFile);
              } catch (error) {
                this.emitLog(`Non-media file no longer exists: ${path.basename(nonMediaFile.path)}`);
              }
            }
            
            // Update the folder object with verified non-media files
            if (verifiedNonMediaFiles.length > 0) {
              verifiedData.emptyFolders.push({
                ...folder,
                nonMediaFiles: verifiedNonMediaFiles,
                size: verifiedNonMediaFiles.reduce((sum, file) => sum + file.size, 0)
              });
            } else {
              // No non-media files left, check if folder is still empty
              const entries = await fs.readdir(folder.path);
              if (entries.length === 0) {
                verifiedData.emptyFolders.push({
                  ...folder,
                  hasNonMediaFiles: false,
                  nonMediaFiles: undefined,
                  requiresUserDecision: false
                });
              } else {
                this.emitLog(`Folder no longer empty: ${path.basename(folder.path)}`);
              }
            }
          } else {
            // Regular empty folder - check if still empty
            const entries = await fs.readdir(folder.path);
            if (entries.length === 0) {
              verifiedData.emptyFolders.push(folder);
            } else {
              this.emitLog(`Folder no longer empty: ${path.basename(folder.path)}`);
            }
          }
        } catch (error) {
          this.emitLog(`Empty folder no longer exists: ${path.basename(folder.path)}`);
        }
      }
    }
    
    this.emitLog(`Verified files still exist - Photos: ${verifiedData.photoFiles.length}, Short videos: ${verifiedData.shortVideos.length}, Long videos: ${verifiedData.longVideos.length}, Empty folders: ${verifiedData.emptyFolders.length}`);
    
    return verifiedData;
  }

  // Main scanning function
  async performScan(config) {
    this.shouldAbort = false;
    this.clearLogs(); // Clear previous logs
    
    this.emitLog(`Starting file scan in: ${config.startFolder}`);
    
    // Parse extensions - handle both string and array formats
    const photoExtensions = Array.isArray(config.photoExtensions) 
      ? config.photoExtensions.map(ext => ext.trim().toLowerCase())
      : config.photoExtensions.split(',').map(ext => ext.trim().toLowerCase());
    const videoExtensions = Array.isArray(config.videoExtensions) 
      ? config.videoExtensions.map(ext => ext.trim().toLowerCase())
      : config.videoExtensions.split(',').map(ext => ext.trim().toLowerCase());
    
    this.emitLog(`Configuration: MinVideoLength=${config.minVideoLengthSec}s (videos shorter will be deleted)`);
    this.emitLog(`Photo extensions: ${photoExtensions.join(', ')}`);
    this.emitLog(`Video extensions: ${videoExtensions.join(', ')}`);
    this.emitLog(`Delete empty folders: ${config.deleteEmptyFolders}, Move videos: ${config.moveVideos}`);
    
    // First pass: Count all files to get total BEFORE starting scan
    this.emitLog('Counting files...');
    const photoCount = await this.countFiles(config.startFolder, photoExtensions, config.ignoreFolders);
    const videoCount = await this.countFiles(config.startFolder, videoExtensions, config.ignoreFolders);
    const totalFiles = photoCount + videoCount;
    
    this.emitLog(`Found ${totalFiles} files total (${photoCount} photos, ${videoCount} videos)`);
    
    // Initialize counters with fixed total
    let processedCount = 0;
    let photosToDelete = 0;
    let videosToDelete = 0;
    let videosToMove = 0;
    let foldersToDelete = 0;
    
    // Send initial status with fixed total
    this.emitStageStatus('scanning', {
      ProcessedVideos: 0,
      TotalVideos: totalFiles,
      photosToDelete: 0,
      videosToDelete: 0,
      videosToMove: 0,
      foldersToDelete: 0
    });
    
    // Scan for photo files
    this.emitLog('Scanning photo files...');
    const photoFiles = await this.getFilesRecursive(
      config.startFolder, 
      photoExtensions, 
      config.ignoreFolders,
      config.startFolder,
      (count, fileName) => {
        processedCount++;
        photosToDelete = count; // Update dynamic counter
        
        // Send progress update with FIXED total
        this.emitStageStatus('scanning', {
          ProcessedVideos: processedCount,
          TotalVideos: totalFiles, // FIXED total, never changes
          photosToDelete: photosToDelete,
          videosToDelete: videosToDelete,
          videosToMove: videosToMove,
          foldersToDelete: foldersToDelete
        });
      }
    );
    
    if (this.shouldAbort) return null;
    
    const totalPhotoSize = photoFiles.reduce((sum, file) => sum + file.size, 0);
    this.emitLog(`Found ${photoFiles.length} photo files (${this.formatFileSize(totalPhotoSize)}) - all will be deleted`);
    
    // Scan for video files
    this.emitLog('Scanning video files...');
    
    // Create extended ignore list for videos including videoMoveTarget
    const videoIgnoreFolders = [...config.ignoreFolders];
    if (config.videoMoveTarget && config.videoMoveTarget !== config.startFolder) {
      videoIgnoreFolders.push(config.videoMoveTarget);
      this.emitLog(`Excluding video move target from video scanning: ${config.videoMoveTarget}`);
    }
    
    const allVideoFiles = await this.getFilesRecursive(
      config.startFolder, 
      videoExtensions, 
      videoIgnoreFolders, // Use extended ignore list for videos
      config.startFolder,
      (count, fileName) => {
        processedCount++;
        
        // Send progress update with FIXED total
        this.emitStageStatus('scanning', {
          ProcessedVideos: processedCount,
          TotalVideos: totalFiles, // FIXED total, never changes
          photosToDelete: photosToDelete,
          videosToDelete: videosToDelete,
          videosToMove: videosToMove,
          foldersToDelete: foldersToDelete
        });
      }
    );
    
    if (this.shouldAbort) return null;
    
    const totalVideoSize = allVideoFiles.reduce((sum, file) => sum + file.size, 0);
    this.emitLog(`Found ${allVideoFiles.length} video files (${this.formatFileSize(totalVideoSize)}) - analyzing durations...`);
    
    // Analyze video durations
    const shortVideos = [];
    const longVideos = [];
    
    for (let i = 0; i < allVideoFiles.length; i++) {
      if (this.shouldAbort) break;
      
      const video = allVideoFiles[i];
      
      try {
        const duration = await this.getVideoDuration(video.path);
        const videoSize = this.formatFileSize(video.size);
        
        if (duration !== null && duration < config.minVideoLengthSec) {
          shortVideos.push({
            ...video,
            duration: duration // Add duration to video object
          });
          videosToDelete = shortVideos.length; // Update counter
          this.emitLog(`Found short video '${video.name}' (${videoSize}, ${duration}s) - will be deleted`);
        } else {
          // Check if file already exists in target directory to prevent duplicates
          const fileName = path.basename(video.path);
          const potentialTarget = path.join(config.videoMoveTarget, fileName);
          
          let isDuplicate = false;
          try {
            await fs.access(potentialTarget);
            isDuplicate = true;
            this.emitLog(`Found duplicate video '${video.name}' - already exists in target directory, will be deleted`);
            
            // Add to short videos for deletion instead of moving
            shortVideos.push({
              ...video,
              duration: duration,
              isDuplicate: true // Mark as duplicate for deletion
            });
            videosToDelete = shortVideos.length; // Update counter
            
          } catch (error) {
            // File doesn't exist in target, safe to move
            isDuplicate = false;
          }
          
          if (!isDuplicate) {
            longVideos.push({
              ...video,
              duration: duration // Add duration to video object (null if unknown)
            });
            videosToMove = longVideos.length; // Update counter
            if (duration !== null) {
              this.emitLog(`Found normal video '${video.name}' (${videoSize}, ${duration}s) - will be moved`);
            } else {
              this.emitLog(`WARNING: Could not determine duration for '${video.name}' (${videoSize}) - will be moved (safe default)`);
            }
          }
        }
        
        // Send periodic updates with current counters (every 10 videos or at end)
        if (i % 10 === 0 || i === allVideoFiles.length - 1) {
          this.emitStageStatus('scanning', {
            ProcessedVideos: i + 1, // Actual number of processed videos
            TotalVideos: totalFiles, // FIXED total, never changes
            photosToDelete: photosToDelete,
            videosToDelete: videosToDelete,
            videosToMove: videosToMove,
            foldersToDelete: foldersToDelete
          });
        }
        
      } catch (error) {
        this.emitLog(`Error analyzing video ${video.name}: ${error.message}`);
        longVideos.push({
          ...video,
          duration: null // Add null duration for error case
        }); // Default to long video on error (safer)
        videosToMove = longVideos.length; // Update counter
      }
    }
    
    if (this.shouldAbort) return null;
    
    // Scan for empty folders (analyzing future state after operations)
    this.emitLog('Analyzing which folders would be empty after cleanup...');
    
    // Create extended ignore list including videoMoveTarget
    const extendedIgnoreFolders = [...config.ignoreFolders];
    if (config.videoMoveTarget && config.videoMoveTarget !== config.startFolder) {
      extendedIgnoreFolders.push(config.videoMoveTarget);
      this.emitLog(`Excluding video move target from empty folder analysis: ${config.videoMoveTarget}`);
    }
    
    // Get future empty folders (folders that would be empty after cleanup)
    const emptyFolders = await this.getFutureEmptyDirectories(
      config.startFolder,
      extendedIgnoreFolders,
      photoFiles,
      shortVideos,
      longVideos,
      config.startFolder,
      (count, folderName) => {
        foldersToDelete = count; // Update dynamic counter
        this.emitLog(`Found folder that would be empty ${count}: ${folderName}`);
        
        // Send periodic updates with current counters (every 5 folders)
        if (count % 5 === 0 || count === 1) {
          this.emitStageStatus('scanning', {
            ProcessedVideos: totalFiles, // Keep progress at 100% (file collection complete)
            TotalVideos: totalFiles, // FIXED total, never changes
            photosToDelete: photosToDelete,
            videosToDelete: videosToDelete,
            videosToMove: videosToMove,
            foldersToDelete: foldersToDelete
          });
        }
      }
    );
    
    if (emptyFolders.length > 0) {
      this.emitLog(`Found ${emptyFolders.length} empty folders - all will be deleted`);
    } else {
      this.emitLog('No empty folders found');
    }
    
    // Send final summary update with file lists
    this.emitStageStatus('scanning', {
      ProcessedVideos: totalFiles, // File collection is complete
      TotalVideos: totalFiles, // FIXED total, never changes
      photosToDelete: photosToDelete,
      videosToDelete: videosToDelete,
      videosToMove: videosToMove,
      foldersToDelete: foldersToDelete,
      // Include the actual file lists for the frontend
      fileLists: {
        photoFiles: photoFiles,
        shortVideos: shortVideos,
        longVideos: longVideos,
        emptyFolders: emptyFolders
      }
    });
    
    // Debug log to see what we're sending
    this.emitLog(`Sending fileLists - Photos: ${photoFiles.length}, Short videos: ${shortVideos.length}, Long videos: ${longVideos.length}, Empty folders: ${emptyFolders.length}`);
    
    // Only save scan results if not aborted
    if (!this.shouldAbort) {
      // Save scan results to file
      const scanDir = path.join(__dirname, '..', '.data', 'scan_results');
      await fs.mkdir(scanDir, { recursive: true });
      const scanPath = path.join(scanDir, `scan_results_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      await this.saveScanResults(scanPath, photoFiles, shortVideos, longVideos, emptyFolders, config);
    } else {
      this.emitLog('Scan was cancelled - not saving results');
    }
    
    // Note: Final 'done' status will be emitted by server.js with file lists
    
    return { photoFiles, shortVideos, longVideos, emptyFolders };
  }

  // Find directories that would be empty after cleanup operations
  async getFutureEmptyDirectories(dir, ignoreFolders = [], filesToDelete = [], shortVideosToDelete = [], longVideosToMove = [], startFolder = dir, progressCallback = null) {
    const emptyDirs = [];
    const processedDirs = new Set(); // Track processed directories to avoid duplicates
    
    try {
      // Create sets of directories that will lose files
      const photoDirs = new Set();
      const shortVideoDirs = new Set();
      const longVideoDirs = new Set();
      
      // Track which directories will lose files
      filesToDelete.forEach(file => photoDirs.add(path.dirname(file.path)));
      shortVideosToDelete.forEach(video => shortVideoDirs.add(path.dirname(video.path)));
      longVideosToMove.forEach(video => longVideoDirs.add(path.dirname(video.path)));
      
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const subdirs = entries.filter(entry => entry.isDirectory());
      
      for (const subdir of subdirs) {
        if (this.shouldAbort) break;
        
        const fullPath = path.join(dir, subdir.name);
        
        // Skip if already processed
        if (processedDirs.has(fullPath)) {
          continue;
        }
        processedDirs.add(fullPath);
        
        // Skip ignored folders
        if (this.isInIgnoredFolder(fullPath, ignoreFolders, startFolder)) {
          continue;
        }
        
        // Recursively check subdirectories first
        const subEmptyDirs = await this.getFutureEmptyDirectories(
          fullPath, 
          ignoreFolders, 
          filesToDelete, 
          shortVideosToDelete, 
          longVideosToMove, 
          startFolder, 
          progressCallback
        );
        emptyDirs.push(...subEmptyDirs);
        
        // Check if current directory would be empty after operations
        try {
          const currentEntries = await fs.readdir(fullPath);
          let remainingFiles = 0;
          let remainingDirs = 0;
          
          // Count files and directories that would remain
          const remainingFilesList = [];
          for (const entry of currentEntries) {
            const entryPath = path.join(fullPath, entry);
            const entryStats = await fs.stat(entryPath);
            
            if (entryStats.isDirectory()) {
              // Check if this subdirectory would also be empty (and thus deleted)
              const isSubdirToBeDeleted = emptyDirs.some(emptyDir => emptyDir.path === entryPath);
              if (!isSubdirToBeDeleted) {
                remainingDirs++;
              }
            } else {
              // Check if this file would be deleted or moved
              const isPhotoToDelete = filesToDelete.some(photo => photo.path === entryPath);
              const isShortVideoToDelete = shortVideosToDelete.some(video => video.path === entryPath);
              const isLongVideoToMove = longVideosToMove.some(video => video.path === entryPath);
              
              if (!isPhotoToDelete && !isShortVideoToDelete && !isLongVideoToMove) {
                remainingFiles++;
                remainingFilesList.push({
                  path: entryPath,
                  name: entry,
                  size: entryStats.size
                });
              }
            }
          }
          
          // If no files or directories would remain, this folder would be empty
          if (remainingFiles === 0 && remainingDirs === 0) {
            const stats = await fs.stat(fullPath);
            emptyDirs.push({
              path: fullPath,
              name: subdir.name,
              lastModified: stats.mtime.toISOString()
            });
            
            // Emit progress update for empty folder scanning
            if (progressCallback) {
              progressCallback(emptyDirs.length, subdir.name);
            }
          } else if (remainingFiles > 0 && remainingDirs === 0) {
            // This folder has only non-media files - mark for user decision
            const stats = await fs.stat(fullPath);
            const totalSize = remainingFilesList.reduce((sum, file) => sum + file.size, 0);
            
            emptyDirs.push({
              path: fullPath,
              name: subdir.name,
              lastModified: stats.mtime.toISOString(),
              hasNonMediaFiles: true,
              nonMediaFiles: remainingFilesList,
              requiresUserDecision: true,
              size: totalSize // Size of non-media files
            });
            
            this.emitLog(`Folder contains only non-media files: ${subdir.name} (${remainingFilesList.length} files, ${this.formatFileSize(totalSize)})`);
            
            // Emit progress update for folders with non-media files
            if (progressCallback) {
              progressCallback(emptyDirs.length, `${subdir.name} (contains non-media files)`);
            }
          }
        } catch (error) {
          this.emitLog(`Error analyzing directory ${fullPath}: ${error.message}`);
        }
      }
    } catch (error) {
      this.emitLog(`Error scanning directory ${dir}: ${error.message}`);
    }
    
    return emptyDirs;
  }

  // Main cleanup execution function
  async executeCleanup(scanData, config, isDryRun = false) {
    this.shouldAbort = false;
    this.isRunning = true;
    this.clearLogs(); // Clear previous logs
    
    const { photoFiles, shortVideos, longVideos, emptyFolders } = scanData;
    
    // Track progress
    let totalProcessed = 0;
    const totalToProcess = photoFiles.length + shortVideos.length + longVideos.length + emptyFolders.length;
    
    this.emitStageStatus('running', {
      ProcessedVideos: 0,
      TotalVideos: totalToProcess,
      photosToDelete: photoFiles.length,
      videosToDelete: shortVideos.length,
      foldersToDelete: emptyFolders.length,
      videosToMove: longVideos.length
    }, isDryRun);
    
    const actionText = isDryRun ? 'Simulating cleanup operations (DRY RUN)...' : 'Starting cleanup operations...';
    this.emitLog(actionText);
    
    // Create video move target directory
    if (config.moveVideos && longVideos.length > 0) {
      const operationText = isDryRun ? 'Simulating directory creation' : 'Creating video move target directory';
      this.emitLog(`${operationText}...`);
      
      try {
        await fs.access(config.videoMoveTarget);
      } catch (error) {
        if (isDryRun) {
          this.emitLog(`[DRY RUN] Would create video target directory '${config.videoMoveTarget}' for storing moved videos`);
        } else {
          await fs.mkdir(config.videoMoveTarget, { recursive: true });
          this.emitLog(`Created directory: ${config.videoMoveTarget}`);
        }
      }
    }
    
    // Delete photos
    if (photoFiles.length > 0) {
      const photoOperationText = isDryRun ? 'Simulating photo deletion' : 'Moving photos to trash';
      this.emitLog(`${photoOperationText}...`);
      
      for (let i = 0; i < photoFiles.length; i++) {
        if (this.shouldAbort) break;
        const photo = photoFiles[i];
        
        await this.removeFileWithChoice(photo.path, 'photo', isDryRun);
        
        // Update progress
        totalProcessed++;
        if (i % 10 === 0 || i === photoFiles.length - 1) {
          this.emitStageStatus('running', {
            ProcessedVideos: totalProcessed,
            TotalVideos: totalToProcess,
            photosToDelete: photoFiles.length,
            videosToDelete: shortVideos.length,
            foldersToDelete: emptyFolders.length,
            videosToMove: longVideos.length
          }, isDryRun);
        }
      }
    }
    
    // Delete short videos
    if (shortVideos.length > 0) {
      const shortVideoOperationText = isDryRun ? 'Simulating short video deletion' : 'Moving short videos to trash';
      this.emitLog(`${shortVideoOperationText}...`);
      
      for (const video of shortVideos) {
        if (this.shouldAbort) break;
        
        await this.removeFileWithChoice(video.path, 'short video', isDryRun);
        
        // Update progress
        totalProcessed++;
        this.emitStageStatus('running', {
          ProcessedVideos: totalProcessed,
          TotalVideos: totalToProcess,
          photosToDelete: photoFiles.length,
          videosToDelete: shortVideos.length,
          foldersToDelete: emptyFolders.length,
          videosToMove: longVideos.length
        }, isDryRun);
      }
    }
    
    // Move long videos
    if (config.moveVideos && longVideos.length > 0) {
      const moveOperationText = isDryRun ? 'Simulating video moves' : 'Moving videos';
      this.emitLog(`${moveOperationText}...`);
      
      for (const video of longVideos) {
        if (this.shouldAbort) break;
        
        const fileName = path.basename(video.path);
        let dest = path.join(config.videoMoveTarget, fileName);
        
        // Handle duplicate names
        let counter = 1;
        while (true) {
          try {
            await fs.access(dest);
            const nameWithoutExt = path.parse(fileName).name;
            const extension = path.parse(fileName).ext;
            dest = path.join(config.videoMoveTarget, `${nameWithoutExt}(${counter})${extension}`);
            counter++;
          } catch (error) {
            break; // File doesn't exist, we can use this name
          }
        }
        
        if (isDryRun) {
          const videoSize = this.formatFileSize(video.size);
          const duration = await this.getVideoDuration(video.path);
          const durationText = duration ? `${duration} seconds` : 'unknown duration';
          const targetFileName = path.basename(dest);
          
          this.emitLog(`[DRY RUN] Would move video '${fileName}' (${videoSize}, ${durationText}) to '${targetFileName}'`);
        } else {
          try {
            await fs.rename(video.path, dest);
            this.emitLog(`Moved video: ${fileName} -> ${path.basename(dest)}`);
            this.addOperationLog('move', video.path, dest, video.size);
          } catch (error) {
            this.emitLog(`Failed to move video ${fileName}: ${error.message}`);
          }
        }
        
        // Update progress
        totalProcessed++;
        this.emitStageStatus('running', {
          ProcessedVideos: totalProcessed,
          TotalVideos: totalToProcess,
          photosToDelete: photoFiles.length,
          videosToDelete: shortVideos.length,
          foldersToDelete: emptyFolders.length,
          videosToMove: longVideos.length
        }, isDryRun);
      }
    } else {
      this.emitLog('Video moving disabled or no videos to move');
    }
    
    // Delete empty folders
    if (config.deleteEmptyFolders && emptyFolders.length > 0) {
      const folderOperationText = isDryRun ? 'Simulating empty folder deletion' : 'Moving empty folders to trash';
      this.emitLog(`${folderOperationText}...`);
      
      for (const folder of emptyFolders) {
        if (this.shouldAbort) break;
        
        await this.removeFileWithChoice(folder.path, 'empty folder', isDryRun);
        
        // Update progress
        totalProcessed++;
        this.emitStageStatus('running', {
          ProcessedVideos: totalProcessed,
          TotalVideos: totalToProcess,
          photosToDelete: photoFiles.length,
          videosToDelete: shortVideos.length,
          foldersToDelete: emptyFolders.length,
          videosToMove: longVideos.length
        }, isDryRun);
      }
    } else {
      this.emitLog('Empty folder deletion disabled or no empty folders found');
    }
    
    this.isRunning = false;
    
    const completionText = isDryRun ? 'Dry run completed successfully! No files were modified.' : 'Cleanup completed successfully!';
    this.emitLog(completionText);
    
    // Save operation log for revert functionality (only if not dry run)
    if (!isDryRun && this.operationLog.operations.length > 0) {
      const logDir = path.join(__dirname, '..', '.data', 'operation_logs');
      await fs.mkdir(logDir, { recursive: true });
      const logPath = path.join(logDir, `operation_log_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      await this.saveOperationLog(logPath);
      this.emitLog(`Operation log contains ${this.operationLog.operations.length} operations`);
    }
    
    this.emitStageStatus('done', {}, isDryRun);
  }

  // Revert operation from log file
  async revertOperation(logPath) {
    this.shouldAbort = false;
    this.isRunning = true;
    this.clearLogs();
    
    this.emitStageStatus('running', {}, false);
    this.emitLog(`Starting revert operation from: ${path.basename(logPath)}`);
    
    try {
      // Load operation log
      const content = await fs.readFile(logPath, 'utf8');
      const operationLog = JSON.parse(content);
      
      if (!operationLog.operations || operationLog.operations.length === 0) {
        this.emitLog('No operations found in log file');
        this.emitStageStatus('done');
        this.isRunning = false;
        return;
      }
      
      this.emitLog(`Found ${operationLog.operations.length} operations to revert`);
      
      // Reverse the operations (last operation first)
      const reversedOps = operationLog.operations.reverse();
      
      for (const operation of reversedOps) {
        if (this.shouldAbort) break;
        
        try {
          if (operation.type === 'trash') {
            this.emitLog(`Note: Cannot restore from trash: ${path.basename(operation.source)}`);
            this.emitLog(`Original location was: ${operation.source}`);
          } else if (operation.type === 'move') {
            // Move file back to original location
            this.emitLog(`Reverting move: ${path.basename(operation.destination)} -> ${path.basename(operation.source)}`);
            
            // Ensure source directory exists
            const sourceDir = path.dirname(operation.source);
            await fs.mkdir(sourceDir, { recursive: true });
            
            // Move file back
            await fs.rename(operation.destination, operation.source);
            this.emitLog(`Restored: ${path.basename(operation.source)}`);
          }
        } catch (error) {
          this.emitLog(`Failed to revert operation for ${path.basename(operation.source)}: ${error.message}`);
        }
      }
      
      this.emitLog('Revert operation completed');
      this.emitStageStatus('done');
      
    } catch (error) {
      this.emitLog(`Error during revert operation: ${error.message}`);
      this.emitStageStatus('aborted');
    } finally {
      this.isRunning = false;
    }
  }

  // Abort current operation
  abort() {
    console.log('FileOperationsService: Aborting operation...');
    this.shouldAbort = true;
    this.isRunning = false;
    this.currentStage = 'idle'; // Reset stage to idle
    this.emitLog('Operation aborted by user');
    this.emitStageStatus('aborted');
    
    // Clear any timeout handlers to stop emissions
    setTimeout(() => {
      this.currentStage = 'idle';
      console.log('FileOperationsService: Operation state reset to idle');
    }, 1000);
  }

  // Check if operation is currently running
  getIsRunning() {
    return this.isRunning;
  }
}

module.exports = FileOperationsService;
