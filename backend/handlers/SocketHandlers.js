const DataService = require('../services/DataService');
const FileBrowserService = require('../services/FileBrowserService');

class SocketHandlers {
  constructor(io, fileOpsService) {
    this.io = io;
    this.fileOpsService = fileOpsService;
    this.dataService = new DataService();
    this.fileBrowserService = new FileBrowserService();
    
    // Global variables for debouncing scan results emissions
    this.scanResultsEmitTimeout = null;
    this.lastScanResultsData = null;
  }

  // Debounced emit function for scan results to prevent duplicates
  emitScanResults(socket) {
    // Clear any existing timeout
    if (this.scanResultsEmitTimeout) {
      clearTimeout(this.scanResultsEmitTimeout);
    }
    
    // Set new timeout to emit scan results
    this.scanResultsEmitTimeout = setTimeout(() => {
      const scanResults = this.dataService.getScanResults();
      const dataString = JSON.stringify(scanResults);
      
      // Only emit if data has actually changed
      if (dataString !== this.lastScanResultsData) {
        socket.emit('scanResults', scanResults);
        this.lastScanResultsData = dataString;
        console.log(`Emitted scan results: ${scanResults.length} entries`);
      }
      
      this.scanResultsEmitTimeout = null;
    }, 500); // 500ms delay to debounce multiple calls
  }

  // Initialize connection handlers
  setupConnectionHandlers(socket) {
    console.log('Client connected:', socket.id);

    // Send initial data when client connects
    this.emitScanResults(socket);
    socket.emit('operationLogs', this.dataService.getOperationLogs());

    // Setup all event handlers
    this.setupScanHandlers(socket);
    this.setupCleanupHandlers(socket);
    this.setupFileHandlers(socket);
    this.setupBrowserHandlers(socket);
    this.setupLogHandlers(socket);
    this.setupDisconnectHandler(socket);
  }

  setupScanHandlers(socket) {
    // Handle start scan only
    socket.on('startScanOnly', async (params) => {
      console.log('Start Scan Only with params:', params);
      
      if (this.fileOpsService.getIsRunning()) {
        socket.emit('error', { message: 'Another operation is already running' });
        return;
      }

      try {
        const config = this.buildConfig(params);
        const scanResults = await this.fileOpsService.performScan(config);
        
        if (scanResults && !this.fileOpsService.shouldAbort) {
          this.fileOpsService.emitStageStatus('done', {
            PhotosToDelete: scanResults.photoFiles.length,
            VideosToDelete: scanResults.shortVideos.length,
            FoldersToDelete: scanResults.emptyFolders.length,
            VideosToMove: scanResults.longVideos.length,
            fileLists: {
              photoFiles: scanResults.photoFiles,
              shortVideos: scanResults.shortVideos,
              longVideos: scanResults.longVideos,
              emptyFolders: scanResults.emptyFolders
            }
          }, false);
          
          // Refresh scan results list
          setTimeout(() => {
            this.emitScanResults(socket);
          }, 1000);
        }
      } catch (error) {
        this.fileOpsService.emitLog(`Error during scan: ${error.message}`);
        this.fileOpsService.emitStageStatus('aborted');
      }
    });

    // Handle load scan results
    socket.on('loadScanResults', async (params) => {
      console.log('Load Scan Results with params:', params);
      
      if (this.fileOpsService.getIsRunning()) {
        socket.emit('error', { message: 'Another operation is already running' });
        return;
      }

      try {
        const { scanResultsPath, DryRun } = params;
        
        // Load scan results
        const loadedScan = await this.fileOpsService.loadScanResults(scanResultsPath);
        if (!loadedScan) {
          this.fileOpsService.emitStageStatus('aborted');
          return;
        }

        // Verify files still exist
        const verifiedData = await this.fileOpsService.verifyLoadedFiles(loadedScan.scanResults);
        
        console.log('Server: Verified data counts:', {
          photos: verifiedData.photoFiles.length,
          shortVideos: verifiedData.shortVideos.length,
          longVideos: verifiedData.longVideos.length,
          emptyFolders: verifiedData.emptyFolders.length
        });
        
        // Send status with verified counts
        this.fileOpsService.emitStageStatus('waiting', {
          PhotosToDelete: verifiedData.photoFiles.length,
          VideosToDelete: verifiedData.shortVideos.length,
          FoldersToDelete: verifiedData.emptyFolders.length,
          VideosToMove: verifiedData.longVideos.length,
          fileLists: {
            photoFiles: verifiedData.photoFiles,
            shortVideos: verifiedData.shortVideos,
            longVideos: verifiedData.longVideos,
            emptyFolders: verifiedData.emptyFolders
          }
        }, DryRun || false);

        // Store verified results for confirmation
        socket.pendingScanResults = verifiedData;
        socket.pendingConfig = {
          ...loadedScan.configuration,
          startFolder: loadedScan.startFolder,
          videoMoveTarget: loadedScan.videoMoveTarget
        };
        socket.pendingDryRun = DryRun || false;

      } catch (error) {
        this.fileOpsService.emitLog(`Error loading scan results: ${error.message}`);
        this.fileOpsService.emitStageStatus('aborted');
      }
    });
  }

