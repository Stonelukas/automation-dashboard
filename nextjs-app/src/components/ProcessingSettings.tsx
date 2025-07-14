import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import React from 'react'

interface ProcessingSettingsProps {
  appState: any
}

export function ProcessingSettings({ appState }: ProcessingSettingsProps) {
  return (
    <div className="space-y-4">
      {/* Dry Run Toggle */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="dryRun"
          checked={appState.dryRun}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => appState.setDryRun(e.target.checked)}
          className="rounded border-gray-300"
        />
        <Label htmlFor="dryRun" className="font-medium">
          🧪 Dry Run Mode (Safe Testing)
        </Label>
      </div>
      <p className="text-muted-foreground text-xs ml-6">
        When enabled, no files will be moved or deleted. Perfect for testing your settings.
      </p>

      {/* Min Video Length */}
      <div className="space-y-2">
        <Label htmlFor="minVideoLength">Minimum Video Length (seconds)</Label>
        <Input
          id="minVideoLength"
          type="number"
          value={appState.minVideoLengthSec}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
            appState.setMinVideoLengthSec(parseInt(e.target.value) || 9)
          }
          min="1"
          max="3600"
          className="w-32"
        />
        <p className="text-muted-foreground text-xs">
          Videos shorter than this will be marked for deletion. Default: 9 seconds.
        </p>
      </div>

      {/* Photo Extensions */}
      <div className="space-y-2">
        <Label htmlFor="photoExtensions">Photo File Extensions</Label>
        <Input
          id="photoExtensions"
          value={appState.photoExtensions}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
            appState.setPhotoExtensions(e.target.value)
          }
          placeholder="jpg,jpeg,png,gif,bmp,tiff"
        />
        <p className="text-muted-foreground text-xs">
          Comma-separated list of photo file extensions to process.
        </p>
      </div>

      {/* Video Extensions */}
      <div className="space-y-2">
        <Label htmlFor="videoExtensions">Video File Extensions</Label>
        <Input
          id="videoExtensions"
          value={appState.videoExtensions}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
            appState.setVideoExtensions(e.target.value)
          }
          placeholder="mp4,avi,mov,wmv,flv,mkv,webm"
        />
        <p className="text-muted-foreground text-xs">
          Comma-separated list of video file extensions to process.
        </p>
      </div>

      {/* Additional Options */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="deleteEmptyFolders"
            checked={appState.deleteEmptyFolders}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              appState.setDeleteEmptyFolders(e.target.checked)
            }
            className="rounded border-gray-300"
          />
          <Label htmlFor="deleteEmptyFolders">Delete Empty Folders</Label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="moveVideos"
            checked={appState.moveVideos}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              appState.setMoveVideos(e.target.checked)
            }
            className="rounded border-gray-300"
          />
          <Label htmlFor="moveVideos">Move Long Videos</Label>
        </div>
      </div>
    </div>
  )
}
