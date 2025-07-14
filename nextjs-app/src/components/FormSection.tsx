'use client';

import React, { ReactNode } from 'react';

interface FormSectionProps {
  title: string;
  children: ReactNode;
  style?: React.CSSProperties;
}

/**
 * FormSection component for organizing form content into logical sections
 */
const FormSection: React.FC<FormSectionProps> = ({ title, children, style }) => {
  return (
    <div className="glass-container p-6 rounded-lg mb-6" style={style}>
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
        {title}
      </h3>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

export default FormSection;