  setupCleanupHandlers(socket) {
    // Handle start cleanup
    socket.on('startCleanup', async (params) => {
      console.log('Start Cleanup with params:', params);
      
      if (this.fileOpsService.getIsRunning()) {
        socket.emit('error', { message: 'Another operation is already running' });
        return;
      }

      try {
        // Check if this is a revert operation
        if (params.RevertLogPath) {
          console.log('Starting revert operation with log path:', params.RevertLogPath);
          await this.fileOpsService.revertOperation(params.RevertLogPath);
          
          // Refresh logs and scan results after revert
          setTimeout(() => {
            socket.emit('operationLogs', this.dataService.getOperationLogs());
          }, 1000);
          
          return;
        }

        const config = this.buildConfig(params);

        // First perform scan
        this.fileOpsService.emitStageStatus('scanning');
        const scanResults = await this.fileOpsService.performScan(config);
        
        if (!scanResults || this.fileOpsService.shouldAbort) {
          return;
        }

        // Send status with counts and wait for confirmation
        this.fileOpsService.emitStageStatus('waiting', {
          PhotosToDelete: scanResults.photoFiles.length,
          VideosToDelete: scanResults.shortVideos.length,
          FoldersToDelete: scanResults.emptyFolders.length,
          VideosToMove: scanResults.longVideos.length,
          fileLists: {
            photoFiles: scanResults.photoFiles,
            shortVideos: scanResults.shortVideos,
            longVideos: scanResults.longVideos,
            emptyFolders: scanResults.emptyFolders
          }
        }, params.DryRun || false);

        // Store scan results for confirmation
        socket.pendingScanResults = scanResults;
        socket.pendingConfig = config;
        socket.pendingDryRun = params.DryRun || false;

      } catch (error) {
        this.fileOpsService.emitLog(`Error during cleanup preparation: ${error.message}`);
        this.fileOpsService.emitStageStatus('aborted');
      }
    });

    // Handle confirm action
    socket.on('confirm', async () => {
      console.log('Confirm action received');
      
      if (!socket.pendingScanResults || !socket.pendingConfig) {
        socket.emit('error', { message: 'No pending operation to confirm' });
        return;
      }

      try {
        await this.fileOpsService.executeCleanup(
          socket.pendingScanResults,
          socket.pendingConfig,
          socket.pendingDryRun
        );

        // Refresh logs and scan results
        setTimeout(() => {
          this.emitScanResults(socket);
          socket.emit('operationLogs', this.dataService.getOperationLogs());
        }, 1000);

      } catch (error) {
        this.fileOpsService.emitLog(`Error during cleanup execution: ${error.message}`);
        this.fileOpsService.emitStageStatus('aborted');
      } finally {
        // Clear pending data
        this.clearPendingData(socket);
      }
    });

    // Handle cancel action
    socket.on('cancel', () => {
      console.log('Cancel action received');
      
      if (this.fileOpsService && this.fileOpsService.getIsRunning()) {
        this.fileOpsService.abort();
        console.log('Operation cancelled by user request');
      } else {
        console.log('No operation running to cancel');
      }
      
      this.clearPendingData(socket);
    });

    // Handle abort operation
    socket.on('abortOperation', () => {
      console.log('Abort operation received');
      
      if (this.fileOpsService) {
        this.fileOpsService.abort();
      }
      
      this.clearPendingData(socket);
    });
  }

