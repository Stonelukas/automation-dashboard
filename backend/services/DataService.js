const fs = require('fs');
const path = require('path');

class DataService {
  constructor() {
    this.DATA_DIR = path.join(__dirname, '..', '..', '.data');
    this.SCAN_RESULTS_DIR = path.join(this.DATA_DIR, 'scan_results');
    this.OPERATION_LOGS_DIR = path.join(this.DATA_DIR, 'operation_logs');
    
    this.ensureHiddenDirectories();
  }

  // Create hidden directories if they don't exist
  ensureHiddenDirectories() {
    try {
      [this.DATA_DIR, this.SCAN_RESULTS_DIR, this.OPERATION_LOGS_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });
    } catch (error) {
      console.error('Error creating hidden directories:', error);
    }
  }

  // Function to get scan results from hidden directory
  getScanResults() {
    try {
      const files = fs.readdirSync(this.SCAN_RESULTS_DIR);
      const scanResults = files
        .filter(file => file.startsWith('scan_results_') && file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(this.SCAN_RESULTS_DIR, file);
          const stats = fs.statSync(filePath);
          
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(content);
            
            // Transform the data structure to match frontend expectations
            const transformedData = {
              fileName: file,
              filePath: filePath,
              modifiedTime: stats.mtime,
              size: stats.size,
              startFolder: jsonData.startFolder,
              timestamp: jsonData.timestamp,
              videoMoveTarget: jsonData.videoMoveTarget,
              configuration: jsonData.configuration,
              // Create summary object from scanResults data
              summary: {
                totalPhotos: jsonData.scanResults?.totalPhotos || 0,
                totalShortVideos: jsonData.scanResults?.totalShortVideos || 0,
                totalLongVideos: jsonData.scanResults?.totalLongVideos || 0,
                totalEmptyFolders: jsonData.scanResults?.totalEmptyFolders || 0
              },
              totalFiles: (jsonData.scanResults?.totalPhotos || 0) + 
                         (jsonData.scanResults?.totalShortVideos || 0) + 
                         (jsonData.scanResults?.totalLongVideos || 0) + 
                         (jsonData.scanResults?.totalEmptyFolders || 0),
              // Keep the original scanResults for backwards compatibility
              scanResults: jsonData.scanResults
            };
            
            return transformedData;
          } catch (parseError) {
            console.error(`Error parsing scan result file ${file}:`, parseError);
            return {
              fileName: file,
              filePath: filePath,
              modifiedTime: stats.mtime,
              size: stats.size,
              summary: {
                totalPhotos: 0,
                totalLongVideos: 0,
                totalShortVideos: 0,
                totalEmptyFolders: 0
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
  getOperationLogs() {
    try {
      const files = fs.readdirSync(this.OPERATION_LOGS_DIR);
      const operationLogs = files
        .filter(file => file.startsWith('operation_log_') && file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(this.OPERATION_LOGS_DIR, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
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

  // Delete a scan result file
  deleteScanResult(scanResultPath) {
    try {
      const fileName = path.basename(scanResultPath);
      const filePath = path.join(this.SCAN_RESULTS_DIR, fileName);
      
      // Validate the file exists and is within the scan results directory
      if (fs.existsSync(filePath) && filePath.startsWith(this.SCAN_RESULTS_DIR)) {
        fs.unlinkSync(filePath);
        return { success: true };
      } else {
        return { success: false, error: 'File not found or invalid path' };
      }
    } catch (error) {
      console.error('Error deleting scan result:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = DataService;
