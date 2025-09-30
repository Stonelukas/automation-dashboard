const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// File serving endpoint for preview functionality
router.get('/file', (req, res) => {
  try {
    const requested = req.query.path || req.query.file;
    const filePath = requested ? decodeURIComponent(requested) : '';
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required as query parameter' });
    }
    
    // Security: Basic path validation to prevent directory traversal
    if (filePath.includes('..') || filePath.includes('~')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check if it's actually a file (not a directory)
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }
    
    // Get file extension to set appropriate content type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.mkv': 'video/x-matroska',
      '.webm': 'video/webm'
    };
    
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });
    
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// System file opening endpoint
router.post('/open-file', (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    // Security: Basic path validation
    if (filePath.includes('..') || filePath.includes('~')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Open the file using platform-specific opener with arguments, not shell
    const platform = process.platform;
    let child;
    if (platform === 'win32') {
      // Use cmd.exe built-in start requires shell, instead leverage powershell Start-Process safely
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', 'Start-Process', '-FilePath', filePath], { stdio: 'ignore' });
    } else if (platform === 'darwin') {
      child = spawn('open', [filePath], { stdio: 'ignore' });
    } else {
      child = spawn('xdg-open', [filePath], { stdio: 'ignore' });
    }
    child.on('error', (error) => {
      console.error('Error opening file:', error);
      return res.status(500).json({ error: 'Failed to open file' });
    });
    // Consider success once spawned
    res.json({ success: true, message: 'Open command dispatched' });
    
  } catch (error) {
    console.error('Error in open-file endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Browse folders endpoint for folder browser functionality
router.post('/browse-folders', (req, res) => {
  try {
    const { folderPath } = req.body;
    
    if (typeof folderPath !== 'string') {
      return res.status(400).json({ 
        success: false, 
        data: { error: 'Folder path must be a string' }
      });
    }

    // Import FileBrowserService
    const FileBrowserService = require('../services/FileBrowserService');
    const fileBrowserService = new FileBrowserService();
    
    // Call the browseFolders method
    const result = fileBrowserService.browseFolders(folderPath);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error in browse-folders endpoint:', error);
    res.status(500).json({ 
      success: false,
      data: { error: 'Internal server error' }
    });
  }
});

// Create folder endpoint
router.post('/create-folder', (req, res) => {
  try {
    const { folderPath, folderName } = req.body;
    
    if (typeof folderPath !== 'string' || typeof folderName !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Folder path and name must be strings' 
      });
    }

    // Import FileBrowserService
    const FileBrowserService = require('../services/FileBrowserService');
    const fileBrowserService = new FileBrowserService();
    
    // Call the createFolder method
    const result = fileBrowserService.createFolder(folderPath, folderName);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error in create-folder endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

module.exports = router;
