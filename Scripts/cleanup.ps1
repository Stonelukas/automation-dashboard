# cleanup.ps1 - Enhanced PowerShell cleanup script with improved error handling and logging

param (
    [string]$StartFolder = ".",
    [string[]]$IgnoreFolders = @(),
    [string]$VideoMoveTarget = ".\SortedVideos",
    [switch]$DryRun = $false,
    [switch]$ScanOnly = $false,
    [int]$MinVideoLengthSec = 30,
    [string]$PhotoExtensions = "jpg,jpeg,png,gif,bmp,tiff",
    [string]$VideoExtensions = "mp4,avi,mov,wmv,flv,mkv,webm",
    [string]$DeleteEmptyFolders = "true",
    [string]$MoveVideos = "true",
    [string]$RevertLogPath = "",
    [string]$LoadScanResults = ""
)

# Initialize working directory
$cwd = Get-Location
$errorCount = 0
$warningCount = 0

# Convert string parameters to boolean
$DeleteEmptyFoldersBool = $DeleteEmptyFolders -eq "true" -or $DeleteEmptyFolders -eq "1" -or $DeleteEmptyFolders -eq $true
$MoveVideosBool = $MoveVideos -eq "true" -or $MoveVideos -eq "1" -or $MoveVideos -eq $true

# Make VideoMoveTarget relative to StartFolder instead of current directory
if ([System.IO.Path]::IsPathRooted($VideoMoveTarget)) {
    # If VideoMoveTarget is already an absolute path, use it as-is
    $VideoMoveTargetPath = $VideoMoveTarget
} else {
    # Make VideoMoveTarget relative to StartFolder
    $VideoMoveTargetPath = Join-Path $StartFolder $VideoMoveTarget
}

# Operation tracking for revert functionality
$operationLog = @{
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    operations = @()
    deletedFiles = @()
    movedFiles = @()
    deletedFolders = @()
}

