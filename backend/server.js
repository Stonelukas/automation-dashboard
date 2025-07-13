require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const cors = require('cors');
const FileOperationsService = require('./fileOperations');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST']
  }
});

// File operations service
let fileOpsService = null;

// Middleware
app.use(express.json());

// Configure CORS for API routes
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

app.use(express.static(path.join(__dirname, '../frontend/build')));

// Default port
const PORT = process.env.PORT || 8080;

// Environment logging
console.log('Environment:', process.env.NODE_ENV || 'development');

// Define hidden directories
const DATA_DIR = path.join(__dirname, '..', '.data');
const SCAN_RESULTS_DIR = path.join(DATA_DIR, 'scan_results');
const OPERATION_LOGS_DIR = path.join(DATA_DIR, 'operation_logs');

// Create hidden directories if they don't exist
function ensureHiddenDirectories() {
  try {
    [DATA_DIR, SCAN_RESULTS_DIR, OPERATION_LOGS_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  } catch (error) {
    console.error('Error creating hidden directories:', error);
  }
}

// Initialize hidden directories
ensureHiddenDirectories();

// Function to get scan results from hidden directory
function getScanResults() {
  try {
    const files = fs.readdirSync(SCAN_RESULTS_DIR);
    const scanResults = files
      .filter(file => file.startsWith('scan_results_') && file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(SCAN_RESULTS_DIR, file);
        const stats = fs.statSync(filePath);
        
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const jsonData = JSON.parse(content);
          
          return {
            fileName: file,
            filePath: filePath,
            modifiedTime: stats.mtime,
            size: stats.size,
            ...jsonData
          };
        } catch (parseError) {
          console.error(`Error parsing scan result file ${file}:`, parseError);
          return {
            fileName: file,
            filePath: filePath,
            modifiedTime: stats.mtime,
            size: stats.size,
            summary: {
              photos: 0,
              longVideos: 0,
              shortVideos: 0,
              emptyFolders: 0
            },
            totalFiles: 0,
            startFolder: 'Unknown',
            timestamp: new Date(stats.mtime).toISOString()
          };
        }
      })
      .sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
    
    return scanResults;
  } catch (error) {
    console.error('Error reading scan results directory:', error);
    return [];
  }
}

