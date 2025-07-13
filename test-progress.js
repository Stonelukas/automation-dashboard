const io = require('socket.io-client');

// Connect to the socket
const socket = io('http://localhost:8080');

socket.on('connect', () => {
  console.log('Connected to server');
  
  // Listen for status updates
  socket.on('status', (data) => {
    console.log('Status update:', JSON.stringify(data, null, 2));
  });
  
  // Listen for progress updates
  socket.on('progress', (data) => {
    console.log('Progress update:', JSON.stringify(data, null, 2));
  });
  
  // Trigger a scan
  setTimeout(() => {
    console.log('Triggering scan...');
    socket.emit('scanOnly', {
      startFolder: 'h:\\Verschiedenes\\Gespeichert\\Games\\automation-dashboard\\test_files',
      photoExtensions: 'jpg,jpeg,png,gif,bmp',
      videoExtensions: 'mp4,avi,mkv,mov,wmv',
      minVideoLengthSec: 30,
      videoMoveTarget: 'h:\\Verschiedenes\\Gespeichert\\Games\\automation-dashboard\\test_files\\videos',
      deleteEmptyFolders: true,
      moveVideos: true,
      ignoreFolders: []
    });
  }, 1000);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
