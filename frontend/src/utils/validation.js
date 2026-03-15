/**
 * Frontend Validation Utilities
 * 
 * Provides reusable validation functions for common input validation scenarios
 * Ensures consistent validation logic across the application
 */

/**
 * Validate file type against allowed types
 * @param {File} file - The file to validate
 * @param {string[]} allowedTypes - Array of allowed file extensions (e.g., ['.pdf', '.docx'])
 * @returns {Object} { isValid: boolean, error?: string }
 */
export function validateFileType(file, allowedTypes) {
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }

  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowedTypes.includes(ext)) {
    return { 
      isValid: false, 
      error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` 
    };
  }

  return { isValid: true };
}

/**
 * Validate file size
 * @param {File} file - The file to validate
 * @param {number} maxSizeMB - Maximum file size in megabytes
 * @returns {Object} { isValid: boolean, error?: string }
 */
export function validateFileSize(file, maxSizeMB) {
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { 
      isValid: false, 
      error: `File size exceeds ${maxSizeMB}MB limit` 
    };
  }

  return { isValid: true };
}

/**
 * Validate that a value is not empty
 * @param {any} value - The value to validate
 * @param {string} fieldName - Name of the field (for error message)
 * @returns {Object} { isValid: boolean, error?: string }
 */
export function validateRequired(value, fieldName = 'This field') {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  return { isValid: true };
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {Object} { isValid: boolean, error?: string }
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true };
}

/**
 * Validate string length
 * @param {string} value - Value to validate
 * @param {number} minLength - Minimum length
 * @param {number} maxLength - Maximum length
 * @returns {Object} { isValid: boolean, error?: string }
 */
export function validateLength(value, minLength = 0, maxLength = Infinity) {
  if (value.length < minLength) {
    return { isValid: false, error: `Minimum length is ${minLength} characters` };
  }

  if (value.length > maxLength) {
    return { isValid: false, error: `Maximum length is ${maxLength} characters` };
  }

  return { isValid: true };
}

/**
 * Validate that value is a valid number
 * @param {any} value - Value to validate
 * @param {number} min - Minimum value (optional)
 * @param {number} max - Maximum value (optional)
 * @returns {Object} { isValid: boolean, error?: string }
 */
export function validateNumber(value, min = -Infinity, max = Infinity) {
  const num = Number(value);
  
  if (isNaN(num)) {
    return { isValid: false, error: 'Value must be a number' };
  }

  if (num < min) {
    return { isValid: false, error: `Value must be at least ${min}` };
  }

  if (num > max) {
    return { isValid: false, error: `Value must be at most ${max}` };
  }

  return { isValid: true };
}

/**
 * Validate that value matches a pattern
 * @param {string} value - Value to validate
 * @param {RegExp} pattern - Regex pattern to match
 * @param {string} message - Custom error message
 * @returns {Object} { isValid: boolean, error?: string }
 */
export function validatePattern(value, pattern, message = 'Invalid format') {
  if (!pattern.test(value)) {
    return { isValid: false, error: message };
  }

  return { isValid: true };
}
