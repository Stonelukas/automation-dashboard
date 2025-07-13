import React from 'react';

const FormSection = ({ 
  title, 
  children, 
  style = {},
  className = ""
}) => {
  return (
    <div
      className={`section-card animate-slide-in-up ${className}`}
      style={style}
    >
      <div className="section-header">
        <span className="section-icon">⚙️</span>
        <h3 className="section-title">{title}</h3>
      </div>
      {children}
    </div>
  );
};

export default FormSection;
