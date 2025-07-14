import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useUtilities'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface FolderBrowserModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectFolder: (folderPath: string) => void
  currentPath?: string
}

interface FolderItem {
  name: string
  path: string
  isDirectory: boolean
  icon?: string
}

interface FolderContents {
  currentPath: string
  folders: FolderItem[]
  files: FolderItem[]
  error?: string
  isRootView?: boolean
}

export function FolderBrowserModal({ 
  isOpen, 
  onClose, 
  onSelectFolder, 
  currentPath = '' 
}: FolderBrowserModalProps) {
  const [folderContents, setFolderContents] = useState<FolderContents>({
    currentPath: '',
    folders: [],
    files: []
  })
  const [loading, setLoading] = useState(false)
  const [manualPath, setManualPath] = useState('')
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [createFolderLoading, setCreateFolderLoading] = useState(false)
  
  // Debounce the manual path input to avoid too many API calls
  const debouncedManualPath = useDebounce(manualPath, 500)

  // Load folder contents when modal opens or path changes
  useEffect(() => {
    if (isOpen) {
      const initialPath = currentPath || ''
      setManualPath(initialPath)
      loadFolderContents(initialPath)
    }
  }, [isOpen, currentPath])

  // Load folder contents when debounced path changes
  useEffect(() => {
    if (isOpen && debouncedManualPath !== folderContents.currentPath) {
      loadFolderContents(debouncedManualPath)
    }
  }, [debouncedManualPath, isOpen])

  // Add escape key handler and prevent body scroll
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = 'unset'
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const loadFolderContents = async (path: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/browse-folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderPath: path })
      })

      if (!response.ok) {
        throw new Error('Failed to browse folders')
      }

      const result = await response.json()
      
      if (result.success) {
        setFolderContents(result.data)
        setManualPath(result.data.currentPath)
      } else {
        setFolderContents({
          currentPath: path,
          folders: [],
          files: [],
          error: result.data?.error || 'Failed to load folder contents'
        })
      }
    } catch (error) {
      console.error('Error browsing folders:', error)
      setFolderContents({
        currentPath: path,
        folders: [],
        files: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFolderClick = (folder: FolderItem) => {
    setManualPath(folder.path)
    loadFolderContents(folder.path)
  }

  const getParentDirectory = (currentPath: string): string | null => {
    if (!currentPath) return null
    
    // Handle root directories (C:\, D:\, etc.)
    if (currentPath.match(/^[A-Za-z]:\\?$/)) {
      return null // Already at root
    }
    
    // Handle UNC paths (\\server\share)
    if (currentPath.startsWith('\\\\')) {
      const parts = currentPath.split('\\').filter(p => p)
      if (parts.length <= 2) {
        return null // At UNC root
      }
    }
    
    // For regular paths, get parent by going up one level
    const separator = currentPath.includes('\\') ? '\\' : '/'
    const parts = currentPath.split(separator).filter(p => p)
    
    if (parts.length <= 1) {
      return null // At root
    }
    
    parts.pop() // Remove last part
    
    if (currentPath.startsWith('\\\\')) {
      return '\\\\' + parts.join('\\')
    } else if (currentPath.includes('\\')) {
      return parts.join('\\') + '\\'
    } else {
      return '/' + parts.join('/')
    }
  }

  const handleGoUp = () => {
    const parentPath = getParentDirectory(folderContents.currentPath)
    if (parentPath) {
      setManualPath(parentPath)
      loadFolderContents(parentPath)
    } else {
      // Go to root view (drives and default folders)
      setManualPath('')
      loadFolderContents('')
    }
  }

  const handleManualPathSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualPath.trim()) {
      loadFolderContents(manualPath.trim())
    }
  }

  const handleSelectCurrentFolder = () => {
    onSelectFolder(folderContents.currentPath)
    onClose()
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !folderContents.currentPath) {
      return
    }
    
    setCreateFolderLoading(true)
    try {
      const response = await fetch('/api/create-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          folderPath: folderContents.currentPath, 
          folderName: newFolderName.trim() 
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create folder')
      }

      const result = await response.json()
      
      if (result.success) {
        // Reset create folder state
        setShowCreateFolder(false)
        setNewFolderName('')
        // Refresh folder contents
        loadFolderContents(folderContents.currentPath)
      } else {
        alert(`Error creating folder: ${result.error}`)
      }
    } catch (error) {
      console.error('Error creating folder:', error)
      alert(`Error creating folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setCreateFolderLoading(false)
    }
  }

  const handleCancelCreateFolder = () => {
    setShowCreateFolder(false)
    setNewFolderName('')
  }

  if (!isOpen) return null

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        // Close modal when clicking outside
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <Card className="w-full max-w-4xl max-h-[80vh] mx-4 glass-card overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              📁 Browse Folders
            </h2>
            <Button onClick={onClose} variant="outline" size="sm">
              ✕
            </Button>
          </div>
        
        <div className="space-y-4">
          {/* Path Input */}
          <form onSubmit={handleManualPathSubmit} className="flex gap-2">
            <Input
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              placeholder="Enter folder path or leave empty for drives and default folders..."
              className="flex-1"
            />
            <Button type="submit" variant="outline" size="sm" disabled={loading}>
              Go
            </Button>
          </form>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleGoUp}
              variant="outline"
              size="sm"
              disabled={loading || (!folderContents.currentPath && folderContents.isRootView)}
            >
              ⬆️ Up
            </Button>
            {folderContents.isRootView && (
              <Button
                onClick={() => {
                  setManualPath('')
                  loadFolderContents('')
                }}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                🏠 Home
              </Button>
            )}
            <div className="flex-1 text-sm text-muted-foreground">
              Current: {folderContents.isRootView ? 'Drives & Default Folders' : (folderContents.currentPath || 'Loading...')}
            </div>
            {/* Create Folder Button - only show when not in root view */}
            {!folderContents.isRootView && folderContents.currentPath && (
              <Button
                onClick={() => setShowCreateFolder(true)}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                ➕ New Folder
              </Button>
            )}
          </div>

          {/* Create Folder Section */}
          {showCreateFolder && (
            <div className="p-4 border rounded-lg bg-card/30 space-y-3">
              <h4 className="font-medium">Create New Folder</h4>
              <div className="flex gap-2">
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateFolder()
                    } else if (e.key === 'Escape') {
                      handleCancelCreateFolder()
                    }
                  }}
                  autoFocus
                />
                <Button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || createFolderLoading}
                  size="sm"
                >
                  {createFolderLoading ? '⏳' : '✅'} Create
                </Button>
                <Button
                  onClick={handleCancelCreateFolder}
                  variant="outline"
                  size="sm"
                  disabled={createFolderLoading}
                >
                  ✕ Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Folder Contents */}
          <div className="h-[400px] border rounded-lg p-4 bg-card/50 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
                <span className="ml-2">Loading folders...</span>
              </div>
            ) : folderContents.error ? (
              <div className="text-destructive p-4 text-center">
                ❌ {folderContents.error}
              </div>
            ) : (
              <div className="space-y-2">
                {folderContents.folders.length === 0 ? (
                  <div className="text-muted-foreground text-center py-8">
                    {folderContents.isRootView ? 'No drives or default folders found' : 'No folders found in this directory'}
                  </div>
                ) : (
                  folderContents.folders.map((folder) => (
                    <div
                      key={folder.path}
                      onClick={() => handleFolderClick(folder)}
                      className="flex items-center gap-2 p-3 rounded-lg hover:bg-secondary/80 cursor-pointer transition-colors border border-border/50 hover:border-primary/50"
                    >
                      <span className="text-lg">{folder.icon || '📁'}</span>
                      <span className="flex-1 font-medium">{folder.name}</span>
                      <span className="text-sm text-muted-foreground">→</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between gap-2">
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button 
              onClick={handleSelectCurrentFolder}
              disabled={!folderContents.currentPath || loading || folderContents.isRootView}
              className="bg-primary hover:bg-primary/90"
            >
              ✅ Select This Folder
            </Button>
          </div>
        </div>
        </div>
      </Card>
    </div>
  )

  // Use portal to render modal outside of normal DOM tree
  return typeof window !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null
}
