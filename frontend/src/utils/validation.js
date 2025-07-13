export const validatePath = (path) => {
  if (!path || typeof path !== 'string') return false;
  const trimmed = path.trim();
  
  // Allow empty string (current directory)
  if (trimmed.length === 0) return true;
  
  // Prevent path traversal attacks
  if (trimmed.includes('..')) return false;
  
  // Windows path validation - allow colons for drive letters and backslashes
  // Only reject truly invalid characters: < > " | ? *
  if (/[<>"|?*]/.test(trimmed)) return false;
  
  // Valid Windows path patterns
  const windowsPathPattern = /^([a-zA-Z]:\\|\\\\|\.\\?|[^\\])/;
  return windowsPathPattern.test(trimmed);
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  // Only remove truly dangerous characters, keep colons and backslashes for Windows paths
  return input.trim().replace(/[<>"|?*]/g, '');
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0s';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
};
