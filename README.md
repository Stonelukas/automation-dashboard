# File Cleanup Automation Dashboard

A modern web-based dashboard for automating file cleanup tasks with real-time progress tracking and user confirmation.

## Features

- **Real-time Progress Tracking**: Live updates during file scanning and cleanup operations
- **File Preview & Inspection**: Preview images and play videos directly in the browser before cleanup
- **Interactive File Management**: View, sort, and exclude files from cleanup operations
- **User Confirmation**: Review changes with detailed file lists before execution
- **Configurable Settings**: Customize start folders, ignore lists, and move targets
- **Input Validation**: Prevent invalid paths and configurations
- **Error Handling**: Comprehensive error reporting and recovery
- **Persistent Settings**: Automatically save and restore user preferences
- **System Integration**: Open files with default system applications
- **Advanced Sorting**: Sort files by name, size, or video duration
- **File Exclusion**: Select specific files to exclude from cleanup operations
- **Modern UI**: Clean, responsive interface with status indicators and modal dialogs

## Architecture

- **Frontend**: React.js with Socket.IO client
- **Backend**: Node.js with Express and Socket.IO
- **Automation**: PowerShell script for file operations
- **Real-time Communication**: WebSocket connections for live updates

## What It Does

The cleanup script performs the following operations:

1. **Scans** the specified directory for files with real-time progress updates
2. **Analyzes** video durations using FFmpeg for intelligent categorization
3. **Categorizes** files:
   - Photos (JPG, PNG, GIF, etc.) → Marked for deletion
   - Short videos (< 9 seconds) → Marked for deletion
   - Long videos (≥ 9 seconds) → Marked for moving
   - Empty folders → Marked for deletion
4. **Presents** interactive summary cards with clickable file counts
5. **Allows** detailed file inspection with:
   - Image preview with full-screen viewing
   - Video playback with native browser controls
   - File sorting by name, size, or duration
   - Individual file exclusion from cleanup operations
   - System file opening integration
6. **Waits** for user confirmation with excluded file handling
7. **Executes** the cleanup operations on confirmed files only

## Prerequisites

- Node.js (v14 or higher)
- PowerShell (Windows)
- FFmpeg (for video duration analysis)

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd automation-dashboard
   ```

2. **Install backend dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**:
   ```bash
   cd ../frontend
   npm install
   ```

4. **Install FFmpeg** (if not already installed):
   - Download from https://ffmpeg.org/download.html
   - Add to your system PATH

## Configuration

### Environment Variables

**Backend (.env)**:
```
PORT=8080
NODE_ENV=development
```

**Frontend (.env)**:
```
REACT_APP_SOCKET_URL=http://localhost:8080
```

### Application Settings

Configure through the web interface:
- **Start Folder**: Root directory to scan
- **Video Move Target**: Destination for long videos
- **Ignore Folders**: Comma-separated list of folders to skip

## Architecture

### System Overview
This is a 3-tier real-time file cleanup automation system:

1. **Frontend (React SPA)**
   - Interactive dashboard with Socket.IO client
   - Real-time progress updates and file management
   - Advanced file preview and interaction capabilities
   - Responsive UI with modern design patterns

2. **Backend (Node.js + Express)**
   - RESTful API endpoints for file operations
   - Socket.IO server for real-time communication
   - File serving and system integration
   - CORS handling for development flexibility

3. **Automation Layer (PowerShell)**
   - File scanning and analysis with FFmpeg integration
   - JSON-based communication with backend
   - Dry run mode for safe testing
   - Comprehensive error handling and logging

### Communication Flow
```
React Frontend ←→ Socket.IO ←→ Node.js Backend ←→ PowerShell Script
      ↓                              ↓
File Management UI              JSON Communication
   - Preview files                - Real-time status
   - Sort & filter               - Progress updates
   - Exclude files               - Error handling
   - System integration
```

### Key Features Architecture
- **Real-time Updates**: Socket.IO enables instant progress feedback
- **File Preview System**: In-browser image display and video playback
- **Advanced Sorting**: Multi-criteria sorting (name, size, duration)
- **File Exclusion**: Dynamic removal from cleanup operations
- **System Integration**: Cross-platform file opening with default applications
- **Error Boundaries**: Comprehensive error handling and recovery

## Usage

### Development Mode

1. **Start the backend server**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend** (in a new terminal):
   ```bash
   cd frontend
   npm start
   ```

3. **Access the dashboard**:
   Open http://localhost:3000 in your browser

### Production Mode

1. **Build the frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Start the backend**:
   ```bash
   cd backend
   npm start
   ```

3. **Access the dashboard**:
   Open http://localhost:8080 in your browser

## File Structure

```
automation-dashboard/
├── backend/
│   ├── server.js          # Main server file with API endpoints
│   ├── fileOperations.js  # File scanning and analysis service  
│   ├── package.json       # Backend dependencies
│   └── .env              # Environment variables
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── FileListModal.js    # Advanced file management modal
│   │   │   ├── StatusBadge.js      # Status indicator component
│   │   │   ├── ProgressBar.js      # Progress visualization
│   │   │   ├── LogViewer.js        # Activity log viewer
│   │   │   └── ErrorBoundary.js    # Error handling wrapper
│   │   ├── hooks/         # Custom hooks
│   │   │   └── useUtilities.js     # Debouncing and localStorage hooks
│   │   ├── utils/         # Utility functions
│   │   │   └── validation.js       # Path validation and input sanitization
│   │   └── App.js         # Main application with state management
│   ├── package.json       # Frontend dependencies
│   └── .env              # Frontend environment variables
├── cleanup.ps1            # PowerShell cleanup script with JSON communication
├── start-dev.ps1          # Development environment startup script
├── start-prod.ps1         # Production environment startup script
├── test_files/            # Sample files for testing
└── README.md              # This file
```

## API Reference

### Socket.IO Events

**Client → Server**:
- `startCleanup`: Begin cleanup process with parameters
- `confirm`: Confirm cleanup execution
- `cancel`: Cancel cleanup operation

**Server → Client**:
- `status`: Status updates and progress information
- `error`: Error messages

## Security Considerations

- **Path Validation**: Prevents path traversal attacks
- **Input Sanitization**: Removes potentially dangerous characters
- **CORS Configuration**: Restricts cross-origin requests in production
- **Error Handling**: Prevents information leakage

## Error Handling

The application includes comprehensive error handling:
- **Connection Errors**: Automatic reconnection with exponential backoff
- **Validation Errors**: Real-time input validation with user feedback
- **Operation Errors**: Graceful handling of file system errors
- **Error Boundaries**: React error boundaries prevent crashes

## Performance Optimizations

- **Debounced Input**: Prevents excessive validation calls
- **Persistent Settings**: Local storage for user preferences
- **Efficient Updates**: Only re-render when necessary
- **Progress Batching**: Batched progress updates to prevent UI flooding

## Troubleshooting

### Common Issues

1. **Connection Failed**:
   - Ensure backend server is running
   - Check firewall settings
   - Verify SOCKET_URL configuration

2. **PowerShell Execution Error**:
   - Check PowerShell execution policy
   - Ensure FFmpeg is installed and accessible
   - Verify file permissions

3. **Path Validation Errors**:
   - Use absolute paths
   - Avoid special characters
   - Check folder existence

### Debugging

Enable debug logging by setting:
```bash
DEBUG=socket.io:* npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions, please create an issue in the repository.
