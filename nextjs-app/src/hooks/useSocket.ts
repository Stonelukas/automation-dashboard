import { useCallback, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { FileLists, Progress, ScanResults } from './useAppState'

const SOCKET_URL = (typeof window !== 'undefined' && typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SOCKET_URL) || "http://localhost:8080"

// Performance optimization: Connection options outside component
const SOCKET_OPTIONS = {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  forceNew: false,
  // Enable compression for better performance
  compression: true,
  // Optimize transport selection
  transports: ['websocket', 'polling'],
  // Connection recovery for better UX
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
  },
}

interface SocketEvents {
  status: (data: StatusData) => void
  error: (data: ErrorData) => void
  scanResults: (data: ScanResultsData) => void
  logFiles: (data: LogFilesData) => void
  fileChoiceDialog: (data: FileChoiceData) => void
  folderContents: (data: FolderContentsData) => void
}

interface StatusData {
  stage: string
  detailedStage?: string
  logs?: string[]
  progress?: Record<string, number>
  isDryRun?: boolean
}

interface ErrorData {
  message: string
  details?: string
}

interface ScanResultsData {
  photosToDelete: string[]
  shortVideosToDelete: string[]
  longVideosToMove: string[]
  emptyFoldersToDelete: string[]
  progress: Record<string, number>
}

interface LogFilesData {
  logFiles: string[]
}

interface FileChoiceData {
  message: string
  fileLists: Record<string, string[]>
}

interface FolderContentsData {
  contents: string[]
  currentPath: string
}

interface AppState {
  setSocket: (socket: Socket | null) => void
  setConnectionStatus: (status: string) => void
  setStage: (stage: string) => void
  setDetailedStage: (stage: string) => void
  setLogs: (logs: string[]) => void
  setProgress: (progress: Progress | ((prev: Progress) => Progress)) => void
  setErrors: (errors: string[] | ((prev: string[]) => string[])) => void
  setScanResults: (results: ScanResults | null) => void
  setLogFiles: (files: string[]) => void
  setShowFileChoiceDialog: (show: boolean) => void
  setFileChoiceMessage: (message: string) => void
  setFileLists: (lists: FileLists) => void
  setDeletingScans: (deleting: any) => void
  setVideoMoveTarget: (target: string) => void
  setShowAutoUpdateNotification: (show: boolean) => void
  startFolder: string
  videoMoveTarget: string
}

interface FolderBrowser {
  setFolderContents: (contents: any) => void
}

// Helper function to convert FolderContentsData to FolderContents
const convertFolderContents = (data: FolderContentsData) => {
  return {
    currentPath: data.currentPath,
    folders: data.contents.filter(item => item.endsWith('/')).map(item => ({
      name: item.slice(0, -1),
      path: item,
      isDirectory: true
    })),
    files: data.contents.filter(item => !item.endsWith('/')).map(item => ({
      name: item,
      path: item,
      isDirectory: false
    }))
  }
}

