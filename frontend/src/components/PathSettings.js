import React from 'react';
import FormField from './FormField';

const PathSettings = ({ 
  appState, 
  folderBrowser, 
  socketActions,
  validationErrors 
}) => {
  const {
    startFolder, setStartFolder,
    videoMoveTarget, setVideoMoveTarget,
    ignoreFolders, setIgnoreFolders
  } = appState;

  const { setShowFolderBrowser } = folderBrowser;

  const handleInputChange = (setter, sanitizer = null) => (e) => {
    let value = e.target.value;
    if (sanitizer) {
      value = sanitizer(value);
    }
    setter(value);
  };

  return (
    <div className="section-card animate-slide-in-left">
      <div className="section-header">
        <span className="section-icon">📁</span>
        <h3 className="section-title">Path Settings</h3>
      </div>
      
      <div className="space-y-4">
        <FormField 
          label="Start Folder" 
          required
          error={validationErrors.startFolder}
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={startFolder}
              onChange={handleInputChange(setStartFolder)}
              placeholder="Enter the folder path to scan"
              className={`form-input flex-1 ${validationErrors.startFolder ? 'border-red-500' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowFolderBrowser(true)}
              className="btn btn-secondary px-4"
            >
              📂 Browse
            </button>
          </div>
        </FormField>

        <FormField 
          label="Video Move Target" 
          error={validationErrors.videoMoveTarget}
        >
          <input
            type="text"
            value={videoMoveTarget}
            onChange={handleInputChange(setVideoMoveTarget)}
            placeholder="Target folder for moving long videos"
            className={`form-input ${validationErrors.videoMoveTarget ? 'border-red-500' : ''}`}
          />
        </FormField>

        <FormField label="Ignore Folders (comma-separated)">
          <input
            type="text"
            value={ignoreFolders}
            onChange={handleInputChange(setIgnoreFolders)}
            placeholder="Folders to ignore during scanning (e.g., System, Temp)"
            className="form-input"
          />
          <small className="text-sm text-secondary mt-1 block">
            List folder names to ignore, separated by commas
          </small>
        </FormField>
      </div>
    </div>
  );
};

export default PathSettings;
