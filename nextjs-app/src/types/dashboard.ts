// Types for the automation dashboard application
export interface ConnectionStatus {
  status: 'connected' | 'disconnected' | 'error';
  message?: string;
}

export interface ProcessingStage {
  stage: 'idle' | 'scanning' | 'processing' | 'waiting' | 'done' | 'error';
  progress?: number;
  message?: string;
}

export interface ValidationErrors {
  [key: string]: string | undefined;
}

export interface ScanProgress {
  totalVideos?: number;
  processedVideos?: number;
  photosToDelete?: number;
  currentFile?: string;
}

export interface FileEntry {
  path: string;
  name: string;
  size: number;
  type: 'photo' | 'video';
  duration?: number;
  shouldDelete?: boolean;
}

export interface AppState {
  // Connection
  connectionStatus: ConnectionStatus['status'];
  socket: any;
  
  // Processing
  stage: ProcessingStage['stage'];
  detailedStage: string;
  logs: string[];
  progress: ScanProgress;
  errors: string[];
  
  // Configuration
  startFolder: string;
  videoMoveTarget: string;
  minDurationSeconds: number;
  isDryRun: boolean;
  
  // Results
  scanResults: FileEntry[];
  logFiles: string[];
  fileLists: any;
  
  // UI State
  showFileChoiceDialog: boolean;
  fileChoiceMessage: string;
  showAutoUpdateNotification: boolean;
  
  // Validation
  validationErrors: ValidationErrors;
  
  // State setters
  setSocket: (socket: any) => void;
  setConnectionStatus: (status: ConnectionStatus['status']) => void;
  setStage: (stage: ProcessingStage['stage']) => void;
  setDetailedStage: (stage: string) => void;
  setLogs: (logs: string[]) => void;
  setProgress: (progress: ScanProgress) => void;
  setErrors: (errors: string[]) => void;
  setScanResults: (results: FileEntry[]) => void;
  setLogFiles: (files: string[]) => void;
  setFileLists: (lists: any) => void;
  setVideoMoveTarget: (target: string) => void;
  setShowFileChoiceDialog: (show: boolean) => void;
  setFileChoiceMessage: (message: string) => void;
  setShowAutoUpdateNotification: (show: boolean) => void;
  setStartFolder: (folder: string) => void;
  setMinDurationSeconds: (duration: number) => void;
  setIsDryRun: (isDryRun: boolean) => void;
  setValidationErrors: (errors: ValidationErrors) => void;
}

export interface FolderBrowserState {
  folderContents: any[];
  setFolderContents: (contents: any[]) => void;
}

export type DashboardTab = 'dashboard' | 'file-scanner';

export interface SystemStats {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  uptime: string;
}