function Add-OperationLog {
    param($type, $source, $destination = $null, $size = 0)
    $operation = @{
        type = $type
        source = $source
        destination = $destination
        size = $size
        timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    $script:operationLog.operations += $operation
}

function Save-OperationLog {
    param($logPath)
    try {
        $logJson = $operationLog | ConvertTo-Json -Depth 4
        Set-Content -Path $logPath -Value $logJson -Encoding UTF8
        Write-Status @{ type = "log"; message = "Operation log saved to: $logPath" }
    } catch {
        Write-Status @{ type = "error"; message = "Failed to save operation log: $($_.Exception.Message)" }
    }
}

function Save-ScanResults {
    param($scanPath, $photoFiles, $shortVideos, $longVideos, $emptyFolders)
    try {
        # Convert Generic Lists to arrays for proper JSON serialization and handle null inputs
        $photoArray = if ($null -eq $photoFiles) { @() } else { @($photoFiles) }
        $shortVideoArray = if ($null -eq $shortVideos) { @() } else { @($shortVideos) }
        $longVideoArray = if ($null -eq $longVideos) { @() } else { @($longVideos) }
        $emptyFolderArray = if ($null -eq $emptyFolders) { @() } else { @($emptyFolders) }
        
        # Build file info arrays with null checking
        $photoFileData = @()
        if ($photoArray.Count -gt 0) {
            $photoFileData = @($photoArray | ForEach-Object { 
                if ($null -ne $_ -and $null -ne $_.FullName) {
                    @{ path = $_.FullName; size = $_.Length; lastModified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss") }
                }
            } | Where-Object { $null -ne $_ })
        }
        
        $shortVideoData = @()
        if ($shortVideoArray.Count -gt 0) {
            $shortVideoData = @($shortVideoArray | ForEach-Object { 
                if ($null -ne $_ -and $null -ne $_.FullName) {
                    @{ path = $_.FullName; size = $_.Length; lastModified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss") }
                }
            } | Where-Object { $null -ne $_ })
        }
        
        $longVideoData = @()
        if ($longVideoArray.Count -gt 0) {
            $longVideoData = @($longVideoArray | ForEach-Object { 
                if ($null -ne $_ -and $null -ne $_.FullName) {
                    @{ path = $_.FullName; size = $_.Length; lastModified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss") }
                }
            } | Where-Object { $null -ne $_ })
        }
        
        $emptyFolderData = @()
        if ($emptyFolderArray.Count -gt 0) {
            $emptyFolderData = @($emptyFolderArray | ForEach-Object { 
                if ($null -ne $_ -and $null -ne $_.FullName) {
                    @{ path = $_.FullName; lastModified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss") }
                }
            } | Where-Object { $null -ne $_ })
        }
        
        $scanResults = @{
            timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            startFolder = $StartFolder
            videoMoveTarget = $VideoMoveTargetPath
            configuration = @{
                minVideoLengthSec = $MinVideoLengthSec
                photoExtensions = $PhotoExtensions
                videoExtensions = $VideoExtensions
                deleteEmptyFolders = $DeleteEmptyFoldersBool
                moveVideos = $MoveVideosBool
                ignoreFolders = $IgnoreFolders
            }
            scanResults = @{
                totalPhotos = $photoArray.Count
                totalShortVideos = $shortVideoArray.Count
                totalLongVideos = $longVideoArray.Count
                totalEmptyFolders = $emptyFolderArray.Count
                photoFiles = $photoFileData
                shortVideos = $shortVideoData
                longVideos = $longVideoData
                emptyFolders = $emptyFolderData
            }
        }
        
        $scanJson = $scanResults | ConvertTo-Json -Depth 6
        # Use UTF8NoBOM encoding to avoid BOM issues with JSON parsing
        [System.IO.File]::WriteAllText($scanPath, $scanJson, [System.Text.UTF8Encoding]::new($false))
        Write-Status @{ type = "log"; message = "Scan results saved to: $scanPath" }
        Write-Status @{ type = "log"; message = "Saved totals - Photos: $($photoArray.Count), Short videos: $($shortVideoArray.Count), Long videos: $($longVideoArray.Count), Empty folders: $($emptyFolderArray.Count)" }
    } catch {
        Write-Status @{ type = "error"; message = "Failed to save scan results: $($_.Exception.Message)" }
        Write-Status @{ type = "error"; message = "Error details: $($_.Exception.ToString())" }
    }
}

function Load-ScanResults {
    param($scanPath)
    try {
        if (-not (Test-Path $scanPath)) {
            Write-Status @{ type = "error"; message = "Scan results file not found: $scanPath" }
            return $null
        }
        
        $scanContent = Get-Content -Path $scanPath -Raw | ConvertFrom-Json
        Write-Status @{ type = "log"; message = "Loaded scan results from: $([System.IO.Path]::GetFileName($scanPath))" }
        Write-Status @{ type = "log"; message = "Scan performed on: $($scanContent.timestamp)" }
        Write-Status @{ type = "log"; message = "Original folder: $($scanContent.startFolder)" }
        
        # Validate scan results structure
        if (-not $scanContent.scanResults) {
            Write-Status @{ type = "error"; message = "Invalid scan results file: missing scanResults section" }
            return $null
        }
        
        # Log loaded counts for debugging
        $photosCount = if ($scanContent.scanResults.totalPhotos -ne $null) { $scanContent.scanResults.totalPhotos } else { 0 }
        $shortVideosCount = if ($scanContent.scanResults.totalShortVideos -ne $null) { $scanContent.scanResults.totalShortVideos } else { 0 }
        $longVideosCount = if ($scanContent.scanResults.totalLongVideos -ne $null) { $scanContent.scanResults.totalLongVideos } else { 0 }
        $emptyFoldersCount = if ($scanContent.scanResults.totalEmptyFolders -ne $null) { $scanContent.scanResults.totalEmptyFolders } else { 0 }
        
        Write-Status @{ type = "log"; message = "Loaded totals from file - Photos: $photosCount, Short videos: $shortVideosCount, Long videos: $longVideosCount, Empty folders: $emptyFoldersCount" }
        
        return $scanContent
    } catch {
        Write-Status @{ type = "error"; message = "Failed to load scan results: $($_.Exception.Message)" }
        return $null
    }
}

# Enhanced logging function
function Write-Status {
    param($obj)
    try {
        $json = $obj | ConvertTo-Json -Compress -Depth 3
        Write-Output $json
    } catch {
        Write-Output "{`"type`":`"error`",`"message`":`"Failed to serialize status: $($_.Exception.Message)`"}"
    }
}

# Function to move files to Windows Recycle Bin
function Move-ToRecycleBin {
    param(
        [string]$FilePath,
        [string]$Description = "File"
    )
    
    try {
        # Use Shell.Application COM object to move to Recycle Bin
        $shell = New-Object -ComObject Shell.Application
        $item = Get-Item -LiteralPath $FilePath -ErrorAction Stop
        $folder = $shell.Namespace($item.DirectoryName)
        $file = $folder.ParseName($item.Name)
        
        if ($file) {
            # Move to Recycle Bin (verb 3 = Delete/Move to Recycle Bin)
            $file.InvokeVerb("delete")
            
            # Verify the file was moved to Recycle Bin
            if (-not (Test-Path -LiteralPath $FilePath)) {
                Write-Status @{ type = "log"; message = "Moved $Description to Recycle Bin: $($item.Name)" }
                return $true
            } else {
                Write-Status @{ type = "log"; message = "Warning: File still exists after Recycle Bin operation: $($item.Name)" }
                return $false
            }
        } else {
            Write-Status @{ type = "log"; message = "Warning: Could not find file for Recycle Bin operation: $($item.Name)" }
            return $false
        }
    } catch {
        Write-Status @{ type = "log"; message = "Warning: Failed to move $Description to Recycle Bin: $($_.Exception.Message)" }
        return $false
    } finally {
        # Clean up COM object
        if ($shell) {
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($shell) | Out-Null
        }
    }
}

# Function to handle file deletion with user choice
function Remove-FileWithChoice {
    param(
        [string]$FilePath,
        [string]$Description = "File"
    )
    
    if ($DryRun) {
        $fileSize = if (Test-Path -LiteralPath $FilePath) {
            $sizeBytes = (Get-Item -LiteralPath $FilePath -ErrorAction SilentlyContinue).Length
            if ($sizeBytes -gt 1MB) {
                "$([math]::Round($sizeBytes / 1MB, 2)) MB"
            } elseif ($sizeBytes -gt 1KB) {
                "$([math]::Round($sizeBytes / 1KB, 2)) KB"
            } else {
                "$sizeBytes bytes"
            }
        } else {
            "unknown size"
        }
        
        $fileName = [System.IO.Path]::GetFileName($FilePath)
        $parentDir = [System.IO.Path]::GetDirectoryName($FilePath)
        $relativePath = if ($parentDir -and $parentDir.StartsWith($StartFolder)) {
            $parentDir.Substring($StartFolder.Length).TrimStart('\')
        } else {
            $parentDir
        }
        
        $locationText = if ($relativePath) { "in folder '$relativePath'" } else { "in root folder" }
        
        Write-Status @{ type = "log"; message = "[DRY RUN] Would delete $Description '$fileName' ($fileSize) $locationText" }
        return $true
    }
    
    # Try to move to Recycle Bin first
    $recycleBinSuccess = Move-ToRecycleBin -FilePath $FilePath -Description $Description
    
    if ($recycleBinSuccess) {
        Add-OperationLog -type "recycle" -source $FilePath -size (Get-Item -LiteralPath $FilePath -ErrorAction SilentlyContinue).Length
        return $true
    } else {
        # If Recycle Bin fails, ask user what to do
        Write-Status @{ type = "status"; stage = "waiting" }
        Write-Status @{ type = "log"; message = "Failed to move $Description to Recycle Bin: $([System.IO.Path]::GetFileName($FilePath))" }
        Write-Status @{ type = "log"; message = "Choose action: 1) Skip this file, 2) Permanently delete, 3) Abort operation" }
        
        $choiceFile = Join-Path $PSScriptRoot "file_choice.txt"
        $skipFile = Join-Path $PSScriptRoot "skip_file.txt"
        $deleteFile = Join-Path $PSScriptRoot "delete_file.txt"
        $abortFile = Join-Path $PSScriptRoot "abort_operation.txt"
        
        # Wait for user choice
        $choiceTimeout = 300 # 5 minutes
        $waitStart = Get-Date
        
        while ($true) {
            if (Test-Path $skipFile) {
                Remove-Item $skipFile -ErrorAction SilentlyContinue
                Write-Status @{ type = "log"; message = "Skipping file: $([System.IO.Path]::GetFileName($FilePath))" }
                Write-Status @{ type = "status"; stage = "running"; isDryRun = $DryRun }
                return $true
            } elseif (Test-Path $deleteFile) {
                Remove-Item $deleteFile -ErrorAction SilentlyContinue
                try {
                    Remove-Item -LiteralPath $FilePath -Force -ErrorAction Stop
                    Write-Status @{ type = "log"; message = "Permanently deleted ${Description}: $([System.IO.Path]::GetFileName($FilePath))" }
                    Add-OperationLog -type "delete" -source $FilePath -size (Get-Item -LiteralPath $FilePath -ErrorAction SilentlyContinue).Length
                    Write-Status @{ type = "status"; stage = "running"; isDryRun = $DryRun }
                    return $true
                } catch {
                    Write-Status @{ type = "log"; message = "Failed to permanently delete ${Description}: $($_.Exception.Message)" }
                    Write-Status @{ type = "status"; stage = "running"; isDryRun = $DryRun }
                    return $false
                }
            } elseif (Test-Path $abortFile) {
                Remove-Item $abortFile -ErrorAction SilentlyContinue
                Write-Status @{ type = "log"; message = "Operation aborted by user choice" }
                Write-Status @{ type = "status"; stage = "aborted" }
                exit 1
            }
            
            # Check for timeout
            if ((Get-Date).Subtract($waitStart).TotalSeconds -gt $choiceTimeout) {
                Write-Status @{ type = "log"; message = "Choice timeout - skipping file: $([System.IO.Path]::GetFileName($FilePath))" }
                Write-Status @{ type = "status"; stage = "running"; isDryRun = $DryRun }
                return $true
            }
            
            Start-Sleep -Milliseconds 500
        }
    }
}

# Enhanced error handling
function Handle-Error {
    param($action, $path, $error)
    $script:errorCount++
    $message = "$action failed for '$path': $($error.Exception.Message)"
    Write-Status @{ type = "log"; message = $message }
}

# Check if path is in ignored folders
function Is-InIgnoredFolder {
    param($FullPath)
    foreach ($ignored in $IgnoreFolders) {
        try {
            $ignoredFull = Resolve-Path -Path (Join-Path $cwd $ignored) -ErrorAction SilentlyContinue
            if ($ignoredFull) {
                $ignoredFull = $ignoredFull.ProviderPath
                if ($FullPath.StartsWith($ignoredFull, [System.StringComparison]::OrdinalIgnoreCase)) {
                    return $true
                }
            }
        } catch {
            Write-Status @{ type = "log"; message = "Warning: Could not resolve ignored folder path: $ignored" }
            $script:warningCount++
        }
    }
    return $false
}

# Enhanced video duration detection with fallback
function Get-VideoDuration {
    param ($path)
    try {
        # Try ffprobe first
        $cmd = "ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 `"$path`""
        $output = cmd /c $cmd 2>$null
        if ($output -match '^\d+(\.\d+)?$') {
            return [double]$output
        }
        
        # Fallback to file properties (less accurate)
        $shell = New-Object -ComObject Shell.Application
        $folder = $shell.Namespace((Get-Item $path).DirectoryName)
        $file = $folder.ParseName((Get-Item $path).Name)
        $duration = $folder.GetDetailsOf($file, 27) # Duration property
        if ($duration -match '(\d+):(\d+):(\d+)') {
            return [double]($matches[1]) * 3600 + [double]($matches[2]) * 60 + [double]($matches[3])
        }
    } catch {
        Write-Status @{ type = "log"; message = "Warning: Could not determine duration for $path" }
        $script:warningCount++
    }
    return $null
}

# Validate prerequisites
function Test-Prerequisites {
    # Check if ffprobe is available
    try {
        $null = Get-Command ffprobe -ErrorAction Stop
        Write-Status @{ type = "log"; message = "FFprobe found and accessible" }
    } catch {
        Write-Status @{ type = "log"; message = "Warning: FFprobe not found. Video duration detection may be limited." }
        $script:warningCount++
    }
    
    # Validate start folder
    if (-not (Test-Path $StartFolder)) {
        Write-Status @{ type = "error"; message = "Start folder does not exist: $StartFolder" }
        exit 1
    }
    
    Write-Status @{ type = "log"; message = "Prerequisites validated" }
}

try {
    # INITIALIZATION
    Write-Status @{ type = "status"; stage = "starting" }
    
    # Process configurable parameters
    $photoExtArray = $PhotoExtensions.Split(',') | ForEach-Object { "*.$($_.Trim())" }
    $videoExtArray = $VideoExtensions.Split(',') | ForEach-Object { "*.$($_.Trim())" }
    
    Write-Status @{ type = "log"; message = "Configuration: MinVideoLength=$MinVideoLengthSec`s (videos shorter will be deleted)" }
    Write-Status @{ type = "log"; message = "Photo extensions: $($photoExtArray -join ', ')" }
    Write-Status @{ type = "log"; message = "Video extensions: $($videoExtArray -join ', ')" }
    Write-Status @{ type = "log"; message = "Delete empty folders: $DeleteEmptyFoldersBool, Move videos: $MoveVideosBool" }
    
    Test-Prerequisites
    
    # REVERT MODE - Check if we should revert a previous operation
    if ($RevertLogPath) {
        Write-Status @{ type = "status"; stage = "running"; isDryRun = $false }
        Write-Status @{ type = "log"; message = "Revert mode activated - Processing log: $RevertLogPath" }
        
        $revertSuccess = Invoke-RevertOperation -logPath $RevertLogPath
        
        if ($revertSuccess) {
            Write-Status @{ type = "status"; stage = "done"; isDryRun = $false }
            Write-Status @{ type = "log"; message = "Revert operation completed successfully!" }
        } else {
            Write-Status @{ type = "status"; stage = "aborted"; isDryRun = $false }
            Write-Status @{ type = "log"; message = "Revert operation failed!" }
            exit 1
        }
        exit 0
    }
    
    # LOAD SCAN RESULTS MODE - Check if we should load existing scan results
    if ($LoadScanResults) {
        Write-Status @{ type = "status"; stage = "scanning" }
        Write-Status @{ type = "log"; message = "Loading existing scan results: $LoadScanResults" }
        
        $loadedScan = Load-ScanResults -scanPath $LoadScanResults
        if (-not $loadedScan) {
            Write-Status @{ type = "status"; stage = "aborted" }
            Write-Status @{ type = "log"; message = "Failed to load scan results!" }
            exit 1
        }
        
        # Use loaded scan results
        $scanResults = $loadedScan.scanResults
        
        # Update the StartFolder variable to match the loaded scan results
        $StartFolder = $loadedScan.startFolder
        
        # Ensure we have valid numbers, default to 0 if null
        $photosCount = if ($scanResults.totalPhotos -ne $null) { [int]$scanResults.totalPhotos } else { 0 }
        $shortVideosCount = if ($scanResults.totalShortVideos -ne $null) { [int]$scanResults.totalShortVideos } else { 0 }
        $longVideosCount = if ($scanResults.totalLongVideos -ne $null) { [int]$scanResults.totalLongVideos } else { 0 }
        $emptyFoldersCount = if ($scanResults.totalEmptyFolders -ne $null) { [int]$scanResults.totalEmptyFolders } else { 0 }
        
        # Store original loaded counts for later use
        $script:originalPhotosCount = $photosCount
        $script:originalShortVideosCount = $shortVideosCount
        $script:originalLongVideosCount = $longVideosCount
        $script:originalEmptyFoldersCount = $emptyFoldersCount
        
        Write-Status @{ type = "status"; stage = "waiting"; 
                        photosToDelete = $photosCount;
                        videosToDelete = $shortVideosCount;
                        foldersToDelete = $emptyFoldersCount;
                        videosToMove = $longVideosCount;
                        isDryRun = $DryRun.IsPresent }
        
        Write-Status @{ type = "log"; message = "Loaded scan results - Photos: $photosCount, Short videos: $shortVideosCount, Long videos: $longVideosCount, Empty folders: $emptyFoldersCount" }
        
        # Convert loaded data back to file objects for processing
        $allPhotoFiles = @()
        $shortVideos = @()
        $longVideos = @()
        $emptyFolders = @()
        
        if ($scanResults.photoFiles -and $scanResults.photoFiles.Count -gt 0) {
            $allPhotoFiles = @($scanResults.photoFiles | ForEach-Object { 
                if ($_.path -and (Test-Path $_.path)) { 
                    Get-Item $_.path -ErrorAction SilentlyContinue 
                } else { 
                    $null 
                }
            } | Where-Object { $_ -ne $null })
        }
        
        if ($scanResults.shortVideos -and $scanResults.shortVideos.Count -gt 0) {
            $shortVideos = @($scanResults.shortVideos | ForEach-Object { 
                if ($_.path -and (Test-Path $_.path)) { 
                    Get-Item $_.path -ErrorAction SilentlyContinue 
                } else { 
                    $null 
                }
            } | Where-Object { $_ -ne $null })
        }
        
        if ($scanResults.longVideos -and $scanResults.longVideos.Count -gt 0) {
            $longVideos = @($scanResults.longVideos | ForEach-Object { 
                if ($_.path -and (Test-Path $_.path)) { 
                    Get-Item $_.path -ErrorAction SilentlyContinue 
                } else { 
                    $null 
                }
            } | Where-Object { $_ -ne $null })
        }
        
        if ($scanResults.emptyFolders -and $scanResults.emptyFolders.Count -gt 0) {
            $emptyFolders = @($scanResults.emptyFolders | ForEach-Object { 
                if ($_.path -and (Test-Path $_.path)) { 
                    Get-Item $_.path -ErrorAction SilentlyContinue 
                } else { 
                    $null 
                }
            } | Where-Object { $_ -ne $null })
        }
        
        Write-Status @{ type = "log"; message = "Verified files still exist - Photos: $($allPhotoFiles.Count), Short videos: $($shortVideos.Count), Long videos: $($longVideos.Count), Empty folders: $($emptyFolders.Count)" }
        
        # Additional debug info to check if arrays are properly populated
        if ($allPhotoFiles.Count -gt 0) {
            Write-Status @{ type = "log"; message = "First photo file: $($allPhotoFiles[0].FullName)" }
        }
        if ($shortVideos.Count -gt 0) {
            Write-Status @{ type = "log"; message = "First short video: $($shortVideos[0].FullName)" }
        }
        if ($longVideos.Count -gt 0) {
            Write-Status @{ type = "log"; message = "First long video: $($longVideos[0].FullName)" }
        }
        
        # Skip to confirmation phase
        $skipScan = $true
    } else {
        $skipScan = $false
    }
    
    # SCAN PHASE - Skip if loading existing results
    if (-not $skipScan) {
        Write-Status @{ type = "status"; stage = "scanning" }
        Write-Status @{ type = "log"; message = "Starting file scan in: $StartFolder" }
        
        # Get all photo files
        $allPhotoFiles = @()
        try {
            $allPhotoFiles = Get-ChildItem -Path $StartFolder -Recurse -Include $photoExtArray -File -ErrorAction SilentlyContinue | Where-Object {
                -not (Is-InIgnoredFolder $_.FullName)
            }
            $totalPhotoSize = ($allPhotoFiles | Measure-Object -Property Length -Sum).Sum
            $photoSizeText = if ($totalPhotoSize -gt 1GB) {
                "$([math]::Round($totalPhotoSize / 1GB, 2)) GB"
            } elseif ($totalPhotoSize -gt 1MB) {
                "$([math]::Round($totalPhotoSize / 1MB, 2)) MB"
            } elseif ($totalPhotoSize -gt 1KB) {
                "$([math]::Round($totalPhotoSize / 1KB, 2)) KB"
            } else {
                "$totalPhotoSize bytes"
            }
            Write-Status @{ type = "log"; message = "Found $($allPhotoFiles.Count) photo files (total size: $photoSizeText) - all will be deleted" }
        } catch {
            Handle-Error "Photo scan" $StartFolder $_
        }
        
        # Get all video files
        $allVideoFiles = @()
        try {
            $allVideoFiles = Get-ChildItem -Path $StartFolder -Recurse -Include "*.mp4","*.mkv","*.avi","*.webm","*.mov","*.flv","*.wmv","*.m4v" -File -ErrorAction SilentlyContinue | Where-Object {
                -not (Is-InIgnoredFolder $_.FullName)
            }
            $totalVideoSize = ($allVideoFiles | Measure-Object -Property Length -Sum).Sum
            $videoSizeText = if ($totalVideoSize -gt 1GB) {
                "$([math]::Round($totalVideoSize / 1GB, 2)) GB"
            } elseif ($totalVideoSize -gt 1MB) {
                "$([math]::Round($totalVideoSize / 1MB, 2)) MB"
            } elseif ($totalVideoSize -gt 1KB) {
                "$([math]::Round($totalVideoSize / 1KB, 2)) KB"
            } else {
                "$totalVideoSize bytes"
            }
            Write-Status @{ type = "log"; message = "Found $($allVideoFiles.Count) video files (total size: $videoSizeText) - analyzing durations..." }
        } catch {
            Handle-Error "Video scan" $StartFolder $_
        }

        $totalVideos = $allVideoFiles.Count
        $processedCount = 0
        $shortVideos = @()
        $longVideos = @()

        # Analyze video durations
        Write-Status @{ type = "log"; message = "Analyzing video durations..." }
        foreach ($video in $allVideoFiles) {
            try {
                $duration = Get-VideoDuration $video.FullName
                $videoSize = if ($video.Length -gt 1MB) {
                    "$([math]::Round($video.Length / 1MB, 2)) MB"
                } elseif ($video.Length -gt 1KB) {
                    "$([math]::Round($video.Length / 1KB, 2)) KB"
                } else {
                    "$($video.Length) bytes"
                }
                
                if ($duration -ne $null -and $duration -lt $MinVideoLengthSec) {
                    $shortVideos += $video
                    Write-Status @{ type = "log"; message = "Found short video '$($video.Name)' ($videoSize, $duration`s) - will be deleted" }
                } elseif ($duration -ne $null) {
                    $longVideos += $video
                    Write-Status @{ type = "log"; message = "Found normal video '$($video.Name)' ($videoSize, $duration`s) - will be moved" }
                } else {
                    # If duration cannot be determined, treat as long video (safer - move rather than delete)
                    $longVideos += $video
                    Write-Status @{ type = "log"; message = "WARNING: Could not determine duration for '$($video.Name)' ($videoSize) - will be moved (safe default)" }
                    $script:warningCount++
                }
            } catch {
                Handle-Error "Duration analysis" $video.FullName $_
                $longVideos += $video # Default to long video on error (safer)
            }
            
            $processedCount++
            if ($processedCount % 10 -eq 0 -or $processedCount -eq $totalVideos) {
                Write-Status @{ type = "progress"; processed = $processedCount; total = $totalVideos }
            }
            Start-Sleep -Milliseconds 10
        }

        # Find empty folders
        Write-Status @{ type = "log"; message = "Scanning for empty folders..." }
        $emptyFolders = @()
        try {
            $emptyFolders = Get-ChildItem -Path $StartFolder -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object {
                -not (Is-InIgnoredFolder $_.FullName) -and
                (@($_.GetFileSystemInfos('*', 'AllDirectories')).Count -eq 0)
            }
            if ($emptyFolders.Count -gt 0) {
                Write-Status @{ type = "log"; message = "Found $($emptyFolders.Count) empty folders - all will be deleted" }
            } else {
                Write-Status @{ type = "log"; message = "No empty folders found" }
            }
        } catch {
            Handle-Error "Empty folder scan" $StartFolder $_
        }
    }

    # SUMMARY AND CONFIRMATION
    $modeText = if ($DryRun) { " (DRY RUN - No files will be modified)" } else { "" }
    if ($ScanOnly) {
        $modeText = " (SCAN ONLY - No operations will be performed)"
    }
    
    # Only send status message again if we're not loading scan results (already sent above)
    if (-not $LoadScanResults) {
        Write-Status @{ type = "status"; stage = "waiting"; 
                        photosToDelete = $allPhotoFiles.Count;
                        videosToDelete = $shortVideos.Count;
                        foldersToDelete = $emptyFolders.Count;
                        videosToMove = $longVideos.Count;
                        isDryRun = $DryRun;
                        scanOnly = $ScanOnly }
    }
    
    Write-Status @{ type = "log"; message = "Scan complete. Waiting for user confirmation...$modeText" }
    
    # Use appropriate counts for log message
    $logPhotosCount = if ($LoadScanResults -and $script:originalPhotosCount -ne $null) { $script:originalPhotosCount } else { $allPhotoFiles.Count }
    $logShortVideosCount = if ($LoadScanResults -and $script:originalShortVideosCount -ne $null) { $script:originalShortVideosCount } else { $shortVideos.Count }
    $logLongVideosCount = if ($LoadScanResults -and $script:originalLongVideosCount -ne $null) { $script:originalLongVideosCount } else { $longVideos.Count }
    $logEmptyFoldersCount = if ($LoadScanResults -and $script:originalEmptyFoldersCount -ne $null) { $script:originalEmptyFoldersCount } else { $emptyFolders.Count }
    
    Write-Status @{ type = "log"; message = "Summary - Photos: $logPhotosCount, Short videos (to delete): $logShortVideosCount, Other videos (to move): $logLongVideosCount, Empty folders: $logEmptyFoldersCount" }

    # Save scan results for later use (in case user cancels or something goes wrong)
    # Only save scan results if we're not loading from existing scan results
    if (-not $LoadScanResults) {
        $dataDir = Join-Path $PSScriptRoot ".data\scan_results"
        if (-not (Test-Path $dataDir)) {
            New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
        }
        $scanResultsPath = Join-Path $dataDir "scan_results_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
        Save-ScanResults -scanPath $scanResultsPath -photoFiles $allPhotoFiles -shortVideos $shortVideos -longVideos $longVideos -emptyFolders $emptyFolders
    }
    
    # If scan-only mode, exit after saving results
    if ($ScanOnly) {
        Write-Status @{ type = "status"; stage = "done"; isDryRun = $false; scanOnly = $true }
        if (-not $LoadScanResults) {
            Write-Status @{ type = "log"; message = "Scan-only mode complete. Results saved to: $([System.IO.Path]::GetFileName($scanResultsPath))" }
        } else {
            Write-Status @{ type = "log"; message = "Scan-only mode complete using loaded results." }
        }
        exit 0
    }

    # Wait for user confirmation
    $confirmationTimeout = 300 # 5 minutes
    $waitStart = Get-Date
    $confirmFile = Join-Path $PSScriptRoot "confirm.txt"
    $cancelFile = Join-Path $PSScriptRoot "cancel.txt"
    
    while ($true) {
        if (Test-Path $confirmFile) {
            Remove-Item $confirmFile -ErrorAction SilentlyContinue
            $stageText = if ($DryRun) { "running (DRY RUN)" } else { "running" }
            Write-Status @{ type = "status"; stage = "running"; isDryRun = $DryRun }
            $actionText = if ($DryRun) { "Simulating cleanup operations (DRY RUN)..." } else { "User confirmed. Starting cleanup operations..." }
            Write-Status @{ type = "log"; message = $actionText }
            break
        } elseif (Test-Path $cancelFile) {
            Remove-Item $cancelFile -ErrorAction SilentlyContinue
            Write-Status @{ type = "status"; stage = "aborted" }
            Write-Status @{ type = "log"; message = "User cancelled operation." }
            Write-Status @{ type = "log"; message = "Scan results have been saved for later use: $([System.IO.Path]::GetFileName($scanResultsPath))" }
            exit 1
        }
        
        # Check for timeout
        if ((Get-Date).Subtract($waitStart).TotalSeconds -gt $confirmationTimeout) {
            Write-Status @{ type = "status"; stage = "aborted" }
            Write-Status @{ type = "log"; message = "Operation timed out waiting for user confirmation." }
            Write-Status @{ type = "log"; message = "Scan results have been saved for later use: $([System.IO.Path]::GetFileName($scanResultsPath))" }
            exit 1
        }
        
        Start-Sleep -Milliseconds 500
    }

    # EXECUTE CLEANUP OPERATIONS
    $operationText = if ($DryRun) { "Simulating directory creation" } else { "Creating video move target directory" }
    Write-Status @{ type = "log"; message = "$operationText..." }
    if (-not (Test-Path $VideoMoveTargetPath)) {
        if ($DryRun) {
            Write-Status @{ type = "log"; message = "[DRY RUN] Would create video target directory '$VideoMoveTargetPath' for storing moved videos" }
        } else {
            try {
                New-Item -ItemType Directory -Path $VideoMoveTargetPath -Force | Out-Null
                Write-Status @{ type = "log"; message = "Created directory: $VideoMoveTargetPath" }
            } catch {
                Handle-Error "Directory creation" $VideoMoveTargetPath $_
            }
        }
    }

    # Delete photos (move to Recycle Bin)
    $photoOperationText = if ($DryRun) { "Simulating photo deletion" } else { "Moving photos to Recycle Bin" }
    Write-Status @{ type = "log"; message = "$photoOperationText..." }
    foreach ($photo in $allPhotoFiles) {
        try {
            $success = Remove-FileWithChoice -FilePath $photo.FullName -Description "photo"
            if (-not $success) {
                Handle-Error "Photo deletion" $photo.FullName "Failed to process file"
            }
        } catch {
            Handle-Error "Photo deletion" $photo.FullName $_
        }
    }

    # Delete short videos (move to Recycle Bin)
    $shortVideoOperationText = if ($DryRun) { "Simulating short video deletion" } else { "Moving short videos to Recycle Bin" }
    Write-Status @{ type = "log"; message = "$shortVideoOperationText..." }
    foreach ($video in $shortVideos) {
        try {
            $success = Remove-FileWithChoice -FilePath $video.FullName -Description "short video"
            if (-not $success) {
                Handle-Error "Short video deletion" $video.FullName "Failed to process file"
            }
        } catch {
            Handle-Error "Short video deletion" $video.FullName $_
        }
    }

    # Move all non-short videos (sorted by duration, longest first)
    if ($MoveVideosBool -and $longVideos.Count -gt 0) {
        $moveOperationText = if ($DryRun) { "Simulating video moves" } else { "Moving videos" }
        Write-Status @{ type = "log"; message = "$moveOperationText..." }
        $videosToMove = $longVideos | Sort-Object {
            $d = Get-VideoDuration $_.FullName
            if ($d) { $d } else { 0 }
        } -Descending

        foreach ($video in $videosToMove) {
            $dest = Join-Path $VideoMoveTargetPath $video.Name
            # Handle duplicate names
            $counter = 1
            while (Test-Path $dest) {
                $nameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($video.Name)
                $extension = [System.IO.Path]::GetExtension($video.Name)
                $dest = Join-Path $VideoMoveTargetPath "$nameWithoutExt($counter)$extension"
                $counter++
            }
            
            if ($DryRun) {
                $videoSize = if ($video.Length -gt 1MB) {
                    "$([math]::Round($video.Length / 1MB, 2)) MB"
                } elseif ($video.Length -gt 1KB) {
                    "$([math]::Round($video.Length / 1KB, 2)) KB"
                } else {
                    "$($video.Length) bytes"
                }
                
                $duration = Get-VideoDuration $video.FullName
                $durationText = if ($duration) { "$duration seconds" } else { "unknown duration" }
                
                $sourceDir = [System.IO.Path]::GetDirectoryName($video.FullName)
                $relativeSourcePath = if ($sourceDir -and $sourceDir.StartsWith($StartFolder)) {
                    $sourceDir.Substring($StartFolder.Length).TrimStart('\')
                } else {
                    $sourceDir
                }
                
                $sourceLocationText = if ($relativeSourcePath) { "from '$relativeSourcePath'" } else { "from root folder" }
                $targetFileName = [System.IO.Path]::GetFileName($dest)
                
                Write-Status @{ type = "log"; message = "[DRY RUN] Would move video '$($video.Name)' ($videoSize, $durationText) $sourceLocationText to '$targetFileName'" }
            } else {
                try {
                    Move-Item -LiteralPath $video.FullName -Destination $dest -Force -ErrorAction Stop
                    Write-Status @{ type = "log"; message = "Moved video: $($video.Name) -> $([System.IO.Path]::GetFileName($dest))" }
                    Add-OperationLog -type "move" -source $video.FullName -destination $dest -size $video.Length
                } catch {
                    Handle-Error "Video move" $video.FullName $_
                }
            }
        }
    } else {
        Write-Status @{ type = "log"; message = "Video moving disabled or no videos to move" }
    }

    # Delete empty folders (move to Recycle Bin)
    if ($DeleteEmptyFoldersBool -and $emptyFolders.Count -gt 0) {
        $folderOperationText = if ($DryRun) { "Simulating empty folder deletion" } else { "Moving empty folders to Recycle Bin" }
        Write-Status @{ type = "log"; message = "$folderOperationText..." }
        foreach ($folder in $emptyFolders) {
            try {
                $success = Remove-FileWithChoice -FilePath $folder.FullName -Description "empty folder"
                if (-not $success) {
                    Handle-Error "Empty folder deletion" $folder.FullName "Failed to process folder"
                }
            } catch {
                Handle-Error "Empty folder deletion" $folder.FullName $_
            }
        }
    } else {
        Write-Status @{ type = "log"; message = "Empty folder deletion disabled or no empty folders found" }
    }

    # Final summary
    $completionText = if ($DryRun) { "Dry run completed successfully! No files were modified." } else { "Cleanup completed successfully!" }
    Write-Status @{ type = "log"; message = $completionText }
    Write-Status @{ type = "log"; message = "Final summary - Errors: $errorCount, Warnings: $warningCount" }
    
    # Save operation log for revert functionality (only if not dry run)
    if (-not $DryRun -and $operationLog.operations.Count -gt 0) {
        $logDir = Join-Path $PSScriptRoot ".data\operation_logs"
        if (-not (Test-Path $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }
        $logPath = Join-Path $logDir "operation_log_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
        Save-OperationLog -logPath $logPath
        Write-Status @{ type = "log"; message = "Operation log contains $($operationLog.operations.Count) operations" }
    }
    
    Write-Status @{ type = "status"; stage = "done"; isDryRun = $DryRun }
    exit 0

} catch {
    Write-Status @{ type = "error"; message = "Critical error: $($_.Exception.Message)" }
    Write-Status @{ type = "status"; stage = "aborted" }
    
    # Try to save scan results if they exist
    if ($allPhotoFiles -or $shortVideos -or $longVideos -or $emptyFolders) {
        try {
            $emergencyDataDir = Join-Path $PSScriptRoot ".data\scan_results"
            if (-not (Test-Path $emergencyDataDir)) {
                New-Item -ItemType Directory -Path $emergencyDataDir -Force | Out-Null
            }
            $emergencyScanPath = Join-Path $emergencyDataDir "emergency_scan_results_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
            Save-ScanResults -scanPath $emergencyScanPath -photoFiles $allPhotoFiles -shortVideos $shortVideos -longVideos $longVideos -emptyFolders $emptyFolders
            Write-Status @{ type = "log"; message = "Emergency scan results saved: $([System.IO.Path]::GetFileName($emergencyScanPath))" }
        } catch {
            Write-Status @{ type = "error"; message = "Failed to save emergency scan results: $($_.Exception.Message)" }
        }
    }
    
    exit 1
}

# Function to restore files from Windows Recycle Bin
function Restore-FromRecycleBin {
    param(
        [string]$OriginalPath,
        [string]$Description = "File"
    )
    
    try {
        # Use Shell.Application COM object to access Recycle Bin
        $shell = New-Object -ComObject Shell.Application
        $recycleBin = $shell.Namespace(10) # 10 = Recycle Bin
        
        if ($recycleBin) {
            $originalFileName = [System.IO.Path]::GetFileName($OriginalPath)
            
            # Search for the file in Recycle Bin
            foreach ($item in $recycleBin.Items()) {
                if ($item.Name -eq $originalFileName) {
                    # Found the file, try to restore it
                    $item.InvokeVerb("restore")
                    
                    # Wait a moment for the restore operation
                    Start-Sleep -Milliseconds 1000
                    
                    # Check if the file was restored to its original location
                    if (Test-Path -LiteralPath $OriginalPath) {
                        Write-Status @{ type = "log"; message = "Restored $Description from Recycle Bin: $originalFileName" }
                        return $true
                    } else {
                        Write-Status @{ type = "log"; message = "Warning: $Description restore operation completed but file not found at original location: $originalFileName" }
                        return $false
                    }
                }
            }
            
            Write-Status @{ type = "log"; message = "Warning: $Description not found in Recycle Bin: $originalFileName" }
            return $false
        } else {
            Write-Status @{ type = "log"; message = "Warning: Could not access Recycle Bin for ${Description}: $originalFileName" }
            return $false
        }
    } catch {
        Write-Status @{ type = "log"; message = "Warning: Failed to restore $Description from Recycle Bin: $($_.Exception.Message)" }
        return $false
    } finally {
        # Clean up COM object
        if ($shell) {
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($shell) | Out-Null
        }
    }
}

function Invoke-RevertOperation {
    param($logPath)
    
    if (-not (Test-Path $logPath)) {
        Write-Status @{ type = "error"; message = "Revert log file not found: $logPath" }
        return $false
    }
    
    try {
        $logContent = Get-Content -Path $logPath -Raw | ConvertFrom-Json
        $operations = $logContent.operations
        
        if (-not $operations -or $operations.Count -eq 0) {
            Write-Status @{ type = "log"; message = "No operations found in log file to revert" }
            return $true
        }
        
        Write-Status @{ type = "log"; message = "Starting revert of $($operations.Count) operations..." }
        Write-Status @{ type = "status"; stage = "running"; isDryRun = $false }
        
        # Reverse the operations (last operation first)
        $reversedOps = $operations | Sort-Object { [DateTime]$_.timestamp } -Descending
        $successCount = 0
        $failureCount = 0
        
        foreach ($operation in $reversedOps) {
            try {
                switch ($operation.type) {
                    "move" {
                        # Move file back from destination to source
                        if (Test-Path $operation.destination) {
                            $sourceDir = Split-Path $operation.source -Parent
                            if (-not (Test-Path $sourceDir)) {
                                New-Item -ItemType Directory -Path $sourceDir -Force | Out-Null
                            }
                            Move-Item -LiteralPath $operation.destination -Destination $operation.source -Force
                            Write-Status @{ type = "log"; message = "Reverted move: $([System.IO.Path]::GetFileName($operation.destination)) → $([System.IO.Path]::GetFileName($operation.source))" }
                            $successCount++
                        } else {
                            Write-Status @{ type = "log"; message = "Warning: File not found for revert: $($operation.destination)" }
                            $failureCount++
                        }
                    }
                    "recycle" {
                        # Restore file from Recycle Bin
                        $restored = Restore-FromRecycleBin -OriginalPath $operation.source -Description "file"
                        if ($restored) {
                            $successCount++
                        } else {
                            Write-Status @{ type = "log"; message = "Failed to restore from Recycle Bin: $([System.IO.Path]::GetFileName($operation.source))" }
                            $failureCount++
                        }
                    }
                    "delete" {
                        # Cannot restore permanently deleted files
                        Write-Status @{ type = "log"; message = "Cannot restore permanently deleted file: $([System.IO.Path]::GetFileName($operation.source)) (permanently deleted)" }
                        $failureCount++
                    }
                    default {
                        Write-Status @{ type = "log"; message = "Unknown operation type for revert: $($operation.type)" }
                        $failureCount++
                    }
                }
            } catch {
                Write-Status @{ type = "log"; message = "Failed to revert operation: $($_.Exception.Message)" }
                $failureCount++
            }
        }
        
        Write-Status @{ type = "log"; message = "Revert completed - Success: $successCount, Failures: $failureCount" }
        Write-Status @{ type = "log"; message = "Note: Deleted files cannot be restored and require manual recovery" }
        
        # Rename the log file to indicate it's been processed
        $processedLogPath = $logPath -replace "\.json$", "_reverted.json"
        Move-Item -Path $logPath -Destination $processedLogPath -Force
        Write-Status @{ type = "log"; message = "Log file marked as processed: $([System.IO.Path]::GetFileName($processedLogPath))" }
        
        return $true
        
    } catch {
        Write-Status @{ type = "error"; message = "Failed to process revert log: $($_.Exception.Message)" }
        return $false
    }
}
