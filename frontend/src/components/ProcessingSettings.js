import React from 'react';
import { sanitizeInput } from '../utils/validation';
import FormField from './FormField';
import FormSection from './FormSection';

const ProcessingSettings = ({ appState }) => {
  const {
    minVideoLengthSec, setMinVideoLengthSec,
    photoExtensions, setPhotoExtensions,
    videoExtensions, setVideoExtensions,
    deleteEmptyFolders, setDeleteEmptyFolders,
    moveVideos, setMoveVideos,
    dryRun, setDryRun
  } = appState;

  const handleInputChange = (setter, sanitizer = null) => (e) => {
    let value = e.target.value;
    if (sanitizer) {
      value = sanitizer(value);
    }
    setter(value);
  };

  const handleCheckboxChange = (setter) => (e) => {
    setter(e.target.checked);
  };

  return (
    <FormSection title="Processing Settings">
      <FormField label="Minimum Video Length (seconds)">
        <input
          type="number"
          value={minVideoLengthSec}
          onChange={handleInputChange(setMinVideoLengthSec)}
          min="1"
          className="form-input"
        />
        <small className="form-hint">
          Videos shorter than this will be marked for deletion
        </small>
      </FormField>

      <FormField label="Photo Extensions">
        <input
          type="text"
          value={photoExtensions}
          onChange={handleInputChange(setPhotoExtensions, sanitizeInput)}
          placeholder="jpg,jpeg,png,gif,bmp,tiff"
          className="form-input"
        />
        <small className="form-hint">
          Comma-separated list of photo file extensions
        </small>
      </FormField>

      <FormField label="Video Extensions">
        <input
          type="text"
          value={videoExtensions}
          onChange={handleInputChange(setVideoExtensions, sanitizeInput)}
          placeholder="mp4,avi,mov,wmv,flv,mkv,webm"
          className="form-input"
        />
        <small className="form-hint">
          Comma-separated list of video file extensions
        </small>
      </FormField>

      <div className="checkbox-group">
        <FormField label="">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={deleteEmptyFolders}
              onChange={handleCheckboxChange(setDeleteEmptyFolders)}
              className="checkbox-input"
            />
            <span className="checkbox-text">Delete Empty Folders</span>
          </label>
        </FormField>

        <FormField label="">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={moveVideos}
              onChange={handleCheckboxChange(setMoveVideos)}
              className="checkbox-input"
            />
            <span className="checkbox-text">Move Long Videos</span>
          </label>
        </FormField>

        <FormField label="">
          <label className={`checkbox-label ${dryRun ? 'dry-run-active' : ''}`}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={handleCheckboxChange(setDryRun)}
              className="checkbox-input"
            />
            <span className="checkbox-text">Dry Run Mode (Preview Only)</span>
          </label>
          {dryRun && (
            <small className="form-hint dry-run-hint">
              No files will be modified - simulation mode
            </small>
          )}
        </FormField>
      </div>
    </FormSection>
  );
};

export default ProcessingSettings;
