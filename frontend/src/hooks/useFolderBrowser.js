import { useState } from 'react';

/**
 * Custom hook for managing folder browser functionality
 * Extracts folder browser logic from the main App component
 */
export function useFolderBrowser() {
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [folderContents, setFolderContents] = useState({ 
    currentPath: '', 
    folders: [], 
    files: [] 
  });
  const [folderBrowserLoading, setFolderBrowserLoading] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Function to get parent directory path
  const getParentDirectory = (currentPath) => {
    if (!currentPath) return null;
    
    // Handle root directories (C:\, D:\, etc.)
    if (currentPath.match(/^[A-Za-z]:\\?$/)) {
      return null; // Already at root
    }
    
    // Handle UNC paths (\\server\share)
    if (currentPath.startsWith('\\\\')) {
      const parts = currentPath.split('\\').filter(p => p);
      if (parts.length <= 2) {
        return null; // At UNC root
      }
    }
    
    // For regular paths, get parent by going up one level
    const separator = currentPath.includes('\\') ? '\\' : '/';
    const parts = currentPath.split(separator).filter(p => p);
    
    if (parts.length <= 1) {
      return null; // At root
    }
    
    parts.pop(); // Remove last part
    
    if (currentPath.startsWith('\\\\')) {
      return '\\\\' + parts.join('\\');
    } else if (currentPath.includes('\\')) {
      return parts.join('\\') + '\\';
    } else {
      return '/' + parts.join('/');
    }
  };

  return {
    showFolderBrowser, setShowFolderBrowser,
    folderContents, setFolderContents,
    folderBrowserLoading, setFolderBrowserLoading,
    showCreateFolder, setShowCreateFolder,
    newFolderName, setNewFolderName,
    creatingFolder, setCreatingFolder,
    getParentDirectory,
  };
}
