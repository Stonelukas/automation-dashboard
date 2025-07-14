const fs = require('fs');
const path = require('path');
const os = require('os');

class FileBrowserService {
  // Get Windows drives and default folders
  getWindowsDrivesAndDefaults() {
    try {
      const drives = [];
      const defaultFolders = [];
      
      // Get Windows drives (A: through Z:)
      for (let i = 65; i <= 90; i++) {
        const driveLetter = String.fromCharCode(i);
        const drivePath = `${driveLetter}:\\`;
        
        try {
          // Check if drive exists by trying to access it
          fs.accessSync(drivePath, fs.constants.F_OK);
          drives.push({
            name: `${driveLetter}: Drive`,
            path: drivePath,
            isDirectory: true,
            icon: '💾'
          });
        } catch (err) {
          // Drive doesn't exist, skip it
        }
      }
      
      // Get default user folders
      const userProfile = os.homedir();
      const defaultPaths = [
        { name: 'Desktop', path: path.join(userProfile, 'Desktop'), icon: '🖥️' },
        { name: 'Documents', path: path.join(userProfile, 'Documents'), icon: '📄' },
        { name: 'Downloads', path: path.join(userProfile, 'Downloads'), icon: '📥' },
        { name: 'Pictures', path: path.join(userProfile, 'Pictures'), icon: '🖼️' },
        { name: 'Videos', path: path.join(userProfile, 'Videos'), icon: '🎬' },
        { name: 'Music', path: path.join(userProfile, 'Music'), icon: '🎵' },
        { name: 'OneDrive', path: path.join(userProfile, 'OneDrive'), icon: '☁️' },
        { name: 'User Profile', path: userProfile, icon: '👤' }
      ];
      
      // Check which default folders exist
      defaultPaths.forEach(folder => {
        try {
          if (fs.existsSync(folder.path) && fs.statSync(folder.path).isDirectory()) {
            defaultFolders.push({
              name: folder.name,
              path: folder.path,
              isDirectory: true,
              icon: folder.icon
            });
          }
        } catch (err) {
          // Folder doesn't exist or can't be accessed, skip it
        }
      });
      
      return { drives, defaultFolders };
    } catch (error) {
      console.error('Error getting Windows drives and defaults:', error);
      return { drives: [], defaultFolders: [] };
    }
  }

  // Handle browse folders
  browseFolders(folderPath) {
    try {
      // If no path provided or empty, show drives and default folders
      if (!folderPath || folderPath.trim() === '') {
        const { drives, defaultFolders } = this.getWindowsDrivesAndDefaults();
        
        return {
          success: true,
          data: {
            currentPath: '',
            folders: [...drives, ...defaultFolders],
            files: [],
            isRootView: true
          }
        };
      }
      
      const resolvedPath = path.resolve(folderPath);
      
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
            files: files,
            isRootView: false
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
  createFolder(parentPath, folderName) {
    try {
      const resolvedParentPath = path.resolve(parentPath);
      const newFolderPath = path.join(resolvedParentPath, folderName);
      
      // Check if parent directory exists
      if (!fs.existsSync(resolvedParentPath)) {
        return {
          success: false,
          error: 'Parent directory does not exist'
        };
      }
      
      // Check if folder already exists
      if (fs.existsSync(newFolderPath)) {
        return {
          success: false,
          error: 'Folder already exists'
        };
      }
      
      // Create directory
      fs.mkdirSync(newFolderPath, { recursive: true });
      
      return {
        success: true,
        path: newFolderPath
      };
    } catch (error) {
      console.error('Error creating folder:', error);
      return {
        success: false,
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
