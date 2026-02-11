// api/_lib/validation.ts — Input validation utilities

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate design generation input
 */
export function validateDesignInput(details: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (details.customization && typeof details.customization === 'string') {
    if (details.customization.length > 500) {
      errors.push({ field: 'customization', message: 'Customization prompt must be 500 characters or less' });
    }
  }

  if (details.title && typeof details.title === 'string') {
    if (details.title.length > 200) {
      errors.push({ field: 'title', message: 'Title must be 200 characters or less' });
    }
  }

  if (details.subtitle && typeof details.subtitle === 'string') {
    if (details.subtitle.length > 200) {
      errors.push({ field: 'subtitle', message: 'Subtitle must be 200 characters or less' });
    }
  }

  if (details.make && typeof details.make === 'string') {
    if (details.make.length > 100) {
      errors.push({ field: 'make', message: 'Make must be 100 characters or less' });
    }
  }

  if (details.model && typeof details.model === 'string') {
    if (details.model.length > 100) {
      errors.push({ field: 'model', message: 'Model must be 100 characters or less' });
    }
  }

  return errors;
}

/**
 * Sanitize error messages for client response
 * Never expose stack traces or internal details to clients
 */
export function sanitizeError(err: any): string {
  // Generic error messages by type
  if (err.message?.includes('GEMINI') || err.message?.includes('API')) {
    return 'Service temporarily unavailable. Please try again.';
  }
  
  if (err.message?.includes('quota') || err.message?.includes('rate limit')) {
    return 'Service is currently busy. Please try again in a moment.';
  }

  // If it's a safe user-facing message, allow it
  const safeMessages = [
    'Authentication required',
    'Invalid input',
    'details object is required',
    'The design studio failed to render the image',
  ];
  
  if (safeMessages.some(msg => err.message?.includes(msg))) {
    return err.message;
  }

  // Default generic error
  return 'An error occurred. Please try again.';
}

/**
 * Log detailed error server-side only
 */
export function logError(context: string, err: any, metadata?: any) {
  console.error(`[${context}] Error:`, {
    message: err.message,
    stack: err.stack,
    metadata,
    timestamp: new Date().toISOString(),
  });
}
