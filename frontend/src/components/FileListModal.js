import React, { useState } from 'react';

const FileListModal = ({ 
  isOpen, 
  onClose, 
  title, 
  files, 
  action, // 'delete', 'move', or 'remove'
  moveTarget = null,
  onFilesExcluded = null // Callback when files are excluded
}) => {
  const [excludedFiles, setExcludedFiles] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [previewFile, setPreviewFile] = useState(null); // For preview modal
  const [showPreview, setShowPreview] = useState(false);

  if (!isOpen) return null;

  const formatFileSize = (bytes) => {
    if (bytes > 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else if (bytes > 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else if (bytes > 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${bytes} bytes`;
    }
  };

  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) {
      return 'Unknown duration';
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const isVideo = (fileName) => {
    const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'];
    const ext = fileName.split('.').pop().toLowerCase();
    return videoExtensions.includes(ext);
  };

  const isImage = (fileName) => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'];
    const ext = fileName.split('.').pop().toLowerCase();
    return imageExtensions.includes(ext);
  };

  const canPreview = (fileName) => {
    return isImage(fileName) || isVideo(fileName);
  };

  const openPreview = (file) => {
    setPreviewFile(file);
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewFile(null);
  };

  const openInSystem = async (file) => {
    try {
      // Request backend to open file in system default application
      const response = await fetch('http://localhost:8080/api/open-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: file.path })
      });
      
      if (!response.ok) {
        console.error('Failed to open file in system');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      // Fallback: show file path for user to copy
      navigator.clipboard.writeText(file.path).then(() => {
        alert(`File path copied to clipboard: ${file.path}`);
      }).catch(() => {
        prompt('File path (copy this):', file.path);
      });
    }
  };

  const hasVideosInList = files.some(file => isVideo(file.name));

  const getSortOptions = () => {
    const baseOptions = [
      { value: 'name', label: 'Name' },
      { value: 'size', label: 'Size' }
    ];
    
    if (hasVideosInList) {
      baseOptions.push({ value: 'duration', label: 'Duration' });
    }
    
    return baseOptions;
  };

  const handleSort = (newSortBy) => {
    if (sortBy === newSortBy) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortBy(newSortBy);
      setSortDirection('asc');
    }
  };

  const sortFiles = (filesToSort) => {
    return [...filesToSort].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'size':
          aValue = a.size || 0;
          bValue = b.size || 0;
          break;
        case 'duration':
          aValue = a.duration || 0;
          bValue = b.duration || 0;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }
      
      if (sortBy === 'name') {
        // String comparison
        if (sortDirection === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      } else {
        // Numeric comparison
        if (sortDirection === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      }
    });
  };

  const sortedFiles = sortFiles(files);

  const toggleFileExclusion = (filePath) => {
    const newExcluded = new Set(excludedFiles);
    if (newExcluded.has(filePath)) {
      newExcluded.delete(filePath);
    } else {
      newExcluded.add(filePath);
    }
    setExcludedFiles(newExcluded);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setExcludedFiles(new Set());
    } else {
      setExcludedFiles(new Set(sortedFiles.map(f => f.path)));
    }
    setSelectAll(!selectAll);
  };

  const handleApplyExclusions = () => {
    if (onFilesExcluded) {
      onFilesExcluded(Array.from(excludedFiles));
    }
    onClose();
  };

  const includedCount = files.length - excludedFiles.size;
  const excludedCount = excludedFiles.size;

  const getActionText = () => {
    switch (action) {
      case 'delete':
        return 'Will be deleted';
      case 'move':
        return `Will be moved to: ${moveTarget}`;
      case 'remove':
        return 'Will be removed (empty folders)';
      default:
        return 'Will be processed';
    }
  };

  const getActionColor = () => {
    switch (action) {
      case 'delete':
        return '#dc3545'; // Red
      case 'move':
        return '#007bff'; // Blue
      case 'remove':
        return '#ffc107'; // Yellow
      default:
        return '#6c757d'; // Gray
    }
  };

  const totalSize = sortedFiles.reduce((sum, file) => sum + (file.size || 0), 0);

  return (
    <>
      {/* Preview Modal */}
      {showPreview && previewFile && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={closePreview}
        >
          <div 
            style={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%',
              background: 'white',
              borderRadius: '8px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Header */}
            <div style={{
              padding: '15px',
              borderBottom: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8f9fa'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                  {previewFile.name}
                </h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
                  {formatFileSize(previewFile.size || 0)}
                  {previewFile.duration && ` • ${formatDuration(previewFile.duration)}`}
                </p>
              </div>
              <button
                onClick={closePreview}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                ✕ Close
              </button>
            </div>

            {/* Preview Content */}
            <div style={{
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px',
              background: '#f8f9fa'
            }}>
              {isImage(previewFile.name) ? (
                <img
                  src={`http://localhost:8080/api/file?path=${encodeURIComponent(previewFile.path)}`}
                  alt={previewFile.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                    borderRadius: '4px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : (
                <video
                  controls
                  style={{
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    borderRadius: '4px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                >
                  <source src={`http://localhost:8080/api/file?path=${encodeURIComponent(previewFile.path)}`} />
                  Your browser does not support the video tag.
                </video>
              )}
              
              {/* Error fallback */}
              <div style={{
                display: 'none',
                textAlign: 'center',
                color: '#666',
                fontSize: '14px'
              }}>
                <p>Unable to preview this file.</p>
                <p>The file may be corrupted or in an unsupported format.</p>
                <button
                  onClick={() => openInSystem(previewFile)}
                  style={{
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    marginTop: '10px'
                  }}
                >
                  Open with System Default
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main File List Modal */}
      {!showPreview && (
        <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5000
      }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '80vh',
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #dee2e6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, color: '#333' }}>{title}</h3>
            <p style={{ 
              margin: '5px 0 0 0', 
              color: getActionColor(),
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              {getActionText()}
            </p>
            <p style={{ 
              margin: '2px 0 0 0', 
              color: '#666',
              fontSize: '12px'
            }}>
              {files.length} files • Total size: {formatFileSize(totalSize)}
              {sortBy !== 'name' || sortDirection !== 'asc' ? (
                <span style={{ color: '#007bff', fontWeight: 'bold', marginLeft: '8px' }}>
                  (Sorted by {getSortOptions().find(opt => opt.value === sortBy)?.label} {sortDirection === 'asc' ? '↑' : '↓'})
                </span>
              ) : null}
            </p>
            <div style={{ 
              margin: '8px 0 0 0', 
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
              fontSize: '12px',
              flexWrap: 'wrap'
            }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '5px',
                cursor: 'pointer',
                color: '#007bff'
              }}>
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
                Select All for Exclusion
              </label>
              
              {/* Sort Controls */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                borderLeft: '1px solid #dee2e6',
                paddingLeft: '15px'
              }}>
                <span style={{ color: '#666', fontWeight: 'bold' }}>Sort by:</span>
                {getSortOptions().map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleSort(option.value)}
                    style={{
                      background: sortBy === option.value ? '#007bff' : 'transparent',
                      color: sortBy === option.value ? 'white' : '#007bff',
                      border: '1px solid #007bff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {option.label}
                    {sortBy === option.value && (
                      <span style={{ fontSize: '10px' }}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              
              <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                ✓ {includedCount} will be processed
              </span>
              {excludedCount > 0 && (
                <span style={{ color: '#dc3545', fontWeight: 'bold' }}>
                  ✗ {excludedCount} excluded
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#999',
              padding: '0',
              width: '30px',
              height: '30px'
            }}
          >
            ×
          </button>
        </div>

        {/* File List */}
        <div style={{
          maxHeight: 'calc(80vh - 220px)', // Increased header height for sort controls
          overflow: 'auto',
          padding: '0'
        }}>
          {files.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: '#666'
            }}>
              No files to display
            </div>
          ) : (
            <div>
              {sortedFiles.map((file, index) => {
                const isExcluded = excludedFiles.has(file.path);
                const isVideoFile = isVideo(file.name);
                
                return (
                  <div
                    key={file.path || index}
                    style={{
                      padding: '12px 20px',
                      borderBottom: index < sortedFiles.length - 1 ? '1px solid #f8f9fa' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      backgroundColor: isExcluded ? '#fff3cd' : 'transparent',
                      opacity: isExcluded ? 0.7 : 1,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isExcluded) {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isExcluded ? '#fff3cd' : 'transparent';
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start',
                      gap: '12px',
                      flex: 1,
                      minWidth: 0 
                    }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        marginTop: '2px'
                      }}>
                        <input
                          type="checkbox"
                          checked={isExcluded}
                          onChange={() => toggleFileExclusion(file.path)}
                          style={{ 
                            cursor: 'pointer',
                            width: '16px',
                            height: '16px'
                          }}
                        />
                      </label>
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 'bold',
                          color: isExcluded ? '#856404' : '#333',
                          fontSize: '14px',
                          marginBottom: '2px',
                          wordBreak: 'break-all',
                          textDecoration: isExcluded ? 'line-through' : 'none'
                        }}>
                          {file.name}
                          {isExcluded && (
                            <span style={{ 
                              marginLeft: '8px',
                              fontSize: '12px',
                              color: '#dc3545',
                              fontWeight: 'normal'
                            }}>
                              (EXCLUDED)
                            </span>
                          )}
                        </div>
                        <div style={{
                          color: '#666',
                          fontSize: '12px',
                          wordBreak: 'break-all',
                          marginBottom: '2px'
                        }}>
                          {file.path}
                        </div>
                        
                        <div style={{
                          display: 'flex',
                          gap: '15px',
                          fontSize: '11px',
                          marginTop: '4px',
                          flexWrap: 'wrap',
                          alignItems: 'center'
                        }}>
                          {file.lastModified && (
                            <span style={{ color: '#888' }}>
                              📅 Modified: {new Date(file.lastModified).toLocaleString()}
                            </span>
                          )}
                          
                          {isVideoFile && file.duration !== undefined && (
                            <span style={{ 
                              color: '#007bff',
                              fontWeight: 'bold'
                            }}>
                              🎬 Duration: {formatDuration(file.duration)}
                            </span>
                          )}

                          {/* Preview/Open buttons */}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                            {canPreview(file.name) && (
                              <button
                                onClick={() => openPreview(file)}
                                style={{
                                  background: '#17a2b8',
                                  color: 'white',
                                  border: 'none',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '10px',
                                  fontWeight: 'bold'
                                }}
                                title={`Preview ${isImage(file.name) ? 'image' : 'video'}`}
                              >
                                {isImage(file.name) ? '🖼️ Preview' : '▶️ Play'}
                              </button>
                            )}
                            
                            <button
                              onClick={() => openInSystem(file)}
                              style={{
                                background: '#6c757d',
                                color: 'white',
                                border: 'none',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: 'bold'
                              }}
                              title="Open with system default application"
                            >
                              🔗 Open
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{
                      marginLeft: '12px',
                      textAlign: 'right',
                      flexShrink: 0
                    }}>
                      <div style={{
                        color: '#333',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {formatFileSize(file.size || 0)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '15px 20px',
          borderTop: '1px solid #dee2e6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#666'
          }}>
            {excludedCount > 0 ? (
              <span>
                <strong style={{ color: '#dc3545' }}>{excludedCount}</strong> files will be excluded from cleanup
              </span>
            ) : (
              <span>All files will be processed</span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            
            {onFilesExcluded && (
              <button
                onClick={handleApplyExclusions}
                style={{
                  backgroundColor: excludedCount > 0 ? '#dc3545' : '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {excludedCount > 0 ? `Exclude ${excludedCount} Files` : 'Proceed with All Files'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
      )}
    </>
  );
};

export default FileListModal;