export function useSocket(appState: AppState, folderBrowser: FolderBrowser) {
  const autoUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Extract state functions to avoid dependency issues
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
    setVideoMoveTarget,
    setShowAutoUpdateNotification,
    startFolder,
    videoMoveTarget
  } = appState

  const { setFolderContents } = folderBrowser

  // Performance optimization: Memoize event handlers
  const handleStatus = useCallback((data: StatusData) => {
    setStage(data.stage)
    if (data.detailedStage) {
      setDetailedStage(data.detailedStage)
    }
    if (data.logs) {
      setLogs(data.logs)
    }
    if (data.progress) {
      // Convert generic progress to typed Progress interface
      const typedProgress: Progress = {
        TotalVideos: data.progress.TotalVideos || 0,
        ProcessedVideos: data.progress.ProcessedVideos || 0,
        PhotosToDelete: data.progress.PhotosToDelete || 0,
        VideosToDelete: data.progress.VideosToDelete || 0,
        FoldersToDelete: data.progress.FoldersToDelete || 0,
        VideosToMove: data.progress.VideosToMove || 0,
      }
      setProgress(typedProgress)
    }
  }, [setStage, setDetailedStage, setLogs, setProgress])

  const handleError = useCallback((data: ErrorData) => {
    setErrors(prev => [...(prev || []), data.message])
    console.error('Socket error:', data)
  }, [setErrors])

  const handleScanResults = useCallback((data: ScanResultsData) => {
    // Convert ScanResultsData to ScanResults format
    const convertedResults: ScanResults = {
      photosToDelete: data.photosToDelete,
      shortVideosToDelete: data.shortVideosToDelete,
      longVideosToMove: data.longVideosToMove,
      emptyFoldersToDelete: data.emptyFoldersToDelete,
      progress: {
        TotalVideos: data.progress.TotalVideos || 0,
        ProcessedVideos: data.progress.ProcessedVideos || 0,
        PhotosToDelete: data.progress.PhotosToDelete || 0,
        VideosToDelete: data.progress.VideosToDelete || 0,
        FoldersToDelete: data.progress.FoldersToDelete || 0,
        VideosToMove: data.progress.VideosToMove || 0,
      }
    }
    setScanResults(convertedResults)
  }, [setScanResults])

  const handleLogFiles = useCallback((data: LogFilesData) => {
    setLogFiles(data.logFiles)
  }, [setLogFiles])

  const handleFileChoiceDialog = useCallback((data: FileChoiceData) => {
    setShowFileChoiceDialog(true)
    setFileChoiceMessage(data.message)
    // Convert generic Record to FileLists
    const convertedLists: FileLists = {
      photoFiles: data.fileLists.photoFiles || [],
      shortVideos: data.fileLists.shortVideos || [],
      longVideos: data.fileLists.longVideos || [],
      emptyFolders: data.fileLists.emptyFolders || [],
    }
    setFileLists(convertedLists)
  }, [setShowFileChoiceDialog, setFileChoiceMessage, setFileLists])

  const handleFolderContents = useCallback((data: FolderContentsData) => {
    const convertedContents = convertFolderContents(data)
    setFolderContents(convertedContents)
  }, [setFolderContents])

  // Connection management with retry logic
  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return

    const socket = io(SOCKET_URL, SOCKET_OPTIONS)
    socketRef.current = socket

    // Connection events
    socket.on('connect', () => {
      setConnectionStatus('connected')
      setSocket(socket)
      // Clear any reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    })

    socket.on('disconnect', (reason) => {
      setConnectionStatus('disconnected')
      console.log('Socket disconnected:', reason)
      
      // Attempt reconnection with exponential backoff
      if (reason === 'io server disconnect') {
        reconnectTimeoutRef.current = setTimeout(() => {
          socket.connect()
        }, 1000)
      }
    })

    socket.on('connect_error', (error) => {
      setConnectionStatus('error')
      console.error('Socket connection error:', error)
    })

    // Application events with optimized handlers
    socket.on('status', handleStatus)
    socket.on('error', handleError)
    socket.on('scanResults', handleScanResults)
    socket.on('logFiles', handleLogFiles)
    socket.on('fileChoiceDialog', handleFileChoiceDialog)
    socket.on('folderContents', handleFolderContents)

    // Connect the socket
    socket.connect()

    return socket
  }, [
    setSocket,
    setConnectionStatus,
    handleStatus,
    handleError,
    handleScanResults,
    handleLogFiles,
    handleFileChoiceDialog,
    handleFolderContents,
  ])

  // Auto-update video move target when start folder changes
  useEffect(() => {
    // Clear any existing timeout
    if (autoUpdateTimeoutRef.current) {
      clearTimeout(autoUpdateTimeoutRef.current)
    }

    if (startFolder && startFolder.trim() !== '' && startFolder !== '.') {
      // Create a sensible default for video move target
      let newVideoTarget: string
      
      // Determine the appropriate path separator based on the start folder format
      const separator = startFolder.includes('\\') ? '\\' : '/'
      
      // Ensure proper path joining
      if (startFolder.endsWith(separator)) {
        newVideoTarget = `${startFolder}LongVideos`
      } else {
        newVideoTarget = `${startFolder}${separator}LongVideos`
      }

      // Set a timeout to avoid rapid updates while user is typing
      autoUpdateTimeoutRef.current = setTimeout(() => {
        if (videoMoveTarget === '' || videoMoveTarget === '.') {
          setVideoMoveTarget(newVideoTarget)
          setShowAutoUpdateNotification(true)
          
          // Hide notification after 3 seconds
          setTimeout(() => {
            setShowAutoUpdateNotification(false)
          }, 3000)
        }
      }, 1000) // 1 second delay
    }

    // Cleanup timeout on unmount
    return () => {
      if (autoUpdateTimeoutRef.current) {
        clearTimeout(autoUpdateTimeoutRef.current)
      }
    }
  }, [startFolder, videoMoveTarget, setVideoMoveTarget, setShowAutoUpdateNotification])

  // Socket connection management - Only connect once
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      // Prevent rapid reconnections
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
      autoConnect: true
    })
    
    socketRef.current = newSocket
    setSocket(newSocket)

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Connected to server')
      setConnectionStatus('connected')
    })

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason)
      setConnectionStatus('disconnected')
    })

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      setConnectionStatus('error')
    })

    // Setup event handlers immediately
    // Status event handler
    newSocket.on('status', (data: StatusData) => {
      console.log('Status received:', data)
      
      if (data.stage !== undefined) {
        setStage(data.stage)
      }
      
      if (data.detailedStage !== undefined) {
        setDetailedStage(data.detailedStage)
      }
      
      if (data.logs !== undefined) {
        setLogs(data.logs)
      }
      
      if (data.progress !== undefined) {
        // Convert generic progress to typed Progress interface
        const typedProgress: Progress = {
          TotalVideos: data.progress.TotalVideos || 0,
          ProcessedVideos: data.progress.ProcessedVideos || 0,
          PhotosToDelete: data.progress.PhotosToDelete || 0,
          VideosToDelete: data.progress.VideosToDelete || 0,
          FoldersToDelete: data.progress.FoldersToDelete || 0,
          VideosToMove: data.progress.VideosToMove || 0,
        }
        setProgress(typedProgress)
      }
    })

    // Error event handler
    newSocket.on('error', (data: ErrorData) => {
      console.error('Error received:', data)
      setErrors(prev => [...prev, data.message])
    })

    // Scan results event handler
    newSocket.on('scanResults', (data: ScanResultsData) => {
      console.log('Scan results received:', data)
      // Convert ScanResultsData to ScanResults format
      const convertedResults: ScanResults = {
        photosToDelete: data.photosToDelete,
        shortVideosToDelete: data.shortVideosToDelete,
        longVideosToMove: data.longVideosToMove,
        emptyFoldersToDelete: data.emptyFoldersToDelete,
        progress: {
          TotalVideos: data.progress.TotalVideos || 0,
          ProcessedVideos: data.progress.ProcessedVideos || 0,
          PhotosToDelete: data.progress.PhotosToDelete || 0,
          VideosToDelete: data.progress.VideosToDelete || 0,
          FoldersToDelete: data.progress.FoldersToDelete || 0,
          VideosToMove: data.progress.VideosToMove || 0,
        }
      }
      setScanResults(convertedResults)
    })

    // Log files event handler
    newSocket.on('logFiles', (data: LogFilesData) => {
      console.log('Log files received:', data)
      setLogFiles(data.logFiles)
    })

    // File choice dialog event handler
    newSocket.on('fileChoiceDialog', (data: FileChoiceData) => {
      console.log('File choice dialog received:', data)
      setFileChoiceMessage(data.message)
      // Convert generic Record to FileLists
      const convertedLists: FileLists = {
        photoFiles: data.fileLists.photoFiles || [],
        shortVideos: data.fileLists.shortVideos || [],
        longVideos: data.fileLists.longVideos || [],
        emptyFolders: data.fileLists.emptyFolders || [],
      }
      setFileLists(convertedLists)
      setShowFileChoiceDialog(true)
    })

    // Folder contents event handler
    newSocket.on('folderContents', (data: FolderContentsData) => {
      console.log('Folder contents received:', data)
      setFolderContents(data)
    })

    // Cleanup function
    return () => {
      newSocket.disconnect()
      socketRef.current = null
      setSocket(null)
      setConnectionStatus('disconnected')
    }
  }, []) // Empty dependency array - only connect once!

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoUpdateTimeoutRef.current) {
        clearTimeout(autoUpdateTimeoutRef.current)
      }
    }
  }, [])
}
