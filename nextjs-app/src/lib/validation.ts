import { z } from 'zod';

// Path validation schema
export const pathSchema = z.string()
  .min(1, 'Path cannot be empty')
  .refine((path) => {
    // Windows path validation
    const windowsPathRegex = /^[a-zA-Z]:\\(?:[^<>:"|?*\r\n]+\\)*[^<>:"|?*\r\n]*$/;
    // Unix path validation
    const unixPathRegex = /^\/(?:[^/\0]+\/)*[^/\0]*$/;
    return windowsPathRegex.test(path) || unixPathRegex.test(path);
  }, 'Invalid path format');

// Duration validation schema
export const durationSchema = z.number()
  .min(0, 'Duration must be positive')
  .max(86400, 'Duration cannot exceed 24 hours'); // 24 hours in seconds

// Configuration validation schema
export const configSchema = z.object({
  startFolder: pathSchema,
  videoMoveTarget: pathSchema,
  minDurationSeconds: durationSchema,
  isDryRun: z.boolean()
});

// File entry validation schema
export const fileEntrySchema = z.object({
  path: pathSchema,
  name: z.string().min(1, 'File name cannot be empty'),
  size: z.number().min(0, 'File size must be positive'),
  type: z.enum(['photo', 'video']),
  duration: z.number().optional(),
  shouldDelete: z.boolean().optional()
});

// Scan progress validation schema
export const scanProgressSchema = z.object({
  totalVideos: z.number().min(0).optional(),
  processedVideos: z.number().min(0).optional(),
  photosToDelete: z.number().min(0).optional(),
  currentFile: z.string().optional()
});

// Connection status validation
export const connectionStatusSchema = z.enum(['connected', 'disconnected', 'error']);

// Processing stage validation
export const processingStageSchema = z.enum(['idle', 'scanning', 'processing', 'waiting', 'done', 'error']);

// Type guards using Zod
export const isValidPath = (path: unknown): path is string => {
  return pathSchema.safeParse(path).success;
};

export const isValidConfig = (config: unknown): config is z.infer<typeof configSchema> => {
  return configSchema.safeParse(config).success;
};

export const isValidFileEntry = (entry: unknown): entry is z.infer<typeof fileEntrySchema> => {
  return fileEntrySchema.safeParse(entry).success;
};

export const validateConfiguration = (config: unknown) => {
  const result = configSchema.safeParse(config);
  if (!result.success) {
    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
      const field = issue.path.join('.');
      errors[field] = issue.message;
    });
    return { valid: false, errors };
  }
  return { valid: true, data: result.data };
};

// Input sanitization
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>:"|?*]/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
};

export const sanitizePath = (path: string): string => {
  return path
    .trim()
    .replace(/[<>"|?*]/g, '') // Remove dangerous characters but keep : for drive letters
    .replace(/\\/g, '/') // Normalize path separators
    .substring(0, 500); // Reasonable path length limit
};
