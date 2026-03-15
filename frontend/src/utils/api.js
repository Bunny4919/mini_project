/**
 * API Request/Response Handler Utilities
 * 
 * Provides consistent error handling, request wrapping, and response parsing
 * Reduces code duplication and improves reliability across the app
 */

const API_BASE = '/api';

/**
 * Configuration for fetch requests
 */
const defaultConfig = {
  timeout: 30000,
  retries: 1,
  headers: {
    'Content-Type': 'application/json'
  }
};

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(message, status = 500, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Wrapper for fetch requests with error handling and timeouts
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} options - Fetch options
 * @param {Object} config - Additional config (timeout, retries, etc.)
 * @returns {Promise<any>} Parsed response data
 * @throws {ApiError} If request fails or response is not ok
 */
export async function apiFetch(endpoint, options = {}, config = {}) {
  const finalConfig = { ...defaultConfig, ...config };
  const url = `${API_BASE}${endpoint}`;

  let lastError;
  for (let attempt = 0; attempt <= finalConfig.retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...finalConfig.headers,
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      // Parse response data
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else if (contentType?.includes('text')) {
        data = await response.text();
      } else {
        data = null;
      }

      // Handle non-ok responses
      if (!response.ok) {
        throw new ApiError(
          data?.message || data?.error || `HTTP ${response.status}`,
          response.status,
          data
        );
      }

      return data;
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Last attempt or timeout
      if (attempt === finalConfig.retries) {
        break;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  if (lastError instanceof ApiError) {
    throw lastError;
  }

  throw new ApiError(
    lastError?.message || 'Network request failed',
    0,
    { originalError: lastError }
  );
}

/**
 * GET request helper
 * @param {string} endpoint - API endpoint
 * @param {Object} config - Request config
 * @returns {Promise<any>}
 */
export function apiGet(endpoint, config = {}) {
  return apiFetch(endpoint, { method: 'GET' }, config);
}

/**
 * POST request helper
 * @param {string} endpoint - API endpoint
 * @param {any} data - Request body
 * @param {Object} config - Request config
 * @returns {Promise<any>}
 */
export function apiPost(endpoint, data = {}, config = {}) {
  return apiFetch(endpoint, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
    headers: data instanceof FormData ? {} : { 'Content-Type': 'application/json' }
  }, config);
}

/**
 * DELETE request helper
 * @param {string} endpoint - API endpoint
 * @param {Object} config - Request config
 * @returns {Promise<any>}
 */
export function apiDelete(endpoint, config = {}) {
  return apiFetch(endpoint, { method: 'DELETE' }, config);
}

/**
 * Upload file helper with progress tracking
 * @param {string} endpoint - API endpoint
 * @param {File} file - File to upload
 * @param {string} fieldName - Form field name (default: 'file')
 * @param {Function} onProgress - Progress callback (optional)
 * @param {Object} additionalData - Additional form data (optional)
 * @returns {Promise<any>}
 */
export function apiUpload(
  endpoint,
  file,
  fieldName = 'file',
  onProgress = null,
  additionalData = {}
) {
  const formData = new FormData();
  formData.append(fieldName, file);

  // Add additional fields
  Object.entries(additionalData).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Progress tracking
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      });
    }

    // Load handler
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch (e) {
          resolve(xhr.responseText);
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          reject(new ApiError(
            data?.message || `HTTP ${xhr.status}`,
            xhr.status,
            data
          ));
        } catch (e) {
          reject(new ApiError(`HTTP ${xhr.status}`, xhr.status));
        }
      }
    });

    // Error handler
    xhr.addEventListener('error', () => {
      reject(new ApiError('Network request failed', 0));
    });

    // Abort handler
    xhr.addEventListener('abort', () => {
      reject(new ApiError('Request cancelled', 0));
    });

    xhr.open('POST', `${API_BASE}${endpoint}`);
    xhr.send(formData);
  });
}

/**
 * Convert snake_case to camelCase
 * @param {string} str
 * @returns {string}
 */
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

/**
 * Recursively convert object keys from snake_case to camelCase
 * @param {any} obj
 * @returns {any}
 */
export function camelizeKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(camelizeKeys);
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      result[toCamelCase(key)] = camelizeKeys(obj[key]);
      return result;
    }, {});
  }

  return obj;
}
