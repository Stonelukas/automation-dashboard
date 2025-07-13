import { useEffect, useRef } from 'react';
import io from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:8080";

/**
 * Custom hook for managing Socket.IO connection and events
 * Extracts all socket-related logic from the main App component
 */
export function useSocket(appState, folderBrowser) {
  const {
    setSocket,
    setConnectionStatus,
    setStage,
    setDetailedStage,
    setLogs,
    setProgress,
    setErrors,
    setScanResults,
    setLogFiles,
    setShowFileChoiceDialog,
    setFileChoiceMessage,
    setFileLists,
    setDeletingScans,
    startFolder,
    videoMoveTarget,
    setVideoMoveTarget,
    setShowAutoUpdateNotification
  } = appState;

  const { setFolderContents } = folderBrowser;

  const autoUpdateTimeoutRef = useRef(null);

  // Auto-update video move target when start folder changes
  useEffect(() => {
    // Clear any existing timeout
    if (autoUpdateTimeoutRef.current) {
      clearTimeout(autoUpdateTimeoutRef.current);
    }

    if (startFolder && startFolder.trim() !== '' && startFolder !== '.') {
      // Create a sensible default for video move target
      let newVideoTarget;
      
      // Determine the appropriate path separator based on the start folder format
      const separator = startFolder.includes('\\') ? '\\' : '/';
      
      // Ensure proper path joining
      if (startFolder.endsWith(separator)) {
        newVideoTarget = startFolder + 'SortedVideos';
      } else {
        newVideoTarget = startFolder + separator + 'SortedVideos';
      }
      
      // Only update if it's actually different to avoid unnecessary updates
      if (newVideoTarget !== videoMoveTarget) {
        setVideoMoveTarget(newVideoTarget);
        if (setShowAutoUpdateNotification) {
          setShowAutoUpdateNotification(true);
          
          // Hide notification after 3 seconds
          autoUpdateTimeoutRef.current = setTimeout(() => {
            setShowAutoUpdateNotification(false);
          }, 3000);
        }
      }
    } else if (startFolder === '.' || startFolder === '') {
      // Reset to relative path for current directory
      const defaultTarget = './SortedVideos';
      if (defaultTarget !== videoMoveTarget) {
        setVideoMoveTarget(defaultTarget);
        if (setShowAutoUpdateNotification) {
          setShowAutoUpdateNotification(true);
          
          // Hide notification after 3 seconds
          autoUpdateTimeoutRef.current = setTimeout(() => {
            setShowAutoUpdateNotification(false);
          }, 3000);
        }
      }
    }

    // Cleanup function to clear timeout on unmount
    return () => {
      if (autoUpdateTimeoutRef.current) {
        clearTimeout(autoUpdateTimeoutRef.current);
      }
    };
  }, [startFolder, setVideoMoveTarget, videoMoveTarget, setShowAutoUpdateNotification]);

  // Initialize socket connection
  useEffect(() => {
    console.log('Connecting to Socket.IO server...');
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnectionStatus('connected');
      setSocket(newSocket);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnectionStatus('disconnected');
      setSocket(null);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionStatus('error');
      setErrors(prev => [...prev, `Connection error: ${error.message}`]);
    });

    // Status updates
    newSocket.on('status', (data) => {
      console.log('Status update:', data);
      if (data.stage) {
        setStage(data.stage);
        setDetailedStage(data.stage);
      }
      
      // Handle progress updates - support both nested and direct properties
      if (data.progress) {
        setProgress(prev => ({ ...prev, ...data.progress }));
        
        // Handle file lists if present
        if (data.progress.fileLists) {
          console.log('Frontend: Received fileLists in status:', {
            photoFiles: data.progress.fileLists.photoFiles?.length || 0,
            shortVideos: data.progress.fileLists.shortVideos?.length || 0,
            longVideos: data.progress.fileLists.longVideos?.length || 0,
            emptyFolders: data.progress.fileLists.emptyFolders?.length || 0
          });
          setFileLists(data.progress.fileLists);
        }
      }
      
      // Handle direct progress properties (for compatibility)
      const progressUpdate = {};
      if (data.PhotosToDelete !== undefined) progressUpdate.PhotosToDelete = data.PhotosToDelete;
      if (data.VideosToDelete !== undefined) progressUpdate.VideosToDelete = data.VideosToDelete;
      if (data.FoldersToDelete !== undefined) progressUpdate.FoldersToDelete = data.FoldersToDelete;
      if (data.VideosToMove !== undefined) progressUpdate.VideosToMove = data.VideosToMove;
      if (data.ProcessedVideos !== undefined) progressUpdate.ProcessedVideos = data.ProcessedVideos;
      if (data.TotalVideos !== undefined) progressUpdate.TotalVideos = data.TotalVideos;
      if (data.photosToDelete !== undefined) progressUpdate.PhotosToDelete = data.photosToDelete;
      if (data.videosToDelete !== undefined) progressUpdate.VideosToDelete = data.videosToDelete;
      if (data.foldersToDelete !== undefined) progressUpdate.FoldersToDelete = data.foldersToDelete;
      if (data.videosToMove !== undefined) progressUpdate.VideosToMove = data.videosToMove;
      if (data.processed !== undefined) progressUpdate.ProcessedVideos = data.processed;
      if (data.total !== undefined) progressUpdate.TotalVideos = data.total;
      
      // Handle fileLists if present at root level
      if (data.fileLists) {
        console.log('Frontend: Received fileLists in status (root level):', {
          photoFiles: data.fileLists.photoFiles?.length || 0,
          shortVideos: data.fileLists.shortVideos?.length || 0,
          longVideos: data.fileLists.longVideos?.length || 0,
          emptyFolders: data.fileLists.emptyFolders?.length || 0
        });
        setFileLists(data.fileLists);
      }
      
      if (Object.keys(progressUpdate).length > 0) {
        setProgress(prev => ({ ...prev, ...progressUpdate }));
      }
      
      if (data.logs) {
        setLogs(data.logs);
      }
    });

    // Progress updates
    newSocket.on('progress', (data) => {
      console.log('Progress update:', data);
      setProgress(prev => ({ ...prev, ...data }));
    });

    // Log updates
    newSocket.on('log', (data) => {
      console.log('Log update:', data);
      setLogs(prev => [...prev, data.message || data]);
    });

    // Scan results updates
    newSocket.on('scanResults', (data) => {
      console.log('Scan results update:', data.length, 'results');
      setScanResults(data);
    });

    // Operation logs updates
    newSocket.on('operationLogs', (data) => {
      console.log('Operation logs update:', data.length, 'logs');
      setLogFiles(data);
    });

    // File choice dialog
    newSocket.on('fileChoice', (data) => {
      console.log('File choice dialog:', data);
      setFileChoiceMessage(data.message || 'Choose file action');
      setShowFileChoiceDialog(true);
    });

    // Folder browser updates
    newSocket.on('folderContents', (data) => {
      console.log('Folder contents update:', data);
      setFolderContents(data);
    });

    // Scan result deletion updates
    newSocket.on('scanResultDeleted', (data) => {
      console.log('Scan result deleted:', data);
      if (data.success) {
        console.log('Successfully deleted scan result');
      } else {
        setErrors(prev => [...prev, `Failed to delete scan result: ${data.error}`]);
      }
      
      // Remove from deleting set regardless of success/failure
      if (data.deletedPath) {
        setDeletingScans(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.deletedPath);
          return newSet;
        });
      }
    });

    // Error handling
    newSocket.on('error', (data) => {
      console.error('Socket error:', data);
      setErrors(prev => [...prev, data.message || 'Unknown error']);
    });

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up socket connection...');
      newSocket.disconnect();
    };
  }, [
    setSocket, setConnectionStatus, setStage, setDetailedStage, setLogs, 
    setProgress, setErrors, setScanResults, setLogFiles, setShowFileChoiceDialog,
    setFileChoiceMessage, setFileLists, setDeletingScans, setFolderContents
  ]);

  // Socket action functions
  const socketActions = {
    startScanOnly: (params) => {
      if (appState.socket) {
        console.log('Sending startScanOnly with params:', params);
        appState.socket.emit('startScanOnly', params);
      }
    },

    startCleanup: (params) => {
      if (appState.socket) {
        console.log('Sending startCleanup with params:', params);
        appState.socket.emit('startCleanup', params);
      }
    },

    loadScanResults: (params) => {
      if (appState.socket) {
        console.log('Sending loadScanResults with params:', params);
        appState.socket.emit('loadScanResults', params);
      }
    },

    confirm: () => {
      if (appState.socket) {
        console.log('Sending confirm');
        appState.socket.emit('confirm');
      }
    },

    cancel: () => {
      if (appState.socket) {
        console.log('Sending cancel');
        appState.socket.emit('cancel');
      }
    },

    abortOperation: () => {
      if (appState.socket) {
        console.log('Sending abortOperation');
        appState.socket.emit('abortOperation');
      }
    },

    browseFolders: (path) => {
      if (appState.socket) {
        console.log('Sending browseFolders with path:', path);
        appState.socket.emit('browseFolders', { path });
      }
    },

    createFolder: (path) => {
      if (appState.socket) {
        console.log('Sending createFolder with path:', path);
        appState.socket.emit('createFolder', { path });
      }
    },

    deleteScanResult: (scanResultPath) => {
      if (appState.socket) {
        console.log('Sending deleteScanResult with path:', scanResultPath);
        appState.socket.emit('deleteScanResult', { scanResultPath });
        
        // Add to deleting set
        setDeletingScans(prev => new Set([...prev, scanResultPath]));
      }
    },

    getScanResults: () => {
      if (appState.socket) {
        console.log('Sending getScanResults');
        appState.socket.emit('getScanResults');
      }
    },

    getLogFiles: () => {
      if (appState.socket) {
        console.log('Sending getLogFiles');
        appState.socket.emit('getLogFiles');
      }
    }
  };

  return { socketActions };
}
