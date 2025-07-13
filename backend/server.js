require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const FileOperationsService = require('./fileOperations');
const SocketHandlers = require('./handlers/SocketHandlers');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST']
  }
});

// File operations service
let fileOpsService = null;

// Socket handlers
let socketHandlers = null;

// Middleware
app.use(express.json());

// Configure CORS for API routes
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

app.use(express.static(path.join(__dirname, '../frontend/build')));

// API Routes
app.use('/api', apiRoutes);

// Default port
const PORT = process.env.PORT || 8080;

// Environment logging
console.log('Environment:', process.env.NODE_ENV || 'development');

// Socket.io connection handling
io.on('connection', (socket) => {
  // Initialize file operations service for this socket
  fileOpsService = new FileOperationsService(io);
  
  // Initialize socket handlers
  socketHandlers = new SocketHandlers(io, fileOpsService);
  
  // Setup all socket event handlers
  socketHandlers.setupConnectionHandlers(socket);
});

// Route for the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  
  // Abort any running file operations
  if (fileOpsService) {
    fileOpsService.abort();
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Aborting operations but keeping server running...');
  
  // Abort any running file operations
  if (fileOpsService) {
    fileOpsService.abort();
    // Emit abort status to all connected clients
    io.emit('status', {
      stage: 'aborted',
      progress: {},
      isDryRun: false
    });
  }
  
  // Don't shut down the server - just abort the operation
  // This allows the frontend to continue working and load scan results
  console.log('Operations aborted. Server continues running.');
});
