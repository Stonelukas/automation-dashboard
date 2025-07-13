const fs = require('fs');
const path = require('path');

class FileBrowserService {
  // Handle browse folders
  browseFolders(folderPath) {
    try {
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
        
        return {
          success: true,
          data: {
            currentPath: resolvedPath,
            folders: folders,
            files: files
          }
        };
      } else {
        return {
          success: false,
          data: {
            currentPath: resolvedPath,
            folders: [],
            files: [],
            error: 'Path does not exist or is not a directory'
          }
        };
      }
    } catch (error) {
      console.error('Error browsing folders:', error);
      return {
        success: false,
        data: {
          currentPath: folderPath || '',
          folders: [],
          files: [],
          error: error.message
        }
      };
    }
  }

  // Handle create folder
  createFolder(folderPath) {
    try {
      const resolvedPath = path.resolve(folderPath);
      
      // Create directory recursively
      fs.mkdirSync(resolvedPath, { recursive: true });
      
      return {
        success: true,
        path: resolvedPath
      };
    } catch (error) {
      console.error('Error creating folder:', error);
      return {
        success: false,
        path: folderPath,
        error: error.message
      };
    }
  }

  // Get log files
  getLogFiles() {
    try {
      const logDir = path.join(__dirname, '..', '..', '.data', 'operation_logs');
      
      if (!fs.existsSync(logDir)) {
        return { success: true, files: [] };
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
      
      return { success: true, files };
    } catch (error) {
      console.error('Error getting log files:', error);
      return { 
        success: false,
        files: [], 
        error: error.message 
      };
    }
  }
}

module.exports = FileBrowserService;
