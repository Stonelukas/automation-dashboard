import { useState } from 'react'
import { Socket } from 'socket.io-client'
import { useLocalStorage } from './useUtilities'

export interface Progress {
  TotalVideos: number
  ProcessedVideos: number
  PhotosToDelete: number
  VideosToDelete: number
  FoldersToDelete: number
  VideosToMove: number
}

export interface ScanResults {
  photosToDelete: string[]
  shortVideosToDelete: string[]
  longVideosToMove: string[]
  emptyFoldersToDelete: string[]
  progress: Progress
}

export interface FileListModalData {
  title: string
  files: string[]
  action: 'delete' | 'move'
  moveTarget: string | null
  stage: string | null
}

export interface FileLists {
  photoFiles: string[]
  shortVideos: string[]
  longVideos: string[]
  emptyFolders: string[]
}

export interface ExcludedFiles {
  photoFiles: string[]
  shortVideos: string[]
  longVideos: string[]
  emptyFolders: string[]
}

export interface ValidationErrors {
  [key: string]: string
}

export function useAppState() {
  // Connection and operation states
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<string>("disconnected")
  const [stage, setStage] = useState<string>("idle")
  const [detailedStage, setDetailedStage] = useState<string>("idle")
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState<Progress>({
    TotalVideos: 0,
    ProcessedVideos: 0,
    PhotosToDelete: 0,
    VideosToDelete: 0,
    FoldersToDelete: 0,
    VideosToMove: 0,
  })
  const [errors, setErrors] = useState<string[]>([])

  // Persistent user settings
  const [startFolder, setStartFolder] = useLocalStorage("startFolder", ".")
  const [videoMoveTarget, setVideoMoveTarget] = useLocalStorage("videoMoveTarget", "./SortedVideos")
  const [ignoreFolders, setIgnoreFolders] = useLocalStorage("ignoreFolders", "")
  const [dryRun, setDryRun] = useLocalStorage("dryRun", false)

  // Processing settings
  const [minVideoLengthSec, setMinVideoLengthSec] = useLocalStorage("minVideoLengthSec", 9)
  const [photoExtensions, setPhotoExtensions] = useLocalStorage("photoExtensions", "jpg,jpeg,png,gif,bmp,tiff")
  const [videoExtensions, setVideoExtensions] = useLocalStorage("videoExtensions", "mp4,avi,mov,wmv,flv,mkv,webm")
  const [deleteEmptyFolders, setDeleteEmptyFolders] = useLocalStorage("deleteEmptyFolders", true)
  const [moveVideos, setMoveVideos] = useLocalStorage("moveVideos", true)

  // Input validation states
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  // Revert functionality
  const [logFiles, setLogFiles] = useState<string[]>([])
  const [selectedLogFile, setSelectedLogFile] = useState<string>("")
  const [showRevertModal, setShowRevertModal] = useState<boolean>(false)

  // File choice dialog state
  const [showFileChoiceDialog, setShowFileChoiceDialog] = useState<boolean>(false)
  const [fileChoiceMessage, setFileChoiceMessage] = useState<string>("")

  // Scan results functionality
  const [scanResults, setScanResults] = useState<ScanResults | null>(null)
  const [selectedScanResult, setSelectedScanResult] = useState<string>("")
  const [showScanResultsModal, setShowScanResultsModal] = useState<boolean>(false)
  const [deletingScans, setDeletingScans] = useState<Set<string>>(new Set())

  // File list modal state
  const [showFileListModal, setShowFileListModal] = useState<boolean>(false)
  const [fileListModalData, setFileListModalData] = useState<FileListModalData>({
    title: '',
    files: [],
    action: 'delete',
    moveTarget: null,
    stage: null
  })
  const [fileLists, setFileLists] = useState<FileLists>({
    photoFiles: [],
    shortVideos: [],
    longVideos: [],
    emptyFolders: []
  })

  // Excluded files state
  const [excludedFiles, setExcludedFiles] = useState<ExcludedFiles>({
    photoFiles: [],
    shortVideos: [],
    longVideos: [],
    emptyFolders: []
  })

  // Auto-update notification
  const [showAutoUpdateNotification, setShowAutoUpdateNotification] = useState<boolean>(false)

  // UI state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    pathSettings: false,
    processingSettings: false,
    operationControls: false,
    recentScans: true
  })

  return {
    // Connection states
    socket,
    setSocket,
    connectionStatus,
    setConnectionStatus,
    
    // Operation states
    stage,
    setStage,
    detailedStage,
    setDetailedStage,
    logs,
    setLogs,
    progress,
    setProgress,
    errors,
    setErrors,
    
    // User settings
    startFolder,
    setStartFolder,
    videoMoveTarget,
    setVideoMoveTarget,
    ignoreFolders,
    setIgnoreFolders,
    dryRun,
    setDryRun,
    
    // Processing settings
    minVideoLengthSec,
    setMinVideoLengthSec,
    photoExtensions,
    setPhotoExtensions,
    videoExtensions,
    setVideoExtensions,
    deleteEmptyFolders,
    setDeleteEmptyFolders,
    moveVideos,
    setMoveVideos,
    
    // Validation
    validationErrors,
    setValidationErrors,
    
    // Revert functionality
    logFiles,
    setLogFiles,
    selectedLogFile,
    setSelectedLogFile,
    showRevertModal,
    setShowRevertModal,
    
    // File choice dialog
    showFileChoiceDialog,
    setShowFileChoiceDialog,
    fileChoiceMessage,
    setFileChoiceMessage,
    
    // Scan results
    scanResults,
    setScanResults,
    selectedScanResult,
    setSelectedScanResult,
    showScanResultsModal,
    setShowScanResultsModal,
    deletingScans,
    setDeletingScans,
    
    // File list modal
    showFileListModal,
    setShowFileListModal,
    fileListModalData,
    setFileListModalData,
    fileLists,
    setFileLists,
    
    // Excluded files
    excludedFiles,
    setExcludedFiles,
    
    // UI states
    showAutoUpdateNotification,
    setShowAutoUpdateNotification,
    collapsedSections,
    setCollapsedSections
  }
}
