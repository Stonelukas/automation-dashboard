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
  },
  // Enhanced connection configuration for better performance and reliability
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  allowEIO3: true,
  transports: ['websocket', 'polling'],
  // Connection management optimizations
  connectTimeout: 45000,
  upgradeTimeout: 10000,
  // Compression for better performance
  compression: true,
  // Security improvements
  allowRequest: (req, callback) => {
    const origin = req.headers.origin;
    const isAllowed = process.env.NODE_ENV === 'production' 
      ? origin === process.env.ALLOWED_ORIGIN 
      : true;
    callback(null, isAllowed);
  },
  // Rate limiting to prevent abuse
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
  // Performance monitoring
  adapter: undefined, // Can be extended with Redis adapter for scaling
});

// File operations service - shared singleton instance for all connections
// This prevents memory leaks and ensures operations are properly serialized
let fileOpsService = null;

// Socket handlers - shared singleton instance
let socketHandlers = null;

// Initialize services once at startup
const initializeServices = () => {
  if (!fileOpsService) {
    fileOpsService = new FileOperationsService(io);
    console.log('FileOperationsService initialized');
  }
  if (!socketHandlers) {
    socketHandlers = new SocketHandlers(io, fileOpsService);
    console.log('SocketHandlers initialized');
  }
};

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
  // Initialize services if not already initialized (singleton pattern)
  initializeServices();
  
  // Setup all socket event handlers for this connection
  // Services are shared across all connections to prevent memory leaks
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