  setupFileHandlers(socket) {
    // Handle delete scan result
    socket.on('deleteScanResult', (data) => {
      console.log('Delete scan result requested:', data);
      
      try {
        const scanResultPath = data.scanResultPath || data.path;
        
        if (!scanResultPath) {
          socket.emit('scanResultDeleted', {
            deletedPath: null,
            success: false,
            error: 'No scan result path provided'
          });
          return;
        }

        const result = this.dataService.deleteScanResult(scanResultPath);
        
        if (result.success) {
          // Get updated scan results
          const scanResults = this.dataService.getScanResults();
          socket.emit('scanResults', scanResults);
        }
        
        socket.emit('scanResultDeleted', {
          deletedPath: scanResultPath,
          ...result
        });
      } catch (error) {
        console.error('Error deleting scan result:', error);
        socket.emit('scanResultDeleted', {
          deletedPath: data.scanResultPath || data.path || 'unknown',
          success: false,
          error: error.message
        });
      }
    });

    // Handle get scan results
    socket.on('getScanResults', () => {
      console.log('Get scan results requested');
      
      try {
        const scanResults = this.dataService.getScanResults();
        socket.emit('scanResults', scanResults);
      } catch (error) {
        console.error('Error getting scan results:', error);
        socket.emit('scanResults', []);
      }
    });
  }

  setupBrowserHandlers(socket) {
    // Handle browse folders
    socket.on('browseFolders', (data) => {
      console.log('Browse folders requested:', data);
      
      const result = this.fileBrowserService.browseFolders(data.path);
      socket.emit('folderContents', result.data);
    });

    // Handle create folder
    socket.on('createFolder', (data) => {
      console.log('Create folder requested:', data);
      
      const result = this.fileBrowserService.createFolder(data.path);
      socket.emit('folderCreated', result);
    });
  }

  setupLogHandlers(socket) {
    // Handle get log files
    socket.on('getLogFiles', () => {
      console.log('Get log files requested');
      
      const result = this.fileBrowserService.getLogFiles();
      socket.emit('logFiles', result);
    });
  }

  setupDisconnectHandler(socket) {
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  }

  // Helper methods
  buildConfig(params) {
    const path = require('path');
    return {
      startFolder: params.StartFolder,
      minVideoLengthSec: parseInt(params.MinVideoLengthSec) || 30,
      photoExtensions: params.PhotoExtensions || 'jpg,jpeg,png,gif,bmp,tiff',
      videoExtensions: params.VideoExtensions || 'mp4,avi,mov,wmv,flv,mkv,webm',
      deleteEmptyFolders: params.DeleteEmptyFolders !== undefined ? params.DeleteEmptyFolders : true,
      moveVideos: params.MoveVideos !== undefined ? params.MoveVideos : true,
      ignoreFolders: params.IgnoreFolders || [],
      videoMoveTarget: params.VideoMoveTarget || path.join(params.StartFolder, 'SortedVideos')
    };
  }

  clearPendingData(socket) {
    delete socket.pendingScanResults;
    delete socket.pendingConfig;
    delete socket.pendingDryRun;
  }
}

module.exports = SocketHandlers;
