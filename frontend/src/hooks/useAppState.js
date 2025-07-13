import { useState } from 'react';
import { useLocalStorage } from './useUtilities';

/**
 * Custom hook for managing all application state
 * Extracts state management logic from the main App component
 */
export function useAppState() {
  // Connection and operation states
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

  // Scan results functionality
  const [scanResults, setScanResults] = useState([]);
  const [selectedScanResult, setSelectedScanResult] = useState("");
  const [showScanResultsModal, setShowScanResultsModal] = useState(false);
  const [deletingScans, setDeletingScans] = useState(new Set());

  // File list modal state
  const [showFileListModal, setShowFileListModal] = useState(false);
  const [fileListModalData, setFileListModalData] = useState({
    title: '',
    files: [],
    action: 'delete',
    moveTarget: null,
    stage: null
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

  return {
    // Connection and operation states
    socket, setSocket,
    connectionStatus, setConnectionStatus,
    stage, setStage,
    detailedStage, setDetailedStage,
    logs, setLogs,
    progress, setProgress,
    errors, setErrors,

    // Persistent user settings
    startFolder, setStartFolder,
    videoMoveTarget, setVideoMoveTarget,
    ignoreFolders, setIgnoreFolders,
    dryRun, setDryRun,

    // PowerShell script settings
    minVideoLengthSec, setMinVideoLengthSec,
    photoExtensions, setPhotoExtensions,
    videoExtensions, setVideoExtensions,
    deleteEmptyFolders, setDeleteEmptyFolders,
    moveVideos, setMoveVideos,

    // Input validation states
    validationErrors, setValidationErrors,

    // Revert functionality
    logFiles, setLogFiles,
    selectedLogFile, setSelectedLogFile,
    showRevertModal, setShowRevertModal,

    // File choice dialog state
    showFileChoiceDialog, setShowFileChoiceDialog,
    fileChoiceMessage, setFileChoiceMessage,

    // Scan results functionality
    scanResults, setScanResults,
    selectedScanResult, setSelectedScanResult,
    showScanResultsModal, setShowScanResultsModal,
    deletingScans, setDeletingScans,

    // File list modal state
    showFileListModal, setShowFileListModal,
    fileListModalData, setFileListModalData,
    fileLists, setFileLists,

    // Excluded files state
    excludedFiles, setExcludedFiles,
  };
}
