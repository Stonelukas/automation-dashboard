# File Cleanup Automation Dashboard - Copilot Instructions

## Architecture Overview

This is a 3-tier real-time file cleanup automation system:
- **Frontend**: React SPA with Socket.IO client (`frontend/src/`)
- **Backend**: Node.js Express server with Socket.IO and REST API (`backend/server.js`)
- **Automation**: PowerShell script for file operations (`cleanup.ps1`)

### Key Communication Flow
1. React frontend → Socket.IO events → Node.js backend
2. Backend spawns PowerShell process with JSON stdout communication
3. PowerShell uses `Write-Status` with structured JSON for real-time updates
4. Backend relays updates via Socket.IO to frontend
5. REST API endpoints for file serving and system integration

### Enhanced Features
- **File Management**: Interactive file preview, sorting, and exclusion system
- **Real-time Updates**: Dynamic progress tracking with Socket.IO
- **System Integration**: Cross-platform file opening with default applications
- **Advanced UI**: FileListModal component with comprehensive file operations

## Critical Patterns

### Socket.IO Event Schema
Events follow this pattern in `backend/server.js`:
```javascript
// PowerShell → Backend → Frontend
socket.emit('status', {
  stage: 'scanning|waiting|running|done|aborted',
  progress: { TotalVideos, ProcessedVideos, PhotosToDelete, ... },
  logs: string[]
})
```

### REST API Endpoints
Backend provides file operation endpoints:
```javascript
// File serving with query parameters
app.get('/api/file', (req, res) => {
  // Serves files with proper MIME types
  // Query params: file (path), t (cache-busting timestamp)
})

// System file opening
app.post('/api/open-file', (req, res) => {
  // Opens files with system default applications
  // Cross-platform support (Windows, macOS, Linux)
})
```

### PowerShell JSON Communication
PowerShell script uses `Write-Status` function with specific message types:
```powershell
Write-Status @{ type = "status"; stage = "scanning"; isDryRun = $true }
Write-Status @{ type = "progress"; processed = $count; total = $total }
Write-Status @{ type = "log"; message = "[DRY RUN] Would delete file: example.jpg" }
```

### Dry Run Testing
- PowerShell script supports `-DryRun` switch for safe testing
- Simulates all operations without file modifications
- Frontend UI adapts to show preview mode with blue indicators
- All log messages prefixed with `[DRY RUN]` during simulation

### React State Management
Frontend uses a centralized state pattern in `App.js`:
- `useLocalStorage` hook for persistent user settings (including dry run preference)
- `useDebounce` hook for input validation
- Error boundary wrapping for crash prevention
- Dry run mode for safe testing without file modifications
- FileListModal state management for advanced file operations

## Development Workflows

### Development Mode
```bash
# Start both servers with hot reload
npm run dev
# Or use PowerShell helper script
.\start-dev.ps1
```

### Production Build
```bash
npm run start:prod  # Builds frontend, serves from backend
.\start-prod.ps1    # PowerShell equivalent
```

### Terminal Operation Guidelines
- **Timeout Policy**: When reading from terminal output, if operation takes more than 1 minute, abort waiting and continue with next steps
- **Non-blocking Operations**: Prefer background processes for long-running tasks
- **Process Management**: Use `isBackground: true` for terminal operations that may take extended time

### Component Structure
Components follow this pattern:
- `components/` - Pure presentational components with inline styles
- `hooks/` - Custom hooks for reusable logic
- `utils/` - Pure utility functions (validation, formatting)

### FileListModal Component
Advanced file management modal with comprehensive features:
```javascript
// Component features
- File preview (images and videos with playback controls)
- Multi-criteria sorting (name, size, duration)
- File exclusion with dynamic progress updates
- System integration for opening files with default applications
- Modal layering with z-index 10000 to prevent conflicts
- Error handling with graceful fallbacks for unsupported file types
```

## File System Integration

### Inter-Process Communication
Backend communicates with PowerShell via:
- **Command args**: Process spawn with sanitized parameters
- **File signals**: `confirm.txt`/`cancel.txt` for user decisions
- **JSON stdout**: Structured status updates from PowerShell

### Path Handling
All paths go through validation in `utils/validation.js`:
```javascript
validatePath(path) // Prevents path traversal attacks
sanitizeInput(input) // Removes dangerous characters
```

## Security Considerations

- Input sanitization on all user inputs before PowerShell execution
- Path validation prevents directory traversal
- CORS configured for development vs production
- No direct file system access from frontend

## Component Integration

### Status Display
StatusBadge component maps process stages to colors:
- `idle/disconnected` → gray
- `scanning/running` → orange  
- `waiting` → blue
- `done` → green
- `aborted/error` → red

### Error Handling
Three-tier error handling:
1. **PowerShell**: `Handle-Error` function logs to JSON
2. **Backend**: `handlePowerShellMessage` processes errors
3. **Frontend**: Error boundary prevents crashes, error state for user feedback

## External Dependencies

- **FFmpeg**: Required for video duration analysis in PowerShell
- **Socket.IO**: Real-time bidirectional communication
- **React 19**: Modern React with hooks
- **Express**: Static file serving and API endpoints

## Key Files to Understand

- `backend/server.js` - WebSocket event handling and PowerShell orchestration
- `frontend/src/App.js` - Main React component with state management
- `frontend/src/components/FileListModal.js` - Advanced file management modal
- `backend/fileOperations.js` - File scanning service with video duration analysis
- `cleanup.ps1` - Core automation logic with JSON communication
- `package.json` (root) - Workspace orchestration scripts
- `frontend/src/hooks/useUtilities.js` - Custom hooks for debouncing and persistence
