import React, { useCallback, useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import ErrorBoundary from "./components/ErrorBoundary";
import FileListModal from "./components/FileListModal";
import LogViewer from "./components/LogViewer";
import ProgressBar from "./components/ProgressBar";
import StatusBadge from "./components/StatusBadge";
import { useDebounce, useLocalStorage } from "./hooks/useUtilities";
import { sanitizeInput, validatePath } from "./utils/validation";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:8080";

export default function App() {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [stage, setStage] = useState("idle");
  const [detailedStage, setDetailedStage] = useState("idle");
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState({
    TotalVideos: 0,
    ProcessedVideos: 0,
    PhotosToDelete: 0,
    VideosToDelete: 0,
    FoldersToDelete: 0,
    VideosToMove: 0,
  });
  const [errors, setErrors] = useState([]);

  // Persistent user settings
  const [startFolder, setStartFolder] = useLocalStorage("startFolder", ".");
  const [videoMoveTarget, setVideoMoveTarget] = useLocalStorage("videoMoveTarget", "./SortedVideos");
  const [ignoreFolders, setIgnoreFolders] = useLocalStorage("ignoreFolders", "");
  const [dryRun, setDryRun] = useLocalStorage("dryRun", false);

  // PowerShell script settings
  const [minVideoLengthSec, setMinVideoLengthSec] = useLocalStorage("minVideoLengthSec", 30);
  const [photoExtensions, setPhotoExtensions] = useLocalStorage("photoExtensions", "jpg,jpeg,png,gif,bmp,tiff");
  const [videoExtensions, setVideoExtensions] = useLocalStorage("videoExtensions", "mp4,avi,mov,wmv,flv,mkv,webm");
  const [deleteEmptyFolders, setDeleteEmptyFolders] = useLocalStorage("deleteEmptyFolders", true);
  const [moveVideos, setMoveVideos] = useLocalStorage("moveVideos", true);

  // Input validation states
  const [validationErrors, setValidationErrors] = useState({});

  // Revert functionality
  const [logFiles, setLogFiles] = useState([]);
  const [selectedLogFile, setSelectedLogFile] = useState("");
  const [showRevertModal, setShowRevertModal] = useState(false);

  // File choice dialog state
  const [showFileChoiceDialog, setShowFileChoiceDialog] = useState(false);
  const [fileChoiceMessage, setFileChoiceMessage] = useState("");

  // Scan-only and scan results functionality
  const [scanResults, setScanResults] = useState([]);
  const [selectedScanResult, setSelectedScanResult] = useState("");
  const [showScanResultsModal, setShowScanResultsModal] = useState(false);
  const [deletingScans, setDeletingScans] = useState(new Set());

  // Folder browser functionality
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [folderContents, setFolderContents] = useState({ currentPath: '', folders: [], files: [] });
  const [folderBrowserLoading, setFolderBrowserLoading] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Auto-update notification state
  const [showAutoUpdateNotification, setShowAutoUpdateNotification] = useState(false);
  const autoUpdateTimeoutRef = useRef(null);

  // File list modal state
  const [showFileListModal, setShowFileListModal] = useState(false);
  const [fileListModalData, setFileListModalData] = useState({
    title: '',
    files: [],
    action: 'delete', // 'delete', 'move', or 'remove'
    moveTarget: null
  });
  const [fileLists, setFileLists] = useState({
    photoFiles: [],
    shortVideos: [],
    longVideos: [],
    emptyFolders: []
  });

  // Excluded files state
  const [excludedFiles, setExcludedFiles] = useState({
    photoFiles: [],
    shortVideos: [],
    longVideos: [],
    emptyFolders: []
  });

  // Debounced validation
  const debouncedValidation = useDebounce(useCallback(() => {
    const errors = {};
    
    if (!validatePath(startFolder)) {
      errors.startFolder = "Invalid start folder path";
    }
    
    if (!validatePath(videoMoveTarget)) {
      errors.videoMoveTarget = "Invalid video move target path";
    }
    
    setValidationErrors(errors);
  }, [startFolder, videoMoveTarget]), 500);

  // Validate inputs on change
  useEffect(() => {
    debouncedValidation();
  }, [startFolder, videoMoveTarget, debouncedValidation]);

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
        setShowAutoUpdateNotification(true);
        
        // Hide notification after 3 seconds
        autoUpdateTimeoutRef.current = setTimeout(() => {
          setShowAutoUpdateNotification(false);
        }, 3000);
      }
    } else if (startFolder === '.' || startFolder === '') {
      // Reset to relative path for current directory
      const defaultTarget = './SortedVideos';
      if (defaultTarget !== videoMoveTarget) {
        setVideoMoveTarget(defaultTarget);
        setShowAutoUpdateNotification(true);
        
        // Hide notification after 3 seconds
        autoUpdateTimeoutRef.current = setTimeout(() => {
          setShowAutoUpdateNotification(false);
        }, 3000);
      }
    }

    // Cleanup function to clear timeout on unmount
    return () => {
      if (autoUpdateTimeoutRef.current) {
        clearTimeout(autoUpdateTimeoutRef.current);
      }
    };
  }, [startFolder, setVideoMoveTarget, videoMoveTarget, setShowAutoUpdateNotification]);

  // Function to get parent directory path
  const getParentDirectory = useCallback((currentPath) => {
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
      return parts.join('/');
    }
  }, []);

  // Function to browse folders
  const browseFolders = useCallback((path) => {
    if (!socket) return;
    setFolderBrowserLoading(true);
    socket.emit("browseFolders", { path });
  }, [socket]);

  // Function to create a new folder
  const createFolder = useCallback((parentPath, folderName) => {
    if (!socket) return;
    setCreatingFolder(true);
    socket.emit("createFolder", { parentPath, folderName });
  }, [socket]);

  // Socket connection management
  const selectedScanResultRef = useRef(selectedScanResult);
  selectedScanResultRef.current = selectedScanResult;
  
  useEffect(() => {
    const s = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    s.on("connect", () => {
      console.log("Connected to backend");
      setSocket(s);
      setConnectionStatus("connected");
      setErrors([]);
    });

    s.on("status", (status) => {
      const rawStage = status.Stage || status.stage || "idle";
      
      // Normalize all scanning/analyzing stages to just "scanning"
      let newStage = rawStage;
      if (rawStage.includes("scanning") || rawStage.includes("analyzing")) {
        newStage = "scanning";
      }
      
      setDetailedStage(rawStage);
      setStage(newStage);
      
      // Hide file choice dialog when stage changes from waiting to running
      if (newStage === "running" && showFileChoiceDialog) {
        setShowFileChoiceDialog(false);
        setFileChoiceMessage("");
      }
      
      // Simple progress update - just count files
      if (status.processed !== undefined && status.total !== undefined) {
        setProgress(prev => ({
          ...prev,
          TotalVideos: status.total,
          ProcessedVideos: status.processed,
          stage: newStage
        }));
      }
      
      // Update summary counts during scanning (real-time)
      if (status.photosToDelete !== undefined || status.videosToDelete !== undefined || 
          status.videosToMove !== undefined || status.foldersToDelete !== undefined) {
        setProgress(prev => ({
          ...prev,
          PhotosToDelete: status.photosToDelete || prev.PhotosToDelete,
          VideosToDelete: status.videosToDelete || prev.VideosToDelete,
          VideosToMove: status.videosToMove || prev.VideosToMove,
          FoldersToDelete: status.foldersToDelete || prev.FoldersToDelete,
          stage: newStage
        }));
        
        // Update file lists if available
        if (status.fileLists) {
          setFileLists(status.fileLists);
        }
      }
      
      // Final results when done
      if (newStage === "done") {
        if (status.progress) {
          setProgress({...status.progress, stage: newStage});
        } else if (status.PhotosToDelete !== undefined) {
          setProgress({
            TotalVideos: status.TotalVideos || 0,
            ProcessedVideos: status.ProcessedVideos || 0,
            PhotosToDelete: status.PhotosToDelete || 0,
            VideosToDelete: status.VideosToDelete || 0,
            FoldersToDelete: status.FoldersToDelete || 0,
            VideosToMove: status.VideosToMove || 0,
            stage: newStage
          });
        }
      }

      // Update logs
      if (status.logs && Array.isArray(status.logs)) {
        setLogs(status.logs);
        
        // Check for file choice dialog trigger - ensure array has elements before accessing
        if (status.logs.length > 0) {
          const latestLog = status.logs[status.logs.length - 1];
          if (latestLog && latestLog.includes("Choose action: 1) Skip this file, 2) Permanently delete, 3) Abort operation")) {
            setShowFileChoiceDialog(true);
            // Extract the file name from the previous log message
            if (status.logs.length > 1) {
              const previousLog = status.logs[status.logs.length - 2];
              if (previousLog && previousLog.includes("Failed to move")) {
                setFileChoiceMessage(previousLog);
              }
            }
          }
        }
      } else if (status.Logs && Array.isArray(status.Logs)) {
        setLogs(status.Logs);
        
        // Check for file choice dialog trigger - ensure array has elements before accessing
        if (status.Logs.length > 0) {
          const latestLog = status.Logs[status.Logs.length - 1];
          if (latestLog && latestLog.includes("Choose action: 1) Skip this file, 2) Permanently delete, 3) Abort operation")) {
            setShowFileChoiceDialog(true);
            // Extract the file name from the previous log message
            if (status.Logs.length > 1) {
              const previousLog = status.Logs[status.Logs.length - 2];
              if (previousLog && previousLog.includes("Failed to move")) {
                setFileChoiceMessage(previousLog);
              }
            }
          }
        }
      }
    });

    s.on("disconnect", () => {
      console.log("Disconnected from backend");
      setSocket(null);
      setConnectionStatus("disconnected");
    });

    s.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setConnectionStatus("error");
      setErrors(prev => [...prev, `Connection error: ${error.message}`]);
    });

    s.on("error", (msg) => {
      console.error("Socket error:", msg);
      setErrors(prev => [...prev, typeof msg === 'string' ? msg : JSON.stringify(msg)]);
    });

    s.on("logFiles", (files) => {
      console.log("Log files received:", files);
      setLogFiles(files);
    });

    s.on("scanResults", (results) => {
      console.log("Scan results received:", results);
      console.log("Scan results count:", results.length);
      if (results.length > 0) {
        console.log("First scan result details:", results[0]);
        if (results[0].scanResults) {
          console.log("First scan result counts - Photos:", results[0].scanResults.totalPhotos, "Short videos:", results[0].scanResults.totalShortVideos, "Long videos:", results[0].scanResults.totalLongVideos, "Empty folders:", results[0].scanResults.totalEmptyFolders);
        }
      }
      setScanResults(results);
    });

    s.on("scanResultDeleted", (result) => {
      console.log("Scan result deleted:", result);
      if (result.success) {
        // Clear the selected scan result if it was the one deleted
        if (selectedScanResultRef.current === result.deletedPath) {
          setSelectedScanResult("");
        }
        // Update the deletingScans set to remove the deleted item
        setDeletingScans(prev => {
          const newSet = new Set(prev);
          newSet.delete(result.deletedPath);
          return newSet;
        });
      }
    });

    s.on("folderContents", (contents) => {
      console.log("Folder contents received:", contents);
      
      // Handle error case
      if (contents.error) {
        setErrors(prev => [...prev, `Folder browser error: ${contents.error}`]);
        setFolderBrowserLoading(false);
        return;
      }
      
      // Ensure contents has the expected structure with default fallbacks
      const safeFolderContents = {
        currentPath: contents?.currentPath || '',
        folders: Array.isArray(contents?.folders) ? contents.folders : [],
        files: Array.isArray(contents?.files) ? contents.files : []
      };
      setFolderContents(safeFolderContents);
      setFolderBrowserLoading(false);
    });

    s.on("folderCreated", (result) => {
      console.log("Folder created:", result);
      setCreatingFolder(false);
      setShowCreateFolder(false);
      setNewFolderName("");
      
      if (result.success && result.parentPath) {
        // Refresh the current folder contents to show the new folder
        console.log("Refreshing folder contents for:", result.parentPath);
        s.emit("browseFolders", { path: result.parentPath });
      } else if (result.error) {
        // Handle error case
        console.error("Folder creation failed:", result.error);
        setErrors(prev => [...prev, result.error]);
      }
    });

    return () => {
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFileChoiceDialog]);

  // Function to get available log files
  const getLogFiles = useCallback(() => {
    if (!socket) return;
    socket.emit("getLogFiles");
  }, [socket]);

  // Function to get available scan results
  const getScanResults = useCallback(() => {
    if (!socket) return;
    socket.emit("getScanResults");
  }, [socket]);

  // Function to delete a scan result
  const deleteScanResult = useCallback((scanResultPath) => {
    if (!socket) return;
    setDeletingScans(prev => new Set(prev.add(scanResultPath)));
    socket.emit("deleteScanResult", { scanResultPath });
  }, [socket]);

  // Function to select folder from browser
  const selectFolderFromBrowser = useCallback((folderPath) => {
    setStartFolder(folderPath);
    setShowFolderBrowser(false);
    setFolderContents({ currentPath: '', folders: [], files: [] });
  }, [setStartFolder]);

  // Function to select folder for video move target
  const selectVideoMoveTargetFromBrowser = useCallback((folderPath) => {
    setVideoMoveTarget(folderPath);
    setShowFolderBrowser(false);
    setFolderContents({ currentPath: '', folders: [], files: [] });
  }, [setVideoMoveTarget]);

  // Track which field is being browsed
  const [folderBrowserMode, setFolderBrowserMode] = useState('startFolder'); // 'startFolder' or 'videoMoveTarget'

  // Function to open folder browser for start folder
  const openFolderBrowserForStart = useCallback(() => {
    setFolderBrowserMode('startFolder');
    setShowFolderBrowser(true);
    // Start browsing from the currently selected start folder directory, or fallback to C:\ if not set
    let startPath = 'C:\\'; // Default fallback
    if (startFolder && startFolder.trim() !== '' && startFolder !== '.') {
      // If start folder is a valid path, use it as the starting point
      startPath = startFolder;
    }
    browseFolders(startPath);
  }, [browseFolders, startFolder]);

  // Function to open folder browser for video move target
  const openFolderBrowserForVideoTarget = useCallback(() => {
    setFolderBrowserMode('videoMoveTarget');
    setShowFolderBrowser(true);
    // Start browsing from the start folder directory, or fallback to C:\ if start folder is invalid
    let startPath = 'C:\\';
    if (startFolder && startFolder.trim() !== '' && startFolder !== '.') {
      // If start folder is a valid path, use it as the starting point
      startPath = startFolder;
    }
    browseFolders(startPath);
  }, [browseFolders, startFolder]);

  // Function to start revert operation
  const startRevert = useCallback((logPath) => {
    if (!socket) {
      setErrors(prev => [...prev, "Not connected to server"]);
      return;
    }

    const revertParams = {
      RevertLogPath: logPath
    };

    console.log("Starting revert with params:", revertParams);
    socket.emit("startCleanup", revertParams);
    setShowRevertModal(false);
  }, [socket]);

  // File choice functions for when Recycle Bin fails
  const skipFile = useCallback(() => {
    if (!socket) return;
    socket.emit("skipFile");
  }, [socket]);

  const deleteFile = useCallback(() => {
    if (!socket) return;
    socket.emit("deleteFile");
  }, [socket]);

  const abortOperation = useCallback(() => {
    if (!socket) return;
    socket.emit("abortOperation");
  }, [socket]);

  const startCleanup = useCallback(() => {
    if (!socket) {
      setErrors(prev => [...prev, "Not connected to server"]);
      return;
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(prev => [...prev, "Please fix validation errors before starting"]);
      return;
    }

    const cleanupParams = {
      StartFolder: sanitizeInput(startFolder),
      VideoMoveTarget: sanitizeInput(videoMoveTarget),
      IgnoreFolders: (ignoreFolders || "")
        .split(",")
        .map((f) => sanitizeInput(f.trim()))
        .filter((f) => f.length > 0),
      DryRun: dryRun,
      MinVideoLengthSec: minVideoLengthSec,
      PhotoExtensions: photoExtensions.split(",").map(ext => ext.trim()),
      VideoExtensions: videoExtensions.split(",").map(ext => ext.trim()),
      DeleteEmptyFolders: deleteEmptyFolders,
      MoveVideos: moveVideos,
      ExcludedFiles: excludedFiles,
    };

    socket.emit("startCleanup", cleanupParams);
    console.log("Start Cleanup with params:", cleanupParams);
    setErrors([]);
    // Clear file lists when starting new operation
    setFileLists({
      photoFiles: [],
      shortVideos: [],
      longVideos: [],
      emptyFolders: []
    });
    // Clear excluded files
    setExcludedFiles({
      photoFiles: [],
      shortVideos: [],
      longVideos: [],
      emptyFolders: []
    });
  }, [socket, startFolder, videoMoveTarget, ignoreFolders, validationErrors, dryRun, minVideoLengthSec, photoExtensions, videoExtensions, deleteEmptyFolders, moveVideos, excludedFiles]);

  const sendConfirm = useCallback(() => {
    if (!socket) return;
    console.log("Sending confirm signal, current stage:", stage);
    socket.emit("confirm");
    console.log("Confirmation sent");
  }, [socket, stage]);

  const sendCancel = useCallback(() => {
    if (!socket) return;
    socket.emit("cancel");
    console.log("Cancellation sent");
    
    // Reset the app state immediately
    setStage("idle");
    setProgress({
      TotalVideos: 0,
      ProcessedVideos: 0,
      PhotosToDelete: 0,
      VideosToDelete: 0,
      FoldersToDelete: 0,
      VideosToMove: 0,
    });
    setLogs([]);
    setErrors([]);
    // Clear file lists
    setFileLists({
      photoFiles: [],
      shortVideos: [],
      longVideos: [],
      emptyFolders: []
    });
    // Clear excluded files
    setExcludedFiles({
      photoFiles: [],
      shortVideos: [],
      longVideos: [],
      emptyFolders: []
    });
  }, [socket]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Function to start scan-only operation
  const startScanOnly = useCallback(() => {
    if (!socket) {
      setErrors(prev => [...prev, "Not connected to server"]);
      return;
    }

    const scanParams = {
      StartFolder: sanitizeInput(startFolder),
      MinVideoLengthSec: Number(minVideoLengthSec),
      PhotoExtensions: sanitizeInput(photoExtensions),
      VideoExtensions: sanitizeInput(videoExtensions),
      IgnoreFolders: ignoreFolders ? ignoreFolders.split(',').map(f => f.trim()).filter(f => f) : []
    };

    console.log("Starting scan-only with params:", scanParams);
    socket.emit("startScanOnly", scanParams);
  }, [socket, startFolder, minVideoLengthSec, photoExtensions, videoExtensions, ignoreFolders]);

  // Function to load and start from scan results
  const loadScanResults = useCallback((scanResultsPath) => {
    if (!socket) {
      setErrors(prev => [...prev, "Not connected to server"]);
      return;
    }

    console.log("LOAD SCAN RESULTS: Loading from path:", scanResultsPath);
    console.log("LOAD SCAN RESULTS: Current progress state before loading:", progress);

    // Clear previous scan result selection
    setSelectedScanResult("");

    const loadParams = {
      scanResultsPath: scanResultsPath,
      DryRun: dryRun
    };

    console.log("LOAD SCAN RESULTS: Sending loadScanResults event with params:", loadParams);
    socket.emit("loadScanResults", loadParams);
    setShowScanResultsModal(false);
  }, [socket, dryRun, progress]);

  // Clear selected scan result only when modal opens (not when it closes)
  const [previousModalState, setPreviousModalState] = useState(false);
  useEffect(() => {
    if (showScanResultsModal && !previousModalState) {
      setSelectedScanResult("");
    }
    setPreviousModalState(showScanResultsModal);
  }, [showScanResultsModal, previousModalState]);

  // Debug: Track progress state changes
  useEffect(() => {
    console.log('Progress state updated:', progress);
  }, [progress]);

  // Test function to manually set progress data
  const testProgressData = () => {
    console.log('Setting test progress data');
    setProgress({
      TotalVideos: 166,
      ProcessedVideos: 166,
      PhotosToDelete: 30,
      VideosToDelete: 71,
      FoldersToDelete: 0,
      VideosToMove: 95,
    });
  };

  // Check if cleanup can be started
  const canStart = socket && 
    connectionStatus === "connected" && 
    (stage === "idle" || stage === "done" || stage === "aborted") &&
    Object.keys(validationErrors).length === 0;

  // Function to handle file exclusions
  const handleFilesExcluded = useCallback((excludedFilePaths, fileType) => {
    setExcludedFiles(prev => ({
      ...prev,
      [fileType]: excludedFilePaths
    }));
    
    // Update progress counts to reflect exclusions
    const excludedCount = excludedFilePaths.length;
    setProgress(prev => {
      const newProgress = { ...prev };
      switch (fileType) {
        case 'photoFiles':
          newProgress.PhotosToDelete = Math.max(0, prev.PhotosToDelete - excludedCount);
          break;
        case 'shortVideos':
          newProgress.VideosToDelete = Math.max(0, prev.VideosToDelete - excludedCount);
          break;
        case 'longVideos':
          newProgress.VideosToMove = Math.max(0, prev.VideosToMove - excludedCount);
          break;
        case 'emptyFolders':
          newProgress.FoldersToDelete = Math.max(0, prev.FoldersToDelete - excludedCount);
          break;
        default:
          break;
      }
      return newProgress;
    });
  }, []);

  // Function to open file list modal for different file types
  const openFileListModal = useCallback((type) => {
    let title = '';
    let files = [];
    let action = 'delete';
    let moveTarget = null;
    let fileType = '';

    switch (type) {
      case 'photos':
        title = `Photos to Delete (${progress.PhotosToDelete})`;
        files = fileLists.photoFiles || [];
        action = 'delete';
        fileType = 'photoFiles';
        break;
      case 'shortVideos':
        title = `Short Videos to Delete (${progress.VideosToDelete})`;
        files = fileLists.shortVideos || [];
        action = 'delete';
        fileType = 'shortVideos';
        break;
      case 'longVideos':
        title = `Videos to Move (${progress.VideosToMove})`;
        files = fileLists.longVideos || [];
        action = 'move';
        moveTarget = videoMoveTarget;
        fileType = 'longVideos';
        break;
      case 'emptyFolders':
        title = `Empty Folders to Remove (${progress.FoldersToDelete})`;
        files = fileLists.emptyFolders || [];
        action = 'remove';
        fileType = 'emptyFolders';
        break;
      default:
        return;
    }

    setFileListModalData({ 
      title, 
      files, 
      action, 
      moveTarget,
      onFilesExcluded: (excludedFilePaths) => handleFilesExcluded(excludedFilePaths, fileType)
    });
    setShowFileListModal(true);
  }, [progress, fileLists, videoMoveTarget, handleFilesExcluded]);

  // Function to close file list modal
  const closeFileListModal = useCallback(() => {
    setShowFileListModal(false);
    setFileListModalData({ 
      title: '', 
      files: [], 
      action: 'delete', 
      moveTarget: null,
      onFilesExcluded: null
    });
  }, []);

  return (
    <ErrorBoundary>
      <div
        style={{
          maxWidth: 1000,
          margin: "20px auto",
          padding: "20px",
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          color: "#222",
          backgroundColor: "#f5f5f5",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h1 style={{ margin: 0, color: "#333" }}>File Cleanup Dashboard</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <StatusBadge status={connectionStatus} />
            <StatusBadge status={stage} isDryRun={progress.isDryRun} />
          </div>
        </div>

        {/* Error Display */}
        {errors.length > 0 && (
          <div
            style={{
              backgroundColor: "#ffebee",
              border: "1px solid #f44336",
              borderRadius: "8px",
              padding: "15px",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h3 style={{ margin: 0, color: "#c62828" }}>Errors</h3>
              <button
                onClick={clearErrors}
                style={{
                  padding: "5px 10px",
                  backgroundColor: "#f44336",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Clear
              </button>
            </div>
            {errors.map((error, index) => (
              <div key={index} style={{ color: "#c62828", marginBottom: "5px" }}>
                • {error}
              </div>
            ))}
          </div>
        )}

        {/* Settings Form */}
        <div
          style={{
            backgroundColor: "white",
            padding: "25px",
            borderRadius: "12px",
            marginBottom: "25px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#333", marginBottom: "20px" }}>Configuration</h2>
          
          <div style={{ display: "grid", gap: "20px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#555" }}>
                Start Folder
              </label>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <input
                  type="text"
                  value={startFolder}
                  onChange={(e) => setStartFolder(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    fontSize: "14px",
                    border: validationErrors.startFolder ? "2px solid #f44336" : "1px solid #ddd",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                  placeholder="e.g., C:\\Videos"
                />
                <button
                  type="button"
                  onClick={openFolderBrowserForStart}
                  disabled={!socket}
                  style={{
                    padding: "12px 16px",
                    fontSize: "14px",
                    backgroundColor: socket ? "#2196f3" : "#ccc",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: socket ? "pointer" : "not-allowed",
                    whiteSpace: "nowrap",
                  }}
                  title="Browse for folder"
                >
                  📁 Browse
                </button>
              </div>
              {validationErrors.startFolder && (
                <div style={{ color: "#f44336", fontSize: "12px", marginTop: "5px" }}>
                  {validationErrors.startFolder}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#555" }}>
                Video Move Target
              </label>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <input
                  type="text"
                  value={videoMoveTarget}
                  onChange={(e) => setVideoMoveTarget(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    fontSize: "14px",
                    border: validationErrors.videoMoveTarget ? "2px solid #f44336" : "1px solid #ddd",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                  placeholder="e.g., C:\\SortedVideos"
                />
                <button
                  type="button"
                  onClick={openFolderBrowserForVideoTarget}
                  disabled={!socket}
                  style={{
                    padding: "12px 16px",
                    fontSize: "14px",
                    backgroundColor: socket ? "#2196f3" : "#ccc",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: socket ? "pointer" : "not-allowed",
                    whiteSpace: "nowrap",
                  }}
                  title="Browse for folder"
                >
                  📁 Browse
                </button>
              </div>
              {validationErrors.videoMoveTarget && (
                <div style={{ color: "#f44336", fontSize: "12px", marginTop: "5px" }}>
                  {validationErrors.videoMoveTarget}
                </div>
              )}
              {showAutoUpdateNotification && (
                <div style={{ 
                  color: "#4caf50", 
                  fontSize: "12px", 
                  marginTop: "5px",
                  backgroundColor: "#e8f5e8",
                  padding: "5px 10px",
                  borderRadius: "4px",
                  border: "1px solid #4caf50",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px"
                }}>
                  ✓ Auto-updated based on start folder
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#555" }}>
                Ignore Folders (comma-separated)
              </label>
              <input
                type="text"
                value={ignoreFolders}
                onChange={(e) => setIgnoreFolders(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "14px",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
                placeholder="e.g., temp, backup, .git"
              />
              <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                Folders to skip during cleanup
              </div>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#555" }}>
                Dry Run (Preview only)
              </label>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                style={{
                  width: "20px",
                  height: "20px",
                  cursor: "pointer",
                }}
              />
              <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                {dryRun ? "✓ Safe mode: Shows what would happen without making changes" : "⚠️ Live mode: Will actually modify files"}
              </div>
            </div>

            {/* Advanced PowerShell Script Settings */}
            <div style={{ marginTop: "30px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
              <h3 style={{ marginTop: 0, color: "#333", marginBottom: "15px", fontSize: "16px" }}>
                🔧 Advanced Script Settings
              </h3>
              
              <div style={{ display: "grid", gap: "15px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", color: "#555", fontSize: "13px" }}>
                      Min Video Length (seconds)
                    </label>
                    <input
                      type="number"
                      value={minVideoLengthSec}
                      onChange={(e) => setMinVideoLengthSec(Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "8px",
                        fontSize: "14px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        boxSizing: "border-box",
                      }}
                      placeholder="30"
                    />
                    <div style={{ fontSize: "11px", color: "#666", marginTop: "3px" }}>
                      Videos shorter than this will be deleted, others will be moved to sorted folder
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", color: "#555", fontSize: "13px" }}>
                    Photo Extensions
                  </label>
                  <input
                    type="text"
                    value={photoExtensions}
                    onChange={(e) => setPhotoExtensions(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                    }}
                    placeholder="jpg,jpeg,png,gif,bmp,tiff"
                  />
                  <div style={{ fontSize: "11px", color: "#666", marginTop: "3px" }}>
                    File extensions to treat as photos (comma-separated)
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", color: "#555", fontSize: "13px" }}>
                    Video Extensions
                  </label>
                  <input
                    type="text"
                    value={videoExtensions}
                    onChange={(e) => setVideoExtensions(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "14px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                    }}
                    placeholder="mp4,avi,mov,wmv,flv,mkv,webm"
                  />
                  <div style={{ fontSize: "11px", color: "#666", marginTop: "3px" }}>
                    File extensions to treat as videos (comma-separated)
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                  <div>
                    <label style={{ display: "flex", alignItems: "center", fontSize: "13px", fontWeight: "bold", color: "#555" }}>
                      <input
                        type="checkbox"
                        checked={deleteEmptyFolders}
                        onChange={(e) => setDeleteEmptyFolders(e.target.checked)}
                        style={{
                          marginRight: "8px",
                          width: "16px",
                          height: "16px",
                          cursor: "pointer",
                        }}
                      />
                      Delete Empty Folders
                    </label>
                    <div style={{ fontSize: "11px", color: "#666", marginTop: "3px", marginLeft: "24px" }}>
                      Remove folders that become empty after cleanup
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "flex", alignItems: "center", fontSize: "13px", fontWeight: "bold", color: "#555" }}>
                      <input
                        type="checkbox"
                        checked={moveVideos}
                        onChange={(e) => setMoveVideos(e.target.checked)}
                        style={{
                          marginRight: "8px",
                          width: "16px",
                          height: "16px",
                          cursor: "pointer",
                        }}
                      />
                      Move Non-Short Videos
                    </label>
                    <div style={{ fontSize: "11px", color: "#666", marginTop: "3px", marginLeft: "24px" }}>
                      Move videos that are not deleted (≥ min length) to target folder
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <button
              onClick={startCleanup}
              disabled={!canStart}
              style={{
                padding: "15px 30px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: canStart ? "pointer" : "not-allowed",
                backgroundColor: canStart ? (dryRun ? "#2196f3" : "#4caf50") : "#ccc",
                color: "white",
                border: "none",
                borderRadius: "8px",
                transition: "background-color 0.3s",
                marginTop: "10px",
              }}
              title={
                !socket
                  ? "Not connected to server"
                  : !canStart
                  ? "Fix errors or wait for current operation to complete"
                  : dryRun
                  ? "Preview cleanup process without making changes"
                  : "Start file cleanup process"
              }
            >
              {stage === "running" || stage === "scanning" 
                ? (dryRun ? "Previewing..." : "Processing...") 
                : (dryRun ? "🔍 Preview Cleanup" : "🚀 Start Cleanup")}
            </button>

            <button
              onClick={startScanOnly}
              disabled={!canStart || !socket || stage === "running" || stage === "scanning"}
              style={{
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: canStart && socket && stage !== "running" && stage !== "scanning" ? "pointer" : "not-allowed",
                backgroundColor: canStart && socket && stage !== "running" && stage !== "scanning" ? "#2196f3" : "#ccc",
                color: "white",
                border: "none",
                borderRadius: "8px",
                transition: "background-color 0.3s",
                marginTop: "10px",
                marginLeft: "10px",
              }}
              title={
                !socket
                  ? "Not connected to server"
                  : !canStart
                  ? "Fix validation errors first"
                  : stage === "running" || stage === "scanning"
                  ? "Operation already running"
                  : "Scan folder and save results without performing cleanup"
              }
            >
              📊 Scan Only
            </button>

            <button
              onClick={() => {
                getScanResults();
                setSelectedScanResult(""); // Clear previous selection
                setShowScanResultsModal(true);
              }}
              disabled={!socket || stage === "running" || stage === "scanning"}
              style={{
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: socket && stage !== "running" && stage !== "scanning" ? "pointer" : "not-allowed",
                backgroundColor: socket && stage !== "running" && stage !== "scanning" ? "#4caf50" : "#ccc",
                color: "white",
                border: "none",
                borderRadius: "8px",
                transition: "background-color 0.3s",
                marginTop: "10px",
                marginLeft: "10px",
              }}
              title={
                !socket
                  ? "Not connected to server"
                  : stage === "running" || stage === "scanning"
                  ? "Cannot load scan results while operation is running"
                  : "Load previously scanned folder results"
              }
            >
              📁 Load Scan Results
            </button>

            <button
              onClick={testProgressData}
              style={{
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                backgroundColor: "#ff9800",
                color: "white",
                border: "none",
                borderRadius: "8px",
                transition: "background-color 0.3s",
                marginTop: "10px",
                marginLeft: "10px",
              }}
              title="Test progress data display"
            >
              🧪 Test Progress
            </button>

            <button
              onClick={() => {
                getLogFiles();
                setShowRevertModal(true);
              }}
              disabled={!socket || stage === "running" || stage === "scanning"}
              style={{
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: socket && stage !== "running" && stage !== "scanning" ? "pointer" : "not-allowed",
                backgroundColor: socket && stage !== "running" && stage !== "scanning" ? "#ff9800" : "#ccc",
                color: "white",
                border: "none",
                borderRadius: "8px",
                transition: "background-color 0.3s",
                marginTop: "10px",
                marginLeft: "10px",
              }}
              title={
                !socket
                  ? "Not connected to server"
                  : stage === "running" || stage === "scanning"
                  ? "Cannot revert while operation is running"
                  : "Revert a previous cleanup operation"
              }
            >
              ↩️ Revert Operation
            </button>
          </div>
        </div>

        {/* Revert Modal */}
        {showRevertModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "30px",
                borderRadius: "12px",
                width: "500px",
                maxWidth: "90vw",
                maxHeight: "80vh",
                overflow: "auto",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#333" }}>Revert Previous Operation</h3>
              <p style={{ color: "#666", marginBottom: "20px" }}>
                Select a previous cleanup operation to revert. Note: Deleted files cannot be restored.
              </p>
              
              {logFiles.length === 0 ? (
                <p style={{ color: "#999", textAlign: "center", padding: "20px" }}>
                  No operation logs found. Only cleanup operations create revert logs.
                </p>
              ) : (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>
                    Available Operations:
                  </label>
                  <select
                    value={selectedLogFile}
                    onChange={(e) => setSelectedLogFile(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  >
                    <option value="">Select an operation to revert...</option>
                    {logFiles.map((file) => (
                      <option key={file.name} value={file.path}>
                        {file.name.replace('operation_log_', '').replace('.json', '')} 
                        ({Math.round(file.size / 1024)}KB)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => {
                    setShowRevertModal(false);
                    setSelectedLogFile("");
                  }}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#ccc",
                    color: "black",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedLogFile) {
                      startRevert(selectedLogFile);
                    }
                  }}
                  disabled={!selectedLogFile}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: selectedLogFile ? "#ff9800" : "#ccc",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: selectedLogFile ? "pointer" : "not-allowed",
                  }}
                >
                  ↩️ Revert Selected
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scan Results Modal */}
        {showScanResultsModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "30px",
                borderRadius: "12px",
                width: "600px",
                maxWidth: "90vw",
                maxHeight: "80vh",
                overflow: "auto",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              }}
            >
              <h2 style={{ marginTop: 0, color: "#333" }}>📁 Load Previous Scan Results</h2>
              <p style={{ color: "#666", marginBottom: "20px" }}>
                Select a previously scanned folder to review or execute cleanup operations.
              </p>
              
              {scanResults.length === 0 ? (
                <p style={{ color: "#999", textAlign: "center", padding: "20px" }}>
                  No scan results found. Use "Scan Only" to create scan results first.
                </p>
              ) : (
                <div style={{ marginBottom: "20px" }}>
                  {scanResults.map((result) => (
                    <div
                      key={result.filePath}
                      style={{
                        border: selectedScanResult === result.filePath ? "2px solid #4caf50" : "1px solid #ddd",
                        borderRadius: "8px",
                        padding: "15px",
                        marginBottom: "10px",
                        cursor: "pointer",
                        backgroundColor: selectedScanResult === result.filePath ? "#f8f9fa" : "white",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => {
                        setSelectedScanResult(result.filePath);
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "bold", color: "#333", marginBottom: "5px" }}>
                            📂 {result.startFolder || 'Unknown Folder'}
                          </div>
                          <div style={{ fontSize: "12px", color: "#666", marginBottom: "10px" }}>
                            Scanned: {result.timestamp || 'Unknown'} | Size: {Math.round((result.size || 0) / 1024)}KB
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", fontSize: "14px" }}>
                            <div>📸 Photos: <strong>{result.summary?.totalPhotos || 0}</strong></div>
                            <div>🎬 Long Videos: <strong>{result.summary?.totalLongVideos || 0}</strong></div>
                            <div>⏱️ Short Videos: <strong>{result.summary?.totalShortVideos || 0}</strong></div>
                            <div>📁 Empty Folders: <strong>{result.summary?.totalEmptyFolders || 0}</strong></div>
                          </div>
                          <div style={{ marginTop: "10px", fontSize: "12px", color: "#888" }}>
                            Total Files: <strong>{result.totalFiles || 0}</strong>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Are you sure you want to delete the scan result for "${result.startFolder}"?\n\nThis will permanently remove the scan file and cannot be undone.`)) {
                                deleteScanResult(result.filePath);
                              }
                            }}
                            disabled={deletingScans.has(result.filePath)}
                            style={{
                              padding: "4px 8px",
                              backgroundColor: deletingScans.has(result.filePath) ? "#ccc" : "#dc3545",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: deletingScans.has(result.filePath) ? "not-allowed" : "pointer",
                              fontSize: "12px",
                              transition: "background-color 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (!deletingScans.has(result.filePath)) {
                                e.target.style.backgroundColor = "#c82333";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!deletingScans.has(result.filePath)) {
                                e.target.style.backgroundColor = "#dc3545";
                              }
                            }}
                            title="Delete this scan result"
                          >
                            {deletingScans.has(result.filePath) ? "🔄 Deleting..." : "🗑️ Delete"}
                          </button>
                          {selectedScanResult === result.filePath && (
                            <div style={{ color: "#4caf50", fontSize: "20px" }}>
                              ✓
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => {
                    setShowScanResultsModal(false);
                    setSelectedScanResult("");
                  }}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#ccc",
                    color: "black",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedScanResult) {
                      loadScanResults(selectedScanResult);
                    }
                  }}
                  disabled={!selectedScanResult}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: selectedScanResult ? "#4caf50" : "#ccc",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: selectedScanResult ? "pointer" : "not-allowed",
                  }}
                >
                  📁 Load Selected Scan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Folder Browser Modal */}
        {showFolderBrowser && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "30px",
                borderRadius: "12px",
                width: "700px",
                maxWidth: "90vw",
                maxHeight: "80vh",
                overflow: "auto",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              }}
            >
              <h2 style={{ marginTop: 0, color: "#333" }}>
                📁 Browse Folders {folderBrowserMode === 'startFolder' ? '- Start Folder' : '- Video Move Target'}
              </h2>
              <p style={{ color: "#666", marginBottom: "20px" }}>
                Navigate to and select the folder you want to {folderBrowserMode === 'startFolder' ? 'scan for cleanup' : 'move videos to'}.
              </p>
              
              {/* Current Path Display */}
              <div style={{ 
                backgroundColor: "#f5f5f5", 
                padding: "10px", 
                borderRadius: "6px", 
                marginBottom: "15px",
                fontFamily: "monospace",
                fontSize: "14px",
                border: "1px solid #ddd"
              }}>
                📂 Current Path: <strong>{folderContents.currentPath}</strong>
              </div>

              {/* Parent Directory Button */}
              {folderContents.currentPath && getParentDirectory(folderContents.currentPath) && (
                <div style={{ marginBottom: "15px" }}>
                  <button
                    onClick={() => {
                      const parentPath = getParentDirectory(folderContents.currentPath);
                      if (parentPath) {
                        browseFolders(parentPath);
                      }
                    }}
                    disabled={folderBrowserLoading}
                    style={{
                      padding: "8px 16px",
                      fontSize: "14px",
                      backgroundColor: !folderBrowserLoading ? "#ff9800" : "#ccc",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: !folderBrowserLoading ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    ⬆️ Move to Parent Directory
                  </button>
                </div>
              )}

              {/* Select Current Directory Button */}
              {folderContents.currentPath && (
                <div style={{ marginBottom: "15px" }}>
                  <button
                    onClick={() => {
                      if (folderBrowserMode === 'startFolder') {
                        selectFolderFromBrowser(folderContents.currentPath);
                      } else if (folderBrowserMode === 'videoMoveTarget') {
                        selectVideoMoveTargetFromBrowser(folderContents.currentPath);
                      }
                    }}
                    disabled={folderBrowserLoading}
                    style={{
                      padding: "8px 16px",
                      fontSize: "14px",
                      backgroundColor: !folderBrowserLoading ? "#4caf50" : "#ccc",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: !folderBrowserLoading ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    ✅ Select This Directory
                  </button>
                </div>
              )}

              {/* Create New Folder Section */}
              {folderBrowserMode === 'videoMoveTarget' && (
                <div style={{ 
                  backgroundColor: "#f0f8ff", 
                  padding: "15px", 
                  borderRadius: "6px", 
                  marginBottom: "15px",
                  border: "1px solid #2196f3"
                }}>
                  {!showCreateFolder ? (
                    <button
                      onClick={() => setShowCreateFolder(true)}
                      disabled={!folderContents.currentPath || folderBrowserLoading}
                      style={{
                        padding: "8px 16px",
                        fontSize: "14px",
                        backgroundColor: folderContents.currentPath && !folderBrowserLoading ? "#2196f3" : "#ccc",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: folderContents.currentPath && !folderBrowserLoading ? "pointer" : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      📁➕ Create New Folder
                    </button>
                  ) : (
                    <div>
                      <div style={{ marginBottom: "10px", fontWeight: "bold", color: "#2196f3" }}>
                        📁➕ Create New Folder
                      </div>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Enter folder name"
                          disabled={creatingFolder}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            fontSize: "14px",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            boxSizing: "border-box"
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && newFolderName.trim()) {
                              createFolder(folderContents.currentPath, newFolderName.trim());
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (newFolderName.trim()) {
                              createFolder(folderContents.currentPath, newFolderName.trim());
                            }
                          }}
                          disabled={!newFolderName.trim() || creatingFolder}
                          style={{
                            padding: "8px 16px",
                            fontSize: "14px",
                            backgroundColor: newFolderName.trim() && !creatingFolder ? "#4caf50" : "#ccc",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: newFolderName.trim() && !creatingFolder ? "pointer" : "not-allowed",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {creatingFolder ? "Creating..." : "Create"}
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateFolder(false);
                            setNewFolderName("");
                          }}
                          disabled={creatingFolder}
                          style={{
                            padding: "8px 16px",
                            fontSize: "14px",
                            backgroundColor: "#ccc",
                            color: "black",
                            border: "none",
                            borderRadius: "4px",
                            cursor: creatingFolder ? "not-allowed" : "pointer"
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Loading State */}
              {folderBrowserLoading && (
                <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
                  🔄 Loading folder contents...
                </div>
              )}

              {/* Folder Contents */}
              {!folderBrowserLoading && folderContents.folders.length === 0 && folderContents.files.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                  This folder is empty or cannot be accessed.
                </div>
              )}

              {!folderBrowserLoading && (folderContents.folders.length > 0 || folderContents.files.length > 0) && (
                <div style={{ marginBottom: "20px", maxHeight: "300px", overflowY: "auto", border: "1px solid #ddd", borderRadius: "6px" }}>
                  {/* Folders */}
                  {folderContents.folders.map((folder, index) => (
                    <div
                      key={`folder-${index}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "10px 15px",
                        borderBottom: "1px solid #f0f0f0",
                        cursor: "pointer",
                        backgroundColor: "white",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f8f9fa";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "white";
                      }}
                      onClick={() => {
                        if (folder.isDirectory) {
                          browseFolders(folder.path);
                        }
                      }}
                    >
                      <div style={{ marginRight: "10px", fontSize: "18px" }}>
                        📁
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "normal" }}>
                          {folder.name}
                        </div>
                        {folder.isFolder && (
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            Double-click to enter, or use "Select This Folder" to choose
                          </div>
                        )}
                      </div>
                      {folder.isFolder && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (folderBrowserMode === 'startFolder') {
                              selectFolderFromBrowser(folder.path);
                            } else {
                              selectVideoMoveTargetFromBrowser(folder.path);
                            }
                          }}
                          style={{
                            padding: "5px 10px",
                            fontSize: "12px",
                            backgroundColor: "#4caf50",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          Select This Folder
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {/* Files (limited display) */}
                  {folderContents.files.length > 0 && (
                    <div style={{ padding: "10px 15px", backgroundColor: "#f9f9f9", borderTop: "1px solid #e0e0e0" }}>
                      <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
                        Files in this folder ({folderContents.files.length}):
                      </div>
                      <div style={{ fontSize: "12px", color: "#888" }}>
                        {folderContents.files.slice(0, 5).map(file => file.name).join(", ")}
                        {folderContents.files.length > 5 && "..."}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => {
                    setShowFolderBrowser(false);
                    setFolderContents({ currentPath: '', folders: [], files: [] });
                  }}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#ccc",
                    color: "black",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* File Choice Dialog */}
        {showFileChoiceDialog && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "30px",
                borderRadius: "12px",
                width: "500px",
                maxWidth: "90vw",
                maxHeight: "80vh",
                overflow: "auto",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#d32f2f" }}>Recycle Bin Operation Failed</h3>
              <p style={{ color: "#666", marginBottom: "20px" }}>
                {fileChoiceMessage}
              </p>
              <p style={{ color: "#666", marginBottom: "20px" }}>
                The file could not be moved to the Recycle Bin. Please choose what to do:
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button
                  onClick={() => {
                    skipFile();
                    setShowFileChoiceDialog(false);
                    setFileChoiceMessage("");
                  }}
                  style={{
                    padding: "12px 20px",
                    backgroundColor: "#2196f3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  🔄 Skip this file and continue
                </button>
                <button
                  onClick={() => {
                    deleteFile();
                    setShowFileChoiceDialog(false);
                    setFileChoiceMessage("");
                  }}
                  style={{
                    padding: "12px 20px",
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  🗑️ Permanently delete this file
                </button>
                <button
                  onClick={() => {
                    abortOperation();
                    setShowFileChoiceDialog(false);
                    setFileChoiceMessage("");
                  }}
                  style={{
                    padding: "12px 20px",
                    backgroundColor: "#ff9800",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  ❌ Abort entire operation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Progress Section */}
        {(stage === "scanning" || stage === "running") && (
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "12px",
              marginBottom: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              border: progress.isDryRun ? "3px solid #2196f3" : "none",
            }}
          >
            {progress.isDryRun && (
              <div
                style={{
                  backgroundColor: "#e3f2fd",
                  color: "#1565c0",
                  padding: "10px 15px",
                  borderRadius: "8px",
                  marginBottom: "15px",
                  fontWeight: "bold",
                  fontSize: "14px",
                  textAlign: "center",
                  border: "2px solid #2196f3",
                }}
              >
                🔍 DRY RUN MODE - Preview Only (No Files Will Be Modified)
              </div>
            )}
            <h3 style={{ marginTop: 0, color: "#333" }}>
              {progress.isDryRun ? "Preview Progress" : "Progress"}
            </h3>
            <ProgressBar
              progress={progress.ProcessedVideos}
              total={progress.TotalVideos}
              stage={stage}
              detailedStage={detailedStage}
            />
            {/* Debug info */}
            <div style={{fontSize: '10px', color: '#999', marginTop: '5px'}}>
              Debug: progress.ProcessedVideos={progress.ProcessedVideos}, progress.TotalVideos={progress.TotalVideos}
            </div>
          </div>
        )}

        {/* Summary Section */}
        <div
          style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            marginBottom: "20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: progress.isDryRun ? "2px solid #2196f3" : "none",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ marginTop: 0, color: "#333", marginBottom: "0" }}>
              {progress.isDryRun ? "Preview Summary" : "Summary"}
            </h3>
            {progress.isDryRun && (
              <div
                style={{
                  backgroundColor: "#2196f3",
                  color: "white",
                  padding: "4px 12px",
                  borderRadius: "16px",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                🔍 DRY RUN
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
            <div 
              style={{ 
                textAlign: "center", 
                padding: "10px", 
                backgroundColor: "#f0f8ff", 
                borderRadius: "8px",
                cursor: progress.PhotosToDelete > 0 ? "pointer" : "default",
                transition: "transform 0.2s, box-shadow 0.2s",
                border: progress.PhotosToDelete > 0 ? "2px solid transparent" : "none"
              }}
              onClick={() => progress.PhotosToDelete > 0 && openFileListModal('photos')}
              onMouseEnter={(e) => {
                if (progress.PhotosToDelete > 0) {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
                  e.target.style.borderColor = "#1976d2";
                }
              }}
              onMouseLeave={(e) => {
                if (progress.PhotosToDelete > 0) {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "none";
                  e.target.style.borderColor = "transparent";
                }
              }}
            >
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#1976d2" }}>
                {progress.PhotosToDelete}
              </div>
              <div style={{ fontSize: "14px", color: "#666" }}>
                Photos {progress.isDryRun ? "to Preview Delete" : "to Delete"}
                {progress.PhotosToDelete > 0 && (
                  <div style={{ fontSize: "12px", color: "#1976d2", marginTop: "4px" }}>
                    📁 Click to view files
                  </div>
                )}
              </div>
            </div>
            <div 
              style={{ 
                textAlign: "center", 
                padding: "10px", 
                backgroundColor: "#fff3e0", 
                borderRadius: "8px",
                cursor: progress.VideosToDelete > 0 ? "pointer" : "default",
                transition: "transform 0.2s, box-shadow 0.2s",
                border: progress.VideosToDelete > 0 ? "2px solid transparent" : "none"
              }}
              onClick={() => progress.VideosToDelete > 0 && openFileListModal('shortVideos')}
              onMouseEnter={(e) => {
                if (progress.VideosToDelete > 0) {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
                  e.target.style.borderColor = "#f57c00";
                }
              }}
              onMouseLeave={(e) => {
                if (progress.VideosToDelete > 0) {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "none";
                  e.target.style.borderColor = "transparent";
                }
              }}
            >
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#f57c00" }}>
                {progress.VideosToDelete}
              </div>
              <div style={{ fontSize: "14px", color: "#666" }}>
                Short Videos {progress.isDryRun ? "to Preview Delete" : "to Delete"}
                {progress.VideosToDelete > 0 && (
                  <div style={{ fontSize: "12px", color: "#f57c00", marginTop: "4px" }}>
                    📁 Click to view files
                  </div>
                )}
              </div>
            </div>
            <div 
              style={{ 
                textAlign: "center", 
                padding: "10px", 
                backgroundColor: "#e8f5e8", 
                borderRadius: "8px",
                cursor: progress.VideosToMove > 0 ? "pointer" : "default",
                transition: "transform 0.2s, box-shadow 0.2s",
                border: progress.VideosToMove > 0 ? "2px solid transparent" : "none"
              }}
              onClick={() => progress.VideosToMove > 0 && openFileListModal('longVideos')}
              onMouseEnter={(e) => {
                if (progress.VideosToMove > 0) {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
                  e.target.style.borderColor = "#388e3c";
                }
              }}
              onMouseLeave={(e) => {
                if (progress.VideosToMove > 0) {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "none";
                  e.target.style.borderColor = "transparent";
                }
              }}
            >
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#388e3c" }}>
                {progress.VideosToMove}
              </div>
              <div style={{ fontSize: "14px", color: "#666" }}>
                Videos {progress.isDryRun ? "to Preview Move" : "to Move"}
                {progress.VideosToMove > 0 && (
                  <div style={{ fontSize: "12px", color: "#388e3c", marginTop: "4px" }}>
                    📁 Click to view files
                  </div>
                )}
              </div>
            </div>
            <div 
              style={{ 
                textAlign: "center", 
                padding: "10px", 
                backgroundColor: "#fce4ec", 
                borderRadius: "8px",
                cursor: progress.FoldersToDelete > 0 ? "pointer" : "default",
                transition: "transform 0.2s, box-shadow 0.2s",
                border: progress.FoldersToDelete > 0 ? "2px solid transparent" : "none"
              }}
              onClick={() => progress.FoldersToDelete > 0 && openFileListModal('emptyFolders')}
              onMouseEnter={(e) => {
                if (progress.FoldersToDelete > 0) {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
                  e.target.style.borderColor = "#c2185b";
                }
              }}
              onMouseLeave={(e) => {
                if (progress.FoldersToDelete > 0) {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "none";
                  e.target.style.borderColor = "transparent";
                }
              }}
            >
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#c2185b" }}>
                {progress.FoldersToDelete}
              </div>
              <div style={{ fontSize: "14px", color: "#666" }}>
                Empty Folders {progress.isDryRun ? "to Preview Delete" : "to Delete"}
                {progress.FoldersToDelete > 0 && (
                  <div style={{ fontSize: "12px", color: "#c2185b", marginTop: "4px" }}>
                    📁 Click to view files
                  </div>
                )}
              </div>
            </div>
          </div>
          {progress.isDryRun && (
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                backgroundColor: "#e3f2fd",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#1565c0",
                textAlign: "center",
                fontStyle: "italic",
              }}
            >
              💡 This is a preview - no files will actually be modified
            </div>
          )}
        </div>

        {/* Confirmation Buttons */}
        {stage === "waiting" && (
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "12px",
              marginBottom: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              textAlign: "center",
              border: dryRun ? "3px solid #2196f3" : "1px solid #e0e0e0",
            }}
          >
            {dryRun && (
              <div
                style={{
                  backgroundColor: "#e3f2fd",
                  color: "#1565c0",
                  padding: "15px",
                  borderRadius: "8px",
                  marginBottom: "20px",
                  fontWeight: "bold",
                  fontSize: "16px",
                  border: "2px solid #2196f3",
                }}
              >
                🔍 DRY RUN MODE ACTIVE
                <div style={{ fontSize: "14px", fontWeight: "normal", marginTop: "5px" }}>
                  This will only simulate the cleanup process without modifying any files
                </div>
              </div>
            )}
            <h3 style={{ marginTop: 0, color: "#333" }}>
              {dryRun ? "🔍 Preview Mode - Ready to Simulate" : "⚠️ Ready to Execute"}
            </h3>
            <p style={{ marginBottom: "20px", color: "#666" }}>
              {dryRun 
                ? "This will simulate the cleanup process without modifying any files. Review the summary above."
                : "This will permanently modify your files. Review the summary above and confirm to proceed."}
            </p>
            <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
              <button
                onClick={sendConfirm}
                style={{
                  padding: "12px 30px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  backgroundColor: dryRun ? "#2196f3" : "#4caf50",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                }}
              >
                {dryRun ? "🔍 Start Preview" : "✓ Confirm & Execute"}
              </button>
              <button
                onClick={sendCancel}
                style={{
                  padding: "12px 30px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  backgroundColor: "#f44336",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                }}
              >
                ✗ Cancel
              </button>
            </div>
          </div>
        )}

        {/* Logs Section */}
        <div
          style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ marginTop: 0, color: "#333", marginBottom: "15px" }}>Activity Log</h3>
          <LogViewer logs={logs} />
        </div>

        {/* File List Modal - OLD VERSION (DISABLED - using FileListModal component instead) */}
        {false && showFileListModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "30px",
                borderRadius: "12px",
                width: "500px",
                maxWidth: "90vw",
                maxHeight: "80vh",
                overflow: "auto",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#333" }}>{fileListModalData.title}</h3>
              <p style={{ color: "#666", marginBottom: "20px" }}>
                {fileListModalData.action === 'delete' && "The following files are marked for deletion:"}
                {fileListModalData.action === 'move' && "The following videos are ready to be moved:"}
                {fileListModalData.action === 'remove' && "The following empty folders will be removed:"}
              </p>
              
              {fileListModalData.files.length === 0 ? (
                <p style={{ color: "#999", textAlign: "center", padding: "20px" }}>
                  No files to display for this action.
                </p>
              ) : (
                <div style={{ marginBottom: "20px" }}>
                  <ul style={{ paddingLeft: "20px", color: "#333" }}>
                    {fileListModalData.files.map((file, index) => (
                      <li key={index} style={{ marginBottom: "10px" }}>
                        {file.name} {file.size && `(${Math.round(file.size / 1024)} KB)`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={closeFileListModal}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#ccc",
                    color: "black",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
                {fileListModalData.action === 'delete' && (
                  <button
                    onClick={() => {
                      // Implement delete action
                      console.log("Deleting files:", fileListModalData.files);
                      closeFileListModal();
                    }}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    🗑️ Delete Files
                  </button>
                )}
                {fileListModalData.action === 'move' && (
                  <button
                    onClick={() => {
                      // Implement move action
                      console.log("Moving videos to:", fileListModalData.moveTarget);
                      closeFileListModal();
                    }}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#4caf50",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    📦 Move Videos
                  </button>
                )}
                {fileListModalData.action === 'remove' && (
                  <button
                    onClick={() => {
                      // Implement remove action
                      console.log("Removing empty folders:", fileListModalData.files);
                      closeFileListModal();
                    }}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#ff9800",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    🚮 Remove Folders
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File List Modal */}
      <FileListModal
        isOpen={showFileListModal}
        onClose={closeFileListModal}
        title={fileListModalData.title}
        files={fileListModalData.files}
        action={fileListModalData.action}
        moveTarget={fileListModalData.moveTarget}
        onFilesExcluded={fileListModalData.onFilesExcluded}
      />
    </ErrorBoundary>
  );
}
