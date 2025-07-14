'use client';

import React, { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
}

/**
 * FormField component for consistent form field styling
 */
const FormField: React.FC<FormFieldProps> = ({ label, children, error, hint }) => {
  return (
    <div className="space-y-2">
      <label className="block text-white text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <div className="text-red-400 text-sm mt-1">
          {error}
        </div>
      )}
      {hint && !error && (
        <div className="text-white/60 text-xs mt-1">
          {hint}
        </div>
      )}
    </div>
  );
};

export default FormField;
