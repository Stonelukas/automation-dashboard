// testFileOps.js - Test script for Node.js file operations
const FileOperationsService = require('./fileOperations');
const path = require('path');

// Mock Socket.IO for testing
const mockIO = {
  emit: (event, data) => {
    console.log(`[${event}]`, JSON.stringify(data, null, 2));
  }
};

async function testFileOperations() {
  console.log('Testing Node.js File Operations Service...\n');
  
  const service = new FileOperationsService(mockIO);
  
  // Test configuration
  const testConfig = {
    startFolder: path.join(__dirname, '..', 'test_files'),
    minVideoLengthSec: 30,
    photoExtensions: 'jpg,jpeg,png,gif,bmp,tiff',
    videoExtensions: 'mp4,avi,mov,wmv,flv,mkv,webm',
    deleteEmptyFolders: true,
    moveVideos: true,
    ignoreFolders: [],
    videoMoveTarget: path.join(__dirname, '..', 'test_files', 'SortedVideos')
  };
  
  console.log('Test configuration:', testConfig);
  console.log('\n--- Starting Test Scan ---\n');
  
  try {
    const results = await service.performScan(testConfig);
    
    if (results) {
      console.log('\n--- Scan Results ---');
      console.log(`Photos found: ${results.photoFiles.length}`);
      console.log(`Short videos found: ${results.shortVideos.length}`);
      console.log(`Long videos found: ${results.longVideos.length}`);
      console.log(`Empty folders found: ${results.emptyFolders.length}`);
      
      if (results.photoFiles.length > 0) {
        console.log('\nPhoto files:');
        results.photoFiles.forEach(file => {
          console.log(`  - ${file.name} (${service.formatFileSize(file.size)})`);
        });
      }
      
      if (results.shortVideos.length > 0) {
        console.log('\nShort videos:');
        results.shortVideos.forEach(file => {
          console.log(`  - ${file.name} (${service.formatFileSize(file.size)})`);
        });
      }
      
      if (results.longVideos.length > 0) {
        console.log('\nLong videos:');
        results.longVideos.forEach(file => {
          console.log(`  - ${file.name} (${service.formatFileSize(file.size)})`);
        });
      }
      
      console.log('\n--- Test Completed Successfully ---');
    } else {
      console.log('Scan was aborted or failed');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testFileOperations().catch(console.error);
