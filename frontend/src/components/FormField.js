import React from 'react';

const FormField = ({ 
  label, 
  children, 
  error = null,
  required = false,
  style = {},
  className = "" 
}) => {
  return (
    <div 
      className={`form-field ${className}`}
      style={style}
    >
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="required-indicator">*</span>}
        </label>
      )}
      {children}
      {error && (
        <div className="form-error">
          {error}
        </div>
      )}
    </div>
  );
};

export default FormField;
