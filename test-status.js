// Temporary test to check status emission
console.log('Testing status emission structure...');

// Simulate backend data structure
const mockStatus = {
  stage: 'scanning',
  progress: {
    photosToDelete: 10,
    videosToDelete: 82,
    videosToMove: 15,
    foldersToDelete: 5,
    fileLists: {
      photoFiles: [
        { path: '/test/photo1.jpg', name: 'photo1.jpg', size: 1024 },
        { path: '/test/photo2.jpg', name: 'photo2.jpg', size: 2048 }
      ],
      shortVideos: [
        { path: '/test/video1.mp4', name: 'video1.mp4', size: 5120, duration: 15 },
        { path: '/test/video2.mp4', name: 'video2.mp4', size: 8192, duration: 20 }
      ],
      longVideos: [
        { path: '/test/longvideo1.mp4', name: 'longvideo1.mp4', size: 102400, duration: 120 }
      ],
      emptyFolders: [
        { path: '/test/empty1', name: 'empty1' }
      ]
    }
  },
  logs: [],
  isDryRun: false,
  // Also include direct properties for compatibility
  photosToDelete: 10,
  videosToDelete: 82,
  videosToMove: 15,
  foldersToDelete: 5,
  fileLists: {
    photoFiles: [
      { path: '/test/photo1.jpg', name: 'photo1.jpg', size: 1024 },
      { path: '/test/photo2.jpg', name: 'photo2.jpg', size: 2048 }
    ],
    shortVideos: [
      { path: '/test/video1.mp4', name: 'video1.mp4', size: 5120, duration: 15 },
      { path: '/test/video2.mp4', name: 'video2.mp4', size: 8192, duration: 20 }
    ],
    longVideos: [
      { path: '/test/longvideo1.mp4', name: 'longvideo1.mp4', size: 102400, duration: 120 }
    ],
    emptyFolders: [
      { path: '/test/empty1', name: 'empty1' }
    ]
  }
};

console.log('Mock status object:', JSON.stringify(mockStatus, null, 2));
console.log('status.fileLists:', mockStatus.fileLists);
console.log('status.progress.fileLists:', mockStatus.progress.fileLists);
