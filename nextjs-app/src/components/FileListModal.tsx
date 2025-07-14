import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import React from 'react'

interface FileListModalProps {
  appState: any
  onClose: () => void
}

export function FileListModal({ appState, onClose }: FileListModalProps) {
  if (!appState.scanResults) {
    return null
  }

  const { scanResults } = appState

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Scan Results Details</CardTitle>
            <Button variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-y-auto">
          <div className="space-y-6">
            {/* Photos to Delete */}
            {scanResults.photosToDelete?.length > 0 && (
              <div>
                <h3 className="font-medium text-red-800 mb-2">
                  📸 Photos to Delete ({scanResults.photosToDelete.length})
                </h3>
                <div className="bg-red-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {scanResults.photosToDelete.slice(0, 10).map((file: string, index: number) => (
                    <div key={index} className="text-sm text-red-700 truncate">
                      {file}
                    </div>
                  ))}
                  {scanResults.photosToDelete.length > 10 && (
                    <div className="text-sm text-red-600 italic">
                      ... and {scanResults.photosToDelete.length - 10} more files
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Short Videos to Delete */}
            {scanResults.shortVideosToDelete?.length > 0 && (
              <div>
                <h3 className="font-medium text-yellow-800 mb-2">
                  🎬 Short Videos to Delete ({scanResults.shortVideosToDelete.length})
                </h3>
                <div className="bg-yellow-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {scanResults.shortVideosToDelete.slice(0, 10).map((file: string, index: number) => (
                    <div key={index} className="text-sm text-yellow-700 truncate">
                      {file}
                    </div>
                  ))}
                  {scanResults.shortVideosToDelete.length > 10 && (
                    <div className="text-sm text-yellow-600 italic">
                      ... and {scanResults.shortVideosToDelete.length - 10} more files
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Long Videos to Move */}
            {scanResults.longVideosToMove?.length > 0 && (
              <div>
                <h3 className="font-medium text-green-800 mb-2">
                  🎥 Long Videos to Move ({scanResults.longVideosToMove.length})
                </h3>
                <div className="bg-green-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {scanResults.longVideosToMove.slice(0, 10).map((file: string, index: number) => (
                    <div key={index} className="text-sm text-green-700 truncate">
                      {file}
                    </div>
                  ))}
                  {scanResults.longVideosToMove.length > 10 && (
                    <div className="text-sm text-green-600 italic">
                      ... and {scanResults.longVideosToMove.length - 10} more files
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Empty Folders to Delete */}
            {scanResults.emptyFoldersToDelete?.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-800 mb-2">
                  📁 Empty Folders to Delete ({scanResults.emptyFoldersToDelete.length})
                </h3>
                <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {scanResults.emptyFoldersToDelete.slice(0, 10).map((folder: string, index: number) => (
                    <div key={index} className="text-sm text-gray-700 truncate">
                      {folder}
                    </div>
                  ))}
                  {scanResults.emptyFoldersToDelete.length > 10 && (
                    <div className="text-sm text-gray-600 italic">
                      ... and {scanResults.emptyFoldersToDelete.length - 10} more folders
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No Files Found */}
            {!scanResults.photosToDelete?.length && 
             !scanResults.shortVideosToDelete?.length && 
             !scanResults.longVideosToMove?.length && 
             !scanResults.emptyFoldersToDelete?.length && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-4xl mb-2">🎉</div>
                <div className="font-medium">No files found for cleanup!</div>
                <div className="text-sm">Your folder is already organized.</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