// Function to get operation logs from hidden directory
function getOperationLogs() {
  try {
    const files = fs.readdirSync(OPERATION_LOGS_DIR);
    const operationLogs = files
      .filter(file => file.startsWith('operation_log_') && file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(OPERATION_LOGS_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          fileName: file,
          filePath: filePath,
          modifiedTime: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
    
    return operationLogs;
  } catch (error) {
    console.error('Error reading operation logs directory:', error);
    return [];
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Initialize file operations service for this socket
  fileOpsService = new FileOperationsService(io);

  // Send initial data when client connects
  socket.emit('scanResults', getScanResults());
  socket.emit('operationLogs', getOperationLogs());

  // Handle start scan only
  socket.on('startScanOnly', async (params) => {
    console.log('Start Scan Only with params:', params);
    
    if (fileOpsService.getIsRunning()) {
      socket.emit('error', { message: 'Another operation is already running' });
      return;
    }

    try {
      const config = {
        startFolder: params.StartFolder,
        minVideoLengthSec: parseInt(params.MinVideoLengthSec) || 30,
        photoExtensions: params.PhotoExtensions || 'jpg,jpeg,png,gif,bmp,tiff',
        videoExtensions: params.VideoExtensions || 'mp4,avi,mov,wmv,flv,mkv,webm',
        deleteEmptyFolders: true,
        moveVideos: true,
        ignoreFolders: params.IgnoreFolders || [],
        videoMoveTarget: path.join(params.StartFolder, 'SortedVideos')
      };

      const scanResults = await fileOpsService.performScan(config);
      
      if (scanResults && !fileOpsService.shouldAbort) {
        // Save scan results
        const scanResultsPath = path.join(SCAN_RESULTS_DIR, `scan_results_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        await fileOpsService.saveScanResults(scanResultsPath, scanResults.photoFiles, scanResults.shortVideos, scanResults.longVideos, scanResults.emptyFolders, config);
        
        // Send status with counts
        fileOpsService.emitStageStatus('done', {
          PhotosToDelete: scanResults.photoFiles.length,
          VideosToDelete: scanResults.shortVideos.length,
          FoldersToDelete: scanResults.emptyFolders.length,
          VideosToMove: scanResults.longVideos.length
        }, false);
        
        // Refresh scan results list
        setTimeout(() => {
          socket.emit('scanResults', getScanResults());
        }, 1000);
      }
    } catch (error) {
      fileOpsService.emitLog(`Error during scan: ${error.message}`);
      fileOpsService.emitStageStatus('aborted');
    }
  });

  // Handle start cleanup
  socket.on('startCleanup', async (params) => {
    console.log('Start Cleanup with params:', params);
    
    if (fileOpsService.getIsRunning()) {
      socket.emit('error', { message: 'Another operation is already running' });
      return;
    }

    try {
      const config = {
        startFolder: params.StartFolder,
        minVideoLengthSec: parseInt(params.MinVideoLengthSec) || 30,
        photoExtensions: params.PhotoExtensions || 'jpg,jpeg,png,gif,bmp,tiff',
        videoExtensions: params.VideoExtensions || 'mp4,avi,mov,wmv,flv,mkv,webm',
        deleteEmptyFolders: true,
        moveVideos: true,
        ignoreFolders: params.IgnoreFolders || [],
        videoMoveTarget: path.join(params.StartFolder, 'SortedVideos')
      };

      // First perform scan
      fileOpsService.emitStageStatus('scanning');
      const scanResults = await fileOpsService.performScan(config);
      
      if (!scanResults || fileOpsService.shouldAbort) {
        return;
      }

      // Send status with counts and wait for confirmation
      fileOpsService.emitStageStatus('waiting', {
        PhotosToDelete: scanResults.photoFiles.length,
        VideosToDelete: scanResults.shortVideos.length,
        FoldersToDelete: scanResults.emptyFolders.length,
        VideosToMove: scanResults.longVideos.length
      }, params.DryRun || false);

      // Store scan results for confirmation
      socket.pendingScanResults = scanResults;
      socket.pendingConfig = config;
      socket.pendingDryRun = params.DryRun || false;

    } catch (error) {
      fileOpsService.emitLog(`Error during cleanup preparation: ${error.message}`);
      fileOpsService.emitStageStatus('aborted');
    }
  });

  // Handle load scan results
  socket.on('loadScanResults', async (params) => {
    console.log('Load Scan Results with params:', params);
    
    if (fileOpsService.getIsRunning()) {
      socket.emit('error', { message: 'Another operation is already running' });
      return;
    }

    try {
      const { scanResultsPath, DryRun } = params;
      
      // Load scan results
      const loadedScan = await fileOpsService.loadScanResults(scanResultsPath);
      if (!loadedScan) {
        fileOpsService.emitStageStatus('aborted');
        return;
      }

      // Verify files still exist
      const verifiedData = await fileOpsService.verifyLoadedFiles(loadedScan.scanResults);
      
      // Send status with verified counts
      fileOpsService.emitStageStatus('waiting', {
        PhotosToDelete: verifiedData.photoFiles.length,
        VideosToDelete: verifiedData.shortVideos.length,
        FoldersToDelete: verifiedData.emptyFolders.length,
        VideosToMove: verifiedData.longVideos.length
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
      fileOpsService.emitLog(`Error loading scan results: ${error.message}`);
      fileOpsService.emitStageStatus('aborted');
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
      await fileOpsService.executeCleanup(
        socket.pendingScanResults,
        socket.pendingConfig,
        socket.pendingDryRun
      );

      // Refresh logs and scan results
      setTimeout(() => {
        socket.emit('scanResults', getScanResults());
        socket.emit('operationLogs', getOperationLogs());
      }, 1000);

    } catch (error) {
      fileOpsService.emitLog(`Error during cleanup execution: ${error.message}`);
      fileOpsService.emitStageStatus('aborted');
    } finally {
      // Clear pending data
      delete socket.pendingScanResults;
      delete socket.pendingConfig;
      delete socket.pendingDryRun;
    }
  });

  // Handle cancel action
  socket.on('cancel', () => {
    console.log('Cancel action received');
    
    if (fileOpsService) {
      fileOpsService.abort();
    }
    
    // Clear pending data
    delete socket.pendingScanResults;
    delete socket.pendingConfig;
    delete socket.pendingDryRun;
  });

  // Handle abort operation
  socket.on('abortOperation', () => {
    console.log('Abort operation received');
    
    if (fileOpsService) {
      fileOpsService.abort();
    }
    
    // Clear pending data
    delete socket.pendingScanResults;
    delete socket.pendingConfig;
    delete socket.pendingDryRun;
  });

  // Handle browse folders
  socket.on('browseFolders', (data) => {
    console.log('Browse folders requested:', data);
    
    try {
      const { path: folderPath } = data;
      const resolvedPath = path.resolve(folderPath || '.');
      
      // Check if path exists and is a directory
      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
        const items = fs.readdirSync(resolvedPath).map(item => {
          const itemPath = path.join(resolvedPath, item);
          try {
            const stats = fs.statSync(itemPath);
            return {
              name: item,
              path: itemPath,
              isDirectory: stats.isDirectory()
            };
          } catch (err) {
            // Skip items that can't be accessed
            return null;
          }
        }).filter(item => item !== null);
        
        // Separate folders and files
        const folders = items.filter(item => item.isDirectory);
        const files = items.filter(item => !item.isDirectory);
        
        socket.emit('folderContents', {
          currentPath: resolvedPath,
          folders: folders,
          files: files
        });
      } else {
        socket.emit('folderContents', {
          currentPath: resolvedPath,
          folders: [],
          files: [],
          error: 'Path does not exist or is not a directory'
        });
      }
    } catch (error) {
      console.error('Error browsing folders:', error);
      socket.emit('folderContents', {
        currentPath: folderPath || '',
        folders: [],
        files: [],
        error: error.message
      });
    }
  });

  // Handle create folder
  socket.on('createFolder', (data) => {
    console.log('Create folder requested:', data);
    
    try {
      const { path: folderPath } = data;
      const resolvedPath = path.resolve(folderPath);
      
      // Create directory recursively
      fs.mkdirSync(resolvedPath, { recursive: true });
      
      socket.emit('folderCreated', {
        path: resolvedPath,
        success: true
      });
    } catch (error) {
      console.error('Error creating folder:', error);
      socket.emit('folderCreated', {
        path: folderPath,
        success: false,
        error: error.message
      });
    }
  });

  // Handle get log files
  socket.on('getLogFiles', () => {
    console.log('Get log files requested');
    
    try {
      const logDir = path.join(__dirname, '..', '.data', 'operation_logs');
      
      if (!fs.existsSync(logDir)) {
        socket.emit('logFiles', { files: [] });
        return;
      }
      
      const files = fs.readdirSync(logDir)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(logDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            modified: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.modified) - new Date(a.modified));
      
      socket.emit('logFiles', { files });
    } catch (error) {
      console.error('Error getting log files:', error);
      socket.emit('logFiles', { 
        files: [], 
        error: error.message 
      });
    }
  });

  // Handle delete scan result
  socket.on('deleteScanResult', (data) => {
    console.log('Delete scan result requested:', data);
    
    try {
      // Handle both scanResultPath and path fields for backwards compatibility
      const scanResultPath = data.scanResultPath || data.path;
      
      if (!scanResultPath) {
        socket.emit('scanResultDeleted', {
          deletedPath: null,
          success: false,
          error: 'No scan result path provided'
        });
        return;
      }

      const fileName = path.basename(scanResultPath);
      const scanResultsDir = path.join(__dirname, '..', '.data', 'scan_results');
      const filePath = path.join(scanResultsDir, fileName);
      
      // Validate the file exists and is within the scan results directory
      if (fs.existsSync(filePath) && filePath.startsWith(scanResultsDir)) {
        fs.unlinkSync(filePath);
        
        // Get updated scan results
        const scanResults = getScanResults();
        socket.emit('scanResults', scanResults);
        
        socket.emit('scanResultDeleted', {
          deletedPath: scanResultPath,
          success: true
        });
      } else {
        socket.emit('scanResultDeleted', {
          deletedPath: scanResultPath,
          success: false,
          error: 'File not found or invalid path'
        });
      }
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
      const scanResults = getScanResults();
      socket.emit('scanResults', scanResults);
    } catch (error) {
      console.error('Error getting scan results:', error);
      socket.emit('scanResults', []);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Route for the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// File serving endpoint for preview functionality
app.get('/api/file', (req, res) => {
  try {
    const filePath = decodeURIComponent(req.query.path);
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required as query parameter' });
    }
    
    // Security: Basic path validation to prevent directory traversal
    if (filePath.includes('..') || filePath.includes('~')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check if it's actually a file (not a directory)
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }
    
    // Get file extension to set appropriate content type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.mkv': 'video/x-matroska',
      '.webm': 'video/webm'
    };
    
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });
    
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// System file opening endpoint
app.post('/api/open-file', (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    // Security: Basic path validation
    if (filePath.includes('..') || filePath.includes('~')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Use different commands based on OS
    let command;
    
    if (process.platform === 'win32') {
      command = `start "" "${filePath}"`; // Windows
    } else if (process.platform === 'darwin') {
      command = `open "${filePath}"`; // macOS
    } else {
      command = `xdg-open "${filePath}"`; // Linux
    }
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error opening file:', error);
        return res.status(500).json({ error: 'Failed to open file' });
      }
      res.json({ success: true, message: 'File opened successfully' });
    });
    
  } catch (error) {
    console.error('Error in open-file endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  
  // Abort any running file operations
  if (fileOpsService) {
    fileOpsService.abort();
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  
  // Abort any running file operations
  if (fileOpsService) {
    fileOpsService.abort();
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
