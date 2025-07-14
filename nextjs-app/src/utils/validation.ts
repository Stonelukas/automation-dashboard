/**
 * Validates if a path is valid and safe to use
 */
export function validatePath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false
  }

  // Trim whitespace
  const trimmedPath = path.trim()
  
  // Check for empty or just dot
  if (trimmedPath === '' || trimmedPath === '.') {
    return true // Allow current directory
  }

  // Check for dangerous characters or patterns
  const dangerousPatterns = [
    /\.\./,           // Parent directory traversal
    /[<>"|?*]/,       // Invalid filename characters
    /^con$|^prn$|^aux$|^nul$/i, // Windows reserved names
    /^com[1-9]$|^lpt[1-9]$/i    // Windows reserved device names
  ]

  return !dangerousPatterns.some(pattern => pattern.test(trimmedPath))
}

/**
 * Validates file extensions string
 */
export function validateExtensions(extensions: string): boolean {
  if (!extensions || typeof extensions !== 'string') {
    return false
  }

  // Split by comma and validate each extension
  const extArray = extensions.split(',').map(ext => ext.trim())
  
  return extArray.every(ext => {
    // Check if extension is valid (alphanumeric, starts with letter)
    return /^[a-zA-Z][a-zA-Z0-9]{0,9}$/.test(ext)
  })
}

/**
 * Validates numeric input
 */
export function validateNumber(value: string | number, min = 0, max = Infinity): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return !isNaN(num) && num >= min && num <= max
}

/**
 * Sanitizes user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/["|']/g, '') // Remove quotes
    .trim()
}

/**
 * Validates folder ignore list
 */
export function validateIgnoreFolders(ignoreFolders: string): boolean {
  if (!ignoreFolders) {
    return true // Empty is valid
  }

  const folders = ignoreFolders.split(',').map(folder => folder.trim())
  return folders.every(folder => validatePath(folder) || folder === '')
}
