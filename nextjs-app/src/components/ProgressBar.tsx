import { Progress as ProgressType } from '@/hooks/useAppState'
import { calculateProgress } from '@/utils/businessLogic'
import { Progress } from '@radix-ui/react-progress'

interface ProgressBarProps {
  progress: ProgressType
  stage: string
}

export function ProgressBar({ progress, stage }: ProgressBarProps) {
  const getOverallProgress = () => {
    if (stage === 'scanning') {
      return calculateProgress(progress.ProcessedVideos, progress.TotalVideos)
    }
    
    if (stage === 'running') {
      const totalOperations = 
        progress.PhotosToDelete + 
        progress.VideosToDelete + 
        progress.FoldersToDelete + 
        progress.VideosToMove
      
      const completedOperations = 0 // This would need to be tracked separately
      return calculateProgress(completedOperations, totalOperations)
    }
    
    return 0
  }

  const progressValue = getOverallProgress()

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium">
          {stage === 'scanning' ? 'Scanning Progress' : 'Operation Progress'}
        </span>
        <span className="text-muted-foreground">{progressValue}%</span>
      </div>
      
      <Progress value={progressValue} className="h-2" />
      
      {stage === 'scanning' && (
        <div className="text-xs text-muted-foreground">
          {progress.ProcessedVideos} / {progress.TotalVideos} videos analyzed
        </div>
      )}
      
      {stage === 'running' && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div>📸 Photos to delete: {progress.PhotosToDelete}</div>
          <div>🎬 Videos to process: {progress.VideosToDelete + progress.VideosToMove}</div>
          <div>📁 Folders to clean: {progress.FoldersToDelete}</div>
        </div>
      )}
    </div>
  )
}
